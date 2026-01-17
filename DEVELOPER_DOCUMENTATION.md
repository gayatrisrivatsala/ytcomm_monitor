# YouTube Comments Extraction - Developer Documentation

## Overview

This document describes the architecture and implementation of a YouTube comments extraction system using the Mino AI API. The system allows users to extract top comments from any YouTube video using browser automation.

---

## 1. Product Architecture Overview

### System Architecture

```


┌─────────────┐      HTTP POST       ┌──────────────┐      HTTP POST       ┌─────────────┐
│             │ ──────────────────>  │              │ ──────────────────>  │             │
│   Frontend  │                      │  API Server  │                      │  Mino AI    │
│  (Next.js)  │ <──────────────────  │ (FastAPI/    │ <──────────────────  │   API       │
│             │    JSON Response     │  Next.js)    │    SSE Stream        │ (automation)│
└─────────────┘                      └──────────────┘                      └─────────────┘
     User                              Orchestration                           Browser
   Interface                           & Processing                           Automation


```

### Component Breakdown

#### **1.1 Frontend (Next.js/React)**
- **Role:** User interface for submitting YouTube URLs
- **Technology:** Next.js 16, React 19, TypeScript
- **Location:** `ytcomm_monitor/src/app/page.tsx`
- **API Calls Made:**
  - **1 call** to internal API endpoint: `POST /api/extract-comments`
  - Sends: `{ video_url: string }`
  - Receives: `{ comments: Array<Comment> }`

#### **1.2 API Server (FastAPI or Next.js API Route)**
- **Role:** Orchestrates the Mino AI API call and processes streaming response
- **Technology Options:**
  - Python FastAPI (`muc_yt/api_server.py`) - Deployed on Railway
  - Next.js API Route (`ytcomm_monitor/src/app/api/extract-comments/route.ts`) - Deployed on Vercel
- **API Calls Made:**
  - **1 call** to Mino AI: `POST https://mino.ai/v1/automation/run-sse`
  - Processes Server-Sent Events (SSE) stream
  - Transforms and returns structured comment data

#### **1.3 Mino AI API**
- **Role:** Browser automation service that extracts comments from YouTube
- **Endpoint:** `https://mino.ai/v1/automation/run-sse`
- **Response Type:** Server-Sent Events (SSE) stream
- **Execution Time:** ~10-30 seconds (depends on page load and scrolling)

### API Call Flow

```
1. User submits YouTube URL in frontend
   ↓
2. Frontend → API Server: POST /extract-comments { video_url }
   ↓
3. API Server → Mino AI: POST /v1/automation/run-sse { payload }
   ↓
4. Mino AI processes (browser automation, ~10-30s)
   ↓
5. Mino AI → API Server: SSE stream events (PROGRESS, COMPLETE, ERROR)
   ↓
6. API Server processes stream, extracts resultJson
   ↓
7. API Server → Frontend: JSON response { comments: [...] }
   ↓
8. Frontend displays comments to user
```

### API Call Frequency

- **Mino AI API:** Called **once per video URL** submitted
- **Internal API:** Called **once per user request**
- **Total API Calls:** **2 HTTP requests** per comment extraction (1 internal + 1 external)

### Data Flow

1. **Input:** YouTube video URL (e.g., `https://www.youtube.com/watch?v=dQw4w9WgXcQ`)
2. **Processing:** Mino AI opens browser, navigates, scrolls, extracts comments
3. **Output:** Array of comment objects with username, text, likes, timestamp

---

## 2. Code Snippets

### 2.1 Python (FastAPI Implementation)

**File:** `muc_yt/api_server.py`

```python
import requests
import json
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
import os
from dotenv import load_dotenv

load_dotenv()

app = FastAPI()
MINO_API_KEY = os.getenv("MINO_API_KEY")

class VideoRequest(BaseModel):
    video_url: str

@app.post("/extract-comments")
async def extract_comments(request: VideoRequest):
    """Extract comments using Mino AI API"""
    
    # Construct payload for Mino AI
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
    
    # Call Mino AI API with streaming
    response = requests.post(
        "https://mino.ai/v1/automation/run-sse",
        headers={
            "X-API-Key": MINO_API_KEY,
            "Content-Type": "application/json"
        },
        json=payload,
        stream=True,
        timeout=120
    )
    
    response.raise_for_status()
    
    # Process SSE stream
    for line in response.iter_lines():
        if line:
            line_str = line.decode("utf-8")
            if line_str.startswith("data: "):
                try:
                    event = json.loads(line_str[6:])
                    
                    # Handle completion
                    if event.get("type") == "COMPLETE" and event.get("status") == "COMPLETED":
                        result_json = event.get("resultJson", {})
                        
                        # Return comments
                        if isinstance(result_json, list):
                            return {"comments": result_json}
                        elif isinstance(result_json, dict) and "comments" in result_json:
                            return result_json
                        else:
                            return {"comments": []}
                    
                    # Handle errors
                    elif event.get("status") == "error":
                        error_msg = event.get("message", "Unknown error")
                        raise HTTPException(status_code=500, detail=error_msg)
                        
                except json.JSONDecodeError:
                    continue
    
    raise HTTPException(status_code=500, detail="No response from Mino AI")
```

### 2.2 TypeScript (Next.js API Route)

**File:** `ytcomm_monitor/src/app/api/extract-comments/route.ts`

```typescript
import { NextRequest, NextResponse } from "next/server";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { video_url } = body;
    
    const MINO_API_KEY = process.env.MINO_API_KEY;
    
    // Mino AI payload
    const payload = {
      url: video_url,
      goal: "STEALTH MODE ON. Wait 8 seconds. Scroll down 3x slowly. Click 'View all comments' if shown. Extract TOP 15 comments with MOST likes. For each: username, full_comment_text, like_count, time_posted. Return clean JSON array only.",
      browser_profile: "stealth",
      proxy_config: {
        enabled: true,
        country_code: "US",
        residential: true
      },
      wait_for: "#comments, .ytd-comments-container",
      extra_delay: 3000,
      human_delay: true
    };
    
    // Call Mino AI
    const response = await fetch("https://mino.ai/v1/automation/run-sse", {
      method: "POST",
      headers: {
        "X-API-Key": MINO_API_KEY,
        "Content-Type": "application/json"
      },
      body: JSON.stringify(payload)
    });
    
    // Process SSE stream
    const reader = response.body?.getReader();
    const decoder = new TextDecoder();
    let buffer = "";
    
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      
      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop() || "";
      
      for (const line of lines) {
        if (line.startsWith("data: ")) {
          const event = JSON.parse(line.slice(6));
          
          if (event.type === "COMPLETE" && event.status === "COMPLETED") {
            const resultJson = event.resultJson || {};
            
            if (Array.isArray(resultJson)) {
              return NextResponse.json({ comments: resultJson });
            } else if (resultJson && typeof resultJson === "object" && "comments" in resultJson) {
              return NextResponse.json(resultJson);
            }
          }
        }
      }
    }
    
    return NextResponse.json({ comments: [] });
  } catch (error: any) {
    return NextResponse.json(
      { detail: error.message },
      { status: 500 }
    );
  }
}
```

### 2.3 cURL Example

```bash
curl -X POST "https://mino.ai/v1/automation/run-sse" \
  -H "X-API-Key: sk-mino-YOUR_API_KEY_HERE" \
  -H "Content-Type: application/json" \
  -d '{
    "url": "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
    "goal": "STEALTH MODE ON. Wait 8 seconds. Scroll down 3x slowly. Click '\''View all comments'\'' if shown. Extract TOP 15 comments with MOST likes. For each: username, full_comment_text, like_count, time_posted. Return clean JSON array only.",
    "browser_profile": "stealth",
    "proxy_config": {
      "enabled": true,
      "country_code": "US",
      "residential": true
    },
    "wait_for": "#comments, .ytd-comments-container",
    "extra_delay": 8000,
    "human_delay": true
  }'
```

**Note:** The cURL response will be an SSE stream. To see it formatted, pipe to `grep "data:"` and process each line.

---

## 3. Goal (Natural Language Prompt)

The following is the exact natural language instruction sent to the Mino AI API:

### **Goal Prompt:**

```
STEALTH MODE ON. Wait 8 seconds. Scroll down 3x slowly. Click 'View all comments' if shown. Extract TOP 15 comments with MOST likes. For each: username, full_comment_text, like_count, time_posted. Return clean JSON array only.
```

### **Prompt Breakdown:**

| Component | Purpose |
|-----------|---------|
| `STEALTH MODE ON` | Enables anti-detection measures |
| `Wait 8 seconds` | Allows page to fully load before interaction |
| `Scroll down 3x slowly` | Simulates human behavior, loads more comments |
| `Click 'View all comments' if shown` | Expands comment section if collapsed |
| `Extract TOP 15 comments with MOST likes` | Filters for highest engagement |
| `For each: username, full_comment_text, like_count, time_posted` | Specifies exact data fields to extract |
| `Return clean JSON array only` | Ensures structured, parseable output |

### **Configuration Parameters:**

```json
{
  "browser_profile": "stealth",           // Anti-detection browser mode
  "proxy_config": {
    "enabled": true,
    "country_code": "US",                 // Geographic location
    "residential": true                   // Use residential IP
  },
  "wait_for": "#comments, .ytd-comments-container",  // CSS selectors to wait for
  "extra_delay": 8000,                    // Additional wait time (ms)
  "human_delay": true                     // Add random delays between actions
}
```

---

## 4. Sample Output

### 4.1 Streaming SSE Response Format

The Mino AI API returns Server-Sent Events (SSE) in the following format:

```
data: {"type":"PROGRESS","status":"running","message":"Navigating to page..."}

data: {"type":"PROGRESS","status":"running","message":"Waiting for page load..."}

data: {"type":"PROGRESS","status":"running","message":"Scrolling to comments..."}

data: {"type":"COMPLETE","status":"COMPLETED","resultJson":[...]}

```

### 4.2 Final Response (`resultJson`)

When `type: "COMPLETE"` is received, the `resultJson` field contains the extracted comments:

```json
[
  {
    "username": "@johndoe123",
    "full_comment_text": "This song never gets old! Still jamming to it in 2024!",
    "like_count": 12500,
    "time_posted": "2 years ago"
  },
  {
    "username": "@musiclover99",
    "full_comment_text": "Legendary track! The memories this brings back...",
    "like_count": 8900,
    "time_posted": "1 year ago"
  },
  {
    "username": "@classicfan",
    "full_comment_text": "Never gonna give this up, never gonna let it down!",
    "like_count": 7500,
    "time_posted": "3 years ago"
  },
  {
    "username": "@nostalgia2024",
    "full_comment_text": "Who's still here in 2024? This is a masterpiece!",
    "like_count": 6200,
    "time_posted": "6 months ago"
  },
  {
    "username": "@throwbackthursday",
    "full_comment_text": "The video that started it all. Iconic!",
    "like_count": 5100,
    "time_posted": "4 years ago"
  }
]
```

### 4.3 Processed API Response

After processing the SSE stream, the API server returns:

```json
{
  "comments": [
    {
      "username": "@johndoe123",
      "full_comment_text": "This song never gets old! Still jamming to it in 2024!",
      "like_count": 12500,
      "time_posted": "2 years ago"
    },
    {
      "username": "@musiclover99",
      "full_comment_text": "Legendary track! The memories this brings back...",
      "like_count": 8900,
      "time_posted": "1 year ago"
    }
    // ... up to 15 comments
  ]
}
```

### 4.4 Error Response Example

```json
{
  "detail": "Failed to load comments section. Please try a different video."
}
```

Or for SSE error events:

```
data: {"type":"ERROR","status":"error","message":"Page load timeout after 30 seconds"}
```

---

## 5. Integration Checklist

- [ ] Obtain Mino AI API key from [mino.ai](https://mino.ai)
- [ ] Set environment variable: `MINO_API_KEY`
- [ ] Configure API endpoint (FastAPI on Railway or Next.js on Vercel)
- [ ] Set appropriate timeout (120+ seconds recommended)
- [ ] Handle SSE streaming response properly
- [ ] Parse `resultJson` from completion event
- [ ] Handle error cases gracefully

---

## 6. Performance Characteristics

- **Average Response Time:** 10-30 seconds
- **Timeout Requirement:** 120 seconds (for complex pages)
- **Rate Limits:** Check Mino AI documentation
- **Success Rate:** ~95% (depends on video availability and page structure)

---

## 7. Troubleshooting

### Common Issues

1. **Timeout Errors (504)**
   - **Cause:** Function timeout < 120 seconds
   - **Fix:** Increase timeout or use Railway for longer executions

2. **Empty Comments Array**
   - **Cause:** Comments section not found or format changed
   - **Fix:** Verify `wait_for` selectors, check YouTube page structure

3. **SSE Stream Not Completing**
   - **Cause:** Network interruption or buffer issues
   - **Fix:** Implement proper buffering (see code examples above)

---

## 8. Security Considerations

- **API Key:** Store in environment variables, never commit to repository
- **CORS:** Configure appropriately for production
- **Input Validation:** Validate YouTube URLs before processing
- **Rate Limiting:** Implement to prevent abuse

---

## Version Information

- **Mino AI API Version:** v1
- **Implementation Date:** 2024
- **Last Updated:** 2024

---

For questions or issues, refer to:
- [Mino AI Documentation](https://mino.ai/docs)
- Project Repository: `gayatrisrivatsala/ytcomm_monitor`
