import requests
import json
import time

api_key = "sk-mino-TzDd-n0CMvFC5N4hu45yZO8w6vuebyRO"  # Replace this

response = requests.post(
    "https://mino.ai/v1/automation/run-sse",
    headers={
        "X-API-Key": api_key,
        "Content-Type": "application/json",
    },
    json={
        "url": "https://www.youtube.com/watch?v=dQw4w9WgXcQ",  # Rick Roll (has lots of comments)
        "goal": "STEALTH MODE ON. Wait 8 seconds. Scroll down 3x slowly. Click 'View all comments' if shown. Extract TOP 15 comments with MOST likes. For each: username, full comment text, like count, time posted. Filter shopping/tech deals. Return clean JSON array only.",
        "browser_profile": "stealth",
        "proxy_config": {
            "enabled": True,
            "country_code": "US",
            "residential": True
        },
        "wait_for": "#comments, .ytd-comments-container",
        "extra_delay": 8000,
        "human_delay": True
    },
    stream=True,
)

print("🔄 Extracting YouTube comments... (live stream)")

for line in response.iter_lines():
    if line:
        line_str = line.decode("utf-8")
        if line_str.startswith("data: "):
            try:
                event = json.loads(line_str[6:])
                
                if event.get("type") == "COMPLETE" and event.get("status") == "COMPLETED":
                    print("\n✅ SUCCESS! YouTube Comments Extracted:")
                    print(json.dumps(event["resultJson"], indent=2))
                    break
                    
                elif event.get("status") == "error":
                    print(f"❌ Error: {event.get('message', 'Unknown error')}")
                    
            except json.JSONDecodeError:
                continue

print("Done! 🎥")
