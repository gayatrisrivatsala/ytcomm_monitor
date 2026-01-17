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
      extra_delay: 8000,
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

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      const chunk = decoder.decode(value, { stream: true });
      const lines = chunk.split("\n");

      for (const line of lines) {
        if (line.startsWith("data: ")) {
          try {
            const event = JSON.parse(line.slice(6));

            // Check for errors
            if (event.status === "error" || event.type === "ERROR") {
              const errorMsg =
                event.message || event.error || "Unknown error from Mino AI";
              return NextResponse.json(
                { detail: String(errorMsg) },
                { status: 500 }
              );
            }

            // Check for completion
            if (event.type === "COMPLETE" && event.status === "COMPLETED") {
              const resultJson = event.resultJson || {};

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
                const comments = resultJson.comments || [];
                return NextResponse.json({
                  comments: Array.isArray(comments) ? comments : [],
                });
              } else {
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
