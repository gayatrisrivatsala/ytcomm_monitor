import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";
export const maxDuration = 120; // allow enough time for scraping + HF

type HFScore = { label: string; score: number };
type HFResult = HFScore[] | HFScore[][];

const MINO_API_KEY = process.env.MINO_API_KEY;
const HF_KEY = process.env.HUGGINGFACE_API_KEY;
const HF_SENTIMENT_MODEL =
  process.env.HF_SENTIMENT_MODEL ||
  "cardiffnlp/twitter-roberta-base-sentiment-latest";
const HF_INTENT_MODEL =
  process.env.HF_INTENT_MODEL || "facebook/bart-large-mnli";

async function callHF(model: string, payload: unknown) {
  if (!HF_KEY) return null;
  // Use the new HF router endpoint (api-inference is deprecated)
  const res = await fetch(`https://router.huggingface.co/models/${model}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${HF_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      ...((typeof payload === "object" && payload !== null && !Array.isArray(payload))
        ? payload
        : { inputs: payload }),
      options: { wait_for_model: true },
    }),
  });
  if (!res.ok) {
    console.error("HF error", res.status, await res.text());
    return null;
  }
  return res.json();
}

function normalizeSentimentResult(result: HFResult | null): Record<string, number> {
  if (!result) return {};
  // Handle shape: [{label,score}, ...]
  if (Array.isArray(result) && result.length && !Array.isArray(result[0])) {
    const list = result as HFScore[];
    return Object.fromEntries(list.map((r) => [r.label.toLowerCase(), r.score]));
  }
  // Handle shape: [[{label,score}, ...]]
  if (Array.isArray(result) && result.length && Array.isArray(result[0])) {
    const list = (result as HFScore[][])[0] || [];
    return Object.fromEntries(list.map((r) => [r.label.toLowerCase(), r.score]));
  }
  return {};
}

async function classifySentiment(text: string): Promise<string> {
  if (!text.trim()) return "neutral";
  const result = (await callHF(HF_SENTIMENT_MODEL, { inputs: text.slice(0, 450) })) as HFResult | null;
  const scores = normalizeSentimentResult(result);
  if (Object.keys(scores).length === 0) return "neutral";
  if ("positive" in scores && "neutral" in scores && "negative" in scores) {
    return Object.entries(scores).sort((a, b) => b[1] - a[1])[0][0];
  }
  return scores.positive >= scores.negative ? "positive" : "negative";
}

async function classifyIntent(text: string): Promise<string> {
  if (!text.trim()) return "other";
  const labels = ["feature request", "complaint", "praise", "question", "other"];
  const result = (await callHF(HF_INTENT_MODEL, {
    inputs: text.slice(0, 450),
    parameters: { candidate_labels: labels, multi_label: false },
  })) as { labels: string[]; scores: number[] } | null;
  if (!result || !Array.isArray(result.labels) || !Array.isArray(result.scores)) return "other";
  const labelScores = result.labels.map((l, i) => [l, result.scores[i]] as [string, number]);
  return labelScores.sort((a, b) => b[1] - a[1])[0][0] || "other";
}

async function analyzeComments(comments: any[]) {
  if (!HF_KEY) {
    return {
      comments,
      sentiment_breakdown: {},
      intent_breakdown: {},
      analysis_source: "skipped",
    };
  }

  const sentimentCounts: Record<string, number> = { positive: 0, neutral: 0, negative: 0 };
  const intentCounts: Record<string, number> = {
    "feature request": 0,
    complaint: 0,
    praise: 0,
    question: 0,
    other: 0,
  };

  const enriched = [];
  for (const c of comments) {
    const text = c?.full_comment_text || "";
    const sentiment = await classifySentiment(text);
    const intent = await classifyIntent(text);
    sentimentCounts[sentiment] = (sentimentCounts[sentiment] || 0) + 1;
    intentCounts[intent] = (intentCounts[intent] || 0) + 1;
    enriched.push({ ...c, sentiment, intent });
  }

  return {
    comments: enriched,
    sentiment_breakdown: sentimentCounts,
    intent_breakdown: intentCounts,
    analysis_source: "huggingface",
  };
}

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

    if (!MINO_API_KEY) {
      return NextResponse.json(
        { detail: "MINO_API_KEY not configured" },
        { status: 500 }
      );
    }

    const payload = {
      url: video_url,
      goal:
        "STEALTH MODE ON. Wait 12 seconds. If Shorts page, click the comments pill or comments icon to open the comments sheet. If not Shorts, click 'View all comments' if shown. After opening comments, scroll the comments area down 4x slowly. Extract the top 60 comments with the most likes (minimum 15 if fewer). For each: username, full_comment_text, like_count, time_posted. Return clean JSON array only.",
      browser_profile: "stealth",
      proxy_config: {
        enabled: true,
        country_code: "US",
        residential: true,
      },
      wait_for:
        "#comments, .ytd-comments-container, ytd-item-section-renderer, ytd-reel-watch-end-screen-comments-button-renderer, #comments-button",
      extra_delay: 12000,
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
      buffer = lines.pop() || "";

      for (const line of lines) {
        if (!line.trim()) continue;

        if (line.startsWith("data: ")) {
          try {
            const dataStr = line.slice(6).trim();
            if (!dataStr) continue;

            const event = JSON.parse(dataStr);

            if (event.status === "error" || event.type === "ERROR") {
              const errorMsg =
                event.message || event.error || "Unknown error from Mino AI";
              return NextResponse.json(
                { detail: String(errorMsg) },
                { status: 500 }
              );
            }

            if (event.type === "COMPLETE" && event.status === "COMPLETED") {
              let resultJson = event.resultJson || {};
              console.log("Raw event.resultJson:", event.resultJson);

              if (typeof resultJson === "string") {
                try {
                  resultJson = JSON.parse(resultJson);
                } catch (e) {
                  console.error("Failed to parse resultJson string:", e);
                }
              }
              console.log("Parsed resultJson:", resultJson);

              let comments: any[] = [];
              if (Array.isArray(resultJson)) {
                comments = resultJson;
              } else if (
                resultJson &&
                typeof resultJson === "object" &&
                "comments" in resultJson
              ) {
                comments = (resultJson as any).comments || [];
              } else if (resultJson && typeof resultJson === "object") {
                comments =
                  (resultJson as any).comments ||
                  (Array.isArray(resultJson) ? resultJson : []);
                // Try to find any array of objects that looks like comments
                if (!Array.isArray(comments) || comments.length === 0) {
                  for (const v of Object.values(resultJson)) {
                    if (Array.isArray(v) && v.length && typeof v[0] === "object") {
                      const looksLikeComment =
                        "full_comment_text" in (v[0] as any) ||
                        "text" in (v[0] as any) ||
                        "comment" in (v[0] as any);
                      if (looksLikeComment) {
                        comments = v as any[];
                        break;
                      }
                    }
                  }
                }
              }
              if (!Array.isArray(comments)) comments = [];

              const analysis = await analyzeComments(comments);

              return NextResponse.json({
                comments: analysis.comments,
                sentiment_breakdown: analysis.sentiment_breakdown,
                intent_breakdown: analysis.intent_breakdown,
                analysis_source: analysis.analysis_source,
                comment_count: comments.length,
              });
            }
          } catch {
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
