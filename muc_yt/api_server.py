from fastapi import FastAPI, HTTPException, Body
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import requests
import json
import uvicorn
import os
from dotenv import load_dotenv
from typing import List, Dict, Any

# Load environment variables
load_dotenv()

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Get API key from environment variable
MINO_API_KEY = os.getenv("MINO_API_KEY", "")
HUGGINGFACE_API_KEY = os.getenv("HUGGINGFACE_API_KEY", "")
HF_SENTIMENT_MODEL = os.getenv(
    "HF_SENTIMENT_MODEL", "cardiffnlp/twitter-roberta-base-sentiment-latest"
)
HF_INTENT_MODEL = os.getenv("HF_INTENT_MODEL", "facebook/bart-large-mnli")
if not MINO_API_KEY:
    print("WARNING: MINO_API_KEY not found in environment variables!")
if not HUGGINGFACE_API_KEY:
    print("WARNING: HUGGINGFACE_API_KEY not found in environment variables! Sentiment/intent analysis will be skipped.")

class VideoRequest(BaseModel):
    video_url: str
    analyze: bool = True  # run Hugging Face sentiment/intent classification


def call_hf(model: str, payload: Dict[str, Any]) -> Any:
    """Generic Hugging Face Inference API helper."""
    if not HUGGINGFACE_API_KEY:
        return None

    try:
        resp = requests.post(
            f"https://router.huggingface.co/models/{model}",
            headers={
                "Authorization": f"Bearer {HUGGINGFACE_API_KEY}",
                "Content-Type": "application/json",
            },
            json={**payload, "options": {"wait_for_model": True}},
            timeout=30,
        )
    except Exception as e:
        print(f"HF request error: {e}")
        return None

    if resp.status_code != 200:
        print(f"HF error {resp.status_code}: {resp.text}")
        return None
    return resp.json()


def classify_sentiment(text: str) -> str:
    """Return positive/neutral/negative using sentiment model."""
    if not text.strip():
        return "neutral"

    result = call_hf(
        HF_SENTIMENT_MODEL,
        {"inputs": text[:450]},  # trim to keep request light
    )
    # Result can be [ {label,score}, ... ] or [ [ {label,score}, ... ] ]
    scores = {}
    if isinstance(result, list) and result and isinstance(result[0], dict):
        scores = {item.get("label", "").lower(): item.get("score", 0) for item in result}
    elif (
        isinstance(result, list)
        and result
        and isinstance(result[0], list)
        and result[0]
        and isinstance(result[0][0], dict)
    ):
        scores = {item.get("label", "").lower(): item.get("score", 0) for item in result[0]}

    if not scores:
        return "neutral"

    if "negative" in scores and "positive" in scores and "neutral" in scores:
        return max(scores, key=scores.get)
    # fallback for 2-label models
    return "positive" if scores.get("positive", 0) >= scores.get("negative", 0) else "negative"


def classify_intent(text: str) -> str:
    """Zero-shot classify into feature request/complaint/praise/question/other."""
    if not text.strip():
        return "other"

    labels = ["feature request", "complaint", "praise", "question", "other"]
    result = call_hf(
        HF_INTENT_MODEL,
        {
            "inputs": text[:450],
            "parameters": {
                "candidate_labels": labels,
                "multi_label": False,
            },
        },
    )
    if not result or "labels" not in result or "scores" not in result:
        return "other"

    label_scores = dict(zip(result["labels"], result["scores"]))
    return max(label_scores, key=label_scores.get)


def analyze_comments(comments: List[Dict[str, Any]]) -> Dict[str, Any]:
    """Add sentiment/intent to each comment and compute rollups."""
    if not HUGGINGFACE_API_KEY:
        return {"sentiment_breakdown": {}, "intent_breakdown": {}, "comments": comments}

    sentiment_counts = {"positive": 0, "neutral": 0, "negative": 0}
    intent_counts = {"feature request": 0, "complaint": 0, "praise": 0, "question": 0, "other": 0}
    enriched_comments = []

    for comment in comments:
        text = comment.get("full_comment_text", "")
        sentiment = classify_sentiment(text)
        intent = classify_intent(text)

        sentiment_counts[sentiment] = sentiment_counts.get(sentiment, 0) + 1
        intent_counts[intent] = intent_counts.get(intent, 0) + 1

        enriched_comments.append({**comment, "sentiment": sentiment, "intent": intent})

    return {
        "comments": enriched_comments,
        "sentiment_breakdown": sentiment_counts,
        "intent_breakdown": intent_counts,
    }

@app.get("/")
async def root():
    return {"message": "YouTube Comments API Live 🚀"}

@app.post("/extract-comments")
async def extract_comments(request: VideoRequest):
    """Extract comments for ANY YouTube video and optionally analyze them."""

    # Aim for more than 15 to stabilize insights, but allow smaller videos.
    payload = {
        "url": request.video_url,
        "goal": "STEALTH MODE ON. Wait 12 seconds. If Shorts page, click the comments pill or comments icon to open the comments sheet. If not Shorts, click 'View all comments' if shown. After opening comments, scroll the comments area down 4x slowly. Extract the top 60 comments with the most likes (minimum 15 if fewer). For each: username, full_comment_text, like_count, time_posted. Return clean JSON array only.",
        "browser_profile": "stealth",
        "proxy_config": {
            "enabled": True,
            "country_code": "US",
            "residential": True
        },
        "wait_for": "#comments, .ytd-comments-container, ytd-item-section-renderer, ytd-reel-watch-end-screen-comments-button-renderer, #comments-button",
        "extra_delay": 12000,
        "human_delay": True
    }

    try:
        response = requests.post(
            "https://mino.ai/v1/automation/run-sse",
            headers={"X-API-Key": MINO_API_KEY, "Content-Type": "application/json"},
            json=payload,
            stream=True,
            timeout=120
        )
        
        response.raise_for_status()
        
        for line in response.iter_lines():
            if line:
                line_str = line.decode("utf-8")
                if line_str.startswith("data: "):
                    try:
                        event = json.loads(line_str[6:])
                        
                        # Log for debugging
                        event_type = event.get("type")
                        event_status = event.get("status")
                        print(f"Event received: type={event_type}, status={event_status}")
                        
                        # Check for errors
                        if event.get("status") == "error" or event_type == "ERROR":
                            error_msg = event.get("message") or event.get("error") or "Unknown error from Mino AI"
                            if isinstance(error_msg, dict):
                                error_msg = json.dumps(error_msg, indent=2)
                            elif not isinstance(error_msg, str):
                                error_msg = str(error_msg)
                            print(f"Error from Mino AI: {error_msg}")
                            raise HTTPException(status_code=500, detail=error_msg)
                        
                        # Check for completion
                        if event_type == "COMPLETE" and event_status == "COMPLETED":
                            result_json = event.get("resultJson", {})
                            print(f"Result received: type={type(result_json)}")
                            
                            # Normalize comments list
                            comments: List[Dict[str, Any]] = []
                            if isinstance(result_json, list):
                                comments = result_json
                            elif isinstance(result_json, dict) and "comments" in result_json:
                                comments = result_json.get("comments", [])
                            elif isinstance(result_json, dict):
                                comments = result_json.get("comments", [])
                            else:
                                print(f"Unexpected result format: {result_json}")

                            if not isinstance(comments, list):
                                comments = []

                            # Optionally classify with Hugging Face
                            analysis = analyze_comments(comments) if request.analyze else {"comments": comments}

                            return {
                                "comments": analysis.get("comments", comments),
                                "sentiment_breakdown": analysis.get("sentiment_breakdown", {}),
                                "intent_breakdown": analysis.get("intent_breakdown", {}),
                                "comment_count": len(comments),
                                "analysis_source": "huggingface" if HUGGINGFACE_API_KEY else "skipped",
                            }
                    except json.JSONDecodeError as e:
                        print(f"JSON decode error: {str(e)}")
                        continue
                    except HTTPException:
                        raise
                    except Exception as e:
                        # Log the error but continue processing
                        print(f"Error processing line: {str(e)}")
                        continue
                        
    except requests.exceptions.RequestException as e:
        raise HTTPException(status_code=500, detail=f"API request failed: {str(e)}")
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Unexpected error: {str(e)}")
    
    raise HTTPException(status_code=500, detail="Extraction failed - no response from Mino AI")

if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=8000)
