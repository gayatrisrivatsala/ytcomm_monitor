"use client";
import { useState } from "react";

type Comment = {
  username: string;
  full_comment_text: string;
  like_count: number;
  time_posted: string;
  sentiment?: string;
  intent?: string;
};

type Analysis = {
  sentiment_breakdown?: Record<string, number>;
  intent_breakdown?: Record<string, number>;
  comment_count?: number;
  analysis_source?: string;
};

export default function Home() {
  const [videoUrl, setVideoUrl] = useState("");
  const [comments, setComments] = useState<Comment[]>([]);
  const [analysis, setAnalysis] = useState<Analysis>({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const sortedByLikes = (list: Comment[]) =>
    [...list].sort((a, b) => (b.like_count || 0) - (a.like_count || 0));

  const topPositive = sortedByLikes(
    comments.filter((c) => c.sentiment === "positive")
  ).slice(0, 3);
  const topNegative = sortedByLikes(
    comments.filter((c) => c.sentiment === "negative")
  ).slice(0, 3);
  const featureRequests = sortedByLikes(
    comments.filter((c) => c.intent === "feature request")
  ).slice(0, 3);
  const questions = sortedByLikes(
    comments.filter((c) => c.intent === "question")
  ).slice(0, 3);

  const extractComments = async () => {
    if (!videoUrl.trim()) {
      setError("Please paste a YouTube URL");
      return;
    }

    setLoading(true);
    setError("");

    try {
      // Use Next.js API route in production, or local FastAPI server in development
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || "/api";
      const res = await fetch(`${apiUrl}/extract-comments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ video_url: videoUrl, analyze: true }),
      });

      if (res.ok) {
        const data = await res.json();
        console.log("API Response:", data); // Debug log
        console.log("Comments:", data.comments); // Debug log

        if (data.comments && Array.isArray(data.comments) && data.comments.length > 0) {
          setComments(data.comments);
          setAnalysis({
            sentiment_breakdown: data.sentiment_breakdown,
            intent_breakdown: data.intent_breakdown,
            comment_count: data.comment_count,
            analysis_source: data.analysis_source,
          });
        } else {
          // Check if there's any data at all
          const hasAnyData = data && Object.keys(data).length > 0;
          if (hasAnyData) {
            console.warn("Unexpected response format:", data);
            setError(
              `No comments found. Response: ${JSON.stringify(data).substring(
                0,
                200
              )}`
            );
          } else {
            setError("No comments found. Try a different video.");
          }
          setComments([]);
          setAnalysis({});
        }
      } else {
        let errorMessage = "Check API server";
        try {
          const errorData = await res.json();
          console.log("Error response:", errorData); // Debug log

          if (errorData && typeof errorData === "object") {
            // Extract detail or message, ensuring it's a string
            const detail =
              errorData.detail || errorData.message || errorData.error;

            if (typeof detail === "string") {
              errorMessage = detail;
            } else if (typeof detail === "object") {
              errorMessage = JSON.stringify(detail);
            } else if (detail) {
              errorMessage = String(detail);
            } else {
              errorMessage = JSON.stringify(errorData);
            }
          } else if (typeof errorData === "string") {
            errorMessage = errorData;
          }
        } catch (parseError) {
          errorMessage = `HTTP ${res.status}: ${res.statusText}`;
        }
        setError(`Extraction failed: ${errorMessage}`);
        setComments([]);
        setAnalysis({});
      }
    } catch (e: any) {
      const errorMsg = e.message || "Unknown error";
      if (errorMsg.includes("fetch")) {
        setError("API server not running? Start: python api_server.py");
      } else {
        setError(`Error: ${errorMsg}`);
      }
      setComments([]);
      setAnalysis({});
    }

    setLoading(false);
  };

  return (
    <div className="min-h-screen p-8">
      <div className="max-w-6xl mx-auto">
        <div className="text-center mb-16">
          <h1 className="text-6xl font-black bg-gradient-to-r from-white via-gray-100 to-gray-300 bg-clip-text text-transparent mb-6">
            YouTube Comments Monitor
          </h1>
          <p className="text-2xl text-white/90 max-w-2xl mx-auto">
            Paste any YouTube URL → Extract top comments with Mino AI
          </p>
          <p className="text-sm text-white/80 mt-3">
            Need dashboards? Visit the Insights tab in the nav.
          </p>
        </div>

        {/* Fixed Input Form */}
        <div className="bg-black/20 backdrop-blur-2xl rounded-3xl p-10 mb-12">
          <div className="flex flex-col lg:flex-row gap-6">
            <input
              type="text"
              value={videoUrl}
              onChange={(e) => {
                setVideoUrl(e.target.value);
                setError(""); // Clear error on type
              }}
              onPaste={(e) => {
                const pastedText = e.clipboardData.getData("text");
                setVideoUrl(pastedText);
                setError("");
              }}
              placeholder="https://www.youtube.com/watch?v=... (paste any video)"
              className="flex-1 px-8 py-6 bg-white/70 hover:bg-white/80 rounded-3xl text-xl font-medium text-gray-900 placeholder:text-gray-500 border-2 border-white/30 focus:border-purple-400 focus:ring-4 focus:ring-purple-400/50 focus:outline-none transition-all duration-300 resize-none"
              autoComplete="off"
              spellCheck="false"
            />
            <button
              onClick={extractComments}
              disabled={loading || !videoUrl.trim()}
              className="px-16 py-6 bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 text-white text-xl font-bold rounded-3xl hover:shadow-2xl hover:-translate-y-2 transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed min-w-[200px]"
            >
              {loading ? "🔄 Extracting..." : "🎥 GET COMMENTS"}
            </button>
          </div>
          {error && (
            <p className="text-red-200 mt-4 text-center text-lg bg-red-500/20 p-4 rounded-2xl border border-red-400/50">
              {error}
            </p>
          )}
        </div>

        {/* Comments Grid */}
        {comments.length > 0 && (
          <div className="text-white/90 text-lg mb-8 text-center space-y-3">
            <div>✅ Found {comments.length} top comments!</div>
            {analysis.comment_count && (
              <div className="text-sm text-white/80">
                Analyzed with {analysis.analysis_source === "huggingface" ? "Hugging Face" : "local"} models · Source count:{" "}
                {analysis.comment_count}
              </div>
            )}
            {analysis.analysis_source === "skipped" && (
              <div className="text-sm text-amber-200">
                Add HUGGINGFACE_API_KEY to enable sentiment/intent insights.
              </div>
            )}
            {(analysis.sentiment_breakdown || analysis.intent_breakdown) && (
              <div className="flex flex-wrap justify-center gap-4 text-sm">
                {analysis.sentiment_breakdown && (
                  <div className="bg-white/20 px-4 py-2 rounded-2xl border border-white/30">
                    <span className="font-semibold mr-2">Sentiment:</span>
                    {Object.entries(analysis.sentiment_breakdown).map(([k, v]) => (
                      <span key={k} className="mr-3">
                        {k}: {v}
                      </span>
                    ))}
                  </div>
                )}
                {analysis.intent_breakdown && (
                  <div className="bg-white/20 px-4 py-2 rounded-2xl border border-white/30">
                    <span className="font-semibold mr-2">Intent:</span>
                    {Object.entries(analysis.intent_breakdown).map(([k, v]) => (
                      <span key={k} className="mr-3">
                        {k}: {v}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            )}
            {(analysis.sentiment_breakdown || analysis.intent_breakdown) && (
              <div className="bg-white/15 px-4 py-3 rounded-2xl text-sm text-white/90">
                {analysis.sentiment_breakdown && (
                  <div>
                    Dominant sentiment:{" "}
                    {Object.entries(analysis.sentiment_breakdown)
                      .sort((a, b) => (b[1] || 0) - (a[1] || 0))
                      .map(([k]) => k)[0] || "n/a"}
                  </div>
                )}
                {analysis.intent_breakdown && (
                  <div>
                    Top intent:{" "}
                    {Object.entries(analysis.intent_breakdown)
                      .sort((a, b) => (b[1] || 0) - (a[1] || 0))
                      .map(([k]) => k)[0] || "n/a"}
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* Insights Dashboard */}
        {comments.length > 0 && (
          <div className="grid md:grid-cols-2 gap-6 mb-12">
            <div className="bg-white/15 rounded-3xl p-6 border border-white/20">
              <h3 className="text-xl font-semibold text-white mb-3">
                Sentiment Pulse
              </h3>
              {analysis.sentiment_breakdown ? (
                <div className="space-y-2 text-white/90">
                  {Object.entries(analysis.sentiment_breakdown).map(([k, v]) => (
                    <div
                      key={k}
                      className="flex justify-between bg-white/10 rounded-2xl px-4 py-2"
                    >
                      <span className="capitalize">{k}</span>
                      <span className="font-bold">{v}</span>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-white/70">No sentiment data.</p>
              )}
            </div>

            <div className="bg-white/15 rounded-3xl p-6 border border-white/20">
              <h3 className="text-xl font-semibold text-white mb-3">
                Intent Mix
              </h3>
              {analysis.intent_breakdown ? (
                <div className="space-y-2 text-white/90">
                  {Object.entries(analysis.intent_breakdown).map(([k, v]) => (
                    <div
                      key={k}
                      className="flex justify-between bg-white/10 rounded-2xl px-4 py-2"
                    >
                      <span className="capitalize">{k}</span>
                      <span className="font-bold">{v}</span>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-white/70">No intent data.</p>
              )}
            </div>
          </div>
        )}

        {/* Actionable Insight Cards */}
        {comments.length > 0 && (
          <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-6 mb-12">
            <InsightCard
              title="Why people love it"
              items={topPositive}
              emptyText="No clear praise yet."
            />
            <InsightCard
              title="Where it hurts"
              items={topNegative}
              emptyText="No major complaints found."
            />
            <InsightCard
              title="Feature requests"
              items={featureRequests}
              emptyText="No feature asks detected."
            />
            <InsightCard
              title="Questions to answer"
              items={questions}
              emptyText="No questions detected."
            />
          </div>
        )}

        <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-8">
          {comments.slice(0, 12).map((comment: Comment, i: number) => (
            <div
              key={i}
              className="group bg-white/80 backdrop-blur-xl rounded-3xl p-8 hover:shadow-2xl hover:-translate-y-3 transition-all duration-300 hover:border hover:border-purple-300"
            >
              <div className="flex items-start gap-4 mb-6">
                <div className="w-14 h-14 bg-gradient-to-br from-purple-500 to-pink-500 rounded-2xl flex items-center justify-center text-white font-bold text-lg flex-shrink-0 shadow-lg">
                  {comment.username.slice(1, 3).toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="font-bold text-xl text-gray-900 truncate pr-4">
                    {comment.username}
                  </h3>
                  <div className="text-sm text-gray-600 font-medium">
                    {comment.time_posted} •{" "}
                    {comment.like_count.toLocaleString()} likes
                  </div>
                </div>
              </div>
              <p className="text-gray-800 leading-relaxed text-base line-clamp-4 group-hover:line-clamp-none">
                {comment.full_comment_text}
              </p>
              {(comment.sentiment || comment.intent) && (
                <div className="mt-4 flex flex-wrap gap-2 text-xs font-semibold text-gray-700">
                  {comment.sentiment && (
                    <span className="px-3 py-1 bg-green-100 text-green-700 rounded-full">
                      {comment.sentiment}
                    </span>
                  )}
                  {comment.intent && (
                    <span className="px-3 py-1 bg-blue-100 text-blue-700 rounded-full">
                      {comment.intent}
                    </span>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

type InsightCardProps = {
  title: string;
  items: Comment[];
  emptyText: string;
};

function InsightCard({ title, items, emptyText }: InsightCardProps) {
  return (
    <div className="bg-white/80 backdrop-blur-xl rounded-3xl p-6 border border-white/50 shadow-lg">
      <h4 className="text-lg font-bold text-gray-900 mb-4">{title}</h4>
      {items.length === 0 && (
        <p className="text-gray-600 text-sm">{emptyText}</p>
      )}
      <div className="space-y-4">
        {items.map((comment, idx) => (
          <div key={idx} className="bg-white/70 rounded-2xl p-4 border border-gray-100">
            <div className="flex justify-between text-sm text-gray-600 mb-2">
              <span className="font-semibold text-gray-900 truncate pr-2">
                {comment.username}
              </span>
              <span className="text-gray-700">
                {comment.like_count.toLocaleString()} 👍
              </span>
            </div>
            <p className="text-gray-800 text-sm leading-relaxed line-clamp-3">
              {comment.full_comment_text}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}
