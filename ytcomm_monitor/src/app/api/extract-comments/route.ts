import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";
export const maxDuration = 120; // 2 minutes for Vercel Pro, 10s for Hobby

export async function GET() {
  return NextResponse.json({ message: "API route is working", status: "ok" });
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { video_url } = body;

    if (!video_url) {
      return NextResponse.json(
        { detail: "video_url is required" },
        { status: 400 }
      );
    }

    const MINO_API_KEY = process.env.MINO_API_KEY;
    if (!MINO_API_KEY) {
      return NextResponse.json(
        { detail: "MINO_API_KEY not configured" },
        { status: 500 }
      );
    }

    const payload = {
      url: video_url,
      goal:
        "STEALTH MODE ON. Wait 8 seconds. Scroll down 3x slowly. Click 'View all comments' if shown. Extract TOP 15 comments with MOST likes. For each: username, full_comment_text, like_count, time_posted. Return clean JSON array only.",
      browser_profile: "stealth",
      proxy_config: {
        enabled: true,
        country_code: "US",
        residential: true,
      },
      wait_for: "#comments, .ytd-comments-container",
      extra_delay: 3000, // Reduced from 8000ms to try to fit within 10s timeout
      human_delay: true,
    };

    const response = await fetch("https://mino.ai/v1/automation/run-sse", {
      method: "POST",
      headers: {
        "X-API-Key": MINO_API_KEY,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const errorText = await response.text();
      return NextResponse.json(
        { detail: `Mino AI API error: ${response.status} - ${errorText}` },
        { status: response.status }
      );
    }

    // Stream and process SSE response
    const reader = response.body?.getReader();
    const decoder = new TextDecoder();

    if (!reader) {
      return NextResponse.json(
        { detail: "Failed to read response stream" },
        { status: 500 }
      );
    }

    let buffer = "";

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n");
      
      // Keep the last incomplete line in buffer
      buffer = lines.pop() || "";

      for (const line of lines) {
        if (!line.trim()) continue;
        
        if (line.startsWith("data: ")) {
          try {
            const dataStr = line.slice(6).trim();
            if (!dataStr) continue;
            
            const event = JSON.parse(dataStr);

            console.log("Event received:", event.type, event.status);

            // Check for errors
            if (event.status === "error" || event.type === "ERROR") {
              const errorMsg =
                event.message || event.error || "Unknown error from Mino AI";
              console.error("Mino AI error:", errorMsg);
              return NextResponse.json(
                { detail: String(errorMsg) },
                { status: 500 }
              );
            }

            // Check for completion
            if (event.type === "COMPLETE" && event.status === "COMPLETED") {
              let resultJson = event.resultJson || {};
              
              // If resultJson is a string, try to parse it
              if (typeof resultJson === "string") {
                try {
                  resultJson = JSON.parse(resultJson);
                } catch (e) {
                  console.error("Failed to parse resultJson string:", e);
                }
              }

              console.log("Result JSON type:", typeof resultJson);
              console.log("Result JSON:", JSON.stringify(resultJson).substring(0, 500));

              // Handle different response formats
              if (Array.isArray(resultJson)) {
                return NextResponse.json({ comments: resultJson });
              } else if (
                resultJson &&
                typeof resultJson === "object" &&
                "comments" in resultJson
              ) {
                return NextResponse.json(resultJson);
              } else if (resultJson && typeof resultJson === "object") {
                // Try to find comments in nested structure
                const comments = 
                  resultJson.comments || 
                  (Array.isArray(resultJson) ? resultJson : []);
                return NextResponse.json({
                  comments: Array.isArray(comments) ? comments : [],
                });
              } else {
                // Last resort: try to extract from any top-level array
                const keys = Object.keys(resultJson || {});
                for (const key of keys) {
                  const value = resultJson[key];
                  if (Array.isArray(value) && value.length > 0) {
                    // Check if it looks like comments (has objects with text/username)
                    if (value[0] && typeof value[0] === "object") {
                      return NextResponse.json({ comments: value });
                    }
                  }
                }
                console.log("No comments found in result:", resultJson);
                return NextResponse.json({ comments: [] });
              }
            }
          } catch (e) {
            // Continue processing if JSON parse fails
            continue;
          }
        }
      }
    }

    return NextResponse.json(
      { detail: "Extraction failed - no response from Mino AI" },
      { status: 500 }
    );
  } catch (error: any) {
    console.error("API Error:", error);
    return NextResponse.json(
      { detail: error.message || "Internal server error" },
      { status: 500 }
    );
  }
}
