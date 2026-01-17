from fastapi import FastAPI, HTTPException, Body
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import requests
import json
import uvicorn
import os
from dotenv import load_dotenv

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
if not MINO_API_KEY:
    print("WARNING: MINO_API_KEY not found in environment variables!")

class VideoRequest(BaseModel):
    video_url: str

@app.get("/")
async def root():
    return {"message": "YouTube Comments API Live 🚀"}

@app.post("/extract-comments")
async def extract_comments(request: VideoRequest):
    """Extract comments for ANY YouTube video"""
    
    payload = {
        "url": request.video_url,
        "goal": "STEALTH MODE ON. Wait 8 seconds. Scroll down 3x slowly. Click 'View all comments' if shown. Extract TOP 15 comments with MOST likes. For each: username, full_comment_text, like_count, time_posted. Return clean JSON array only.",
        "browser_profile": "stealth",
        "proxy_config": {
            "enabled": True,
            "country_code": "US",
            "residential": True
        },
        "wait_for": "#comments, .ytd-comments-container",
        "extra_delay": 8000,
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
                            
                            # Handle different response formats
                            if isinstance(result_json, list):
                                return {"comments": result_json}
                            elif isinstance(result_json, dict) and "comments" in result_json:
                                return result_json
                            elif isinstance(result_json, dict):
                                # Try to extract comments if they're nested
                                comments = result_json.get("comments", [])
                                return {"comments": comments if isinstance(comments, list) else []}
                            else:
                                print(f"Unexpected result format: {result_json}")
                                return {"comments": []}
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
