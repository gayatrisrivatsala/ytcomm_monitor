"use client";
import { useState } from "react";

export default function Home() {
  const [videoUrl, setVideoUrl] = useState("");
  const [comments, setComments] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

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
        body: JSON.stringify({ video_url: videoUrl }),
      });

      if (res.ok) {
        const data = await res.json();
        if (data.comments && data.comments.length > 0) {
          setComments(data.comments);
        } else {
          setError("No comments found. Try a different video.");
          setComments([]);
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
      }
    } catch (e: any) {
      const errorMsg = e.message || "Unknown error";
      if (errorMsg.includes("fetch")) {
        setError("API server not running? Start: python api_server.py");
      } else {
        setError(`Error: ${errorMsg}`);
      }
      setComments([]);
    }

    setLoading(false);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-500 via-purple-500 to-pink-500 p-8">
      <div className="max-w-6xl mx-auto">
        <div className="text-center mb-16">
          <h1 className="text-6xl font-black bg-gradient-to-r from-white via-gray-100 to-gray-300 bg-clip-text text-transparent mb-6">
            YouTube Comments Monitor
          </h1>
          <p className="text-2xl text-white/90 max-w-2xl mx-auto">
            Paste any YouTube URL → Extract top comments live with Mino AI
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
          <div className="text-white/90 text-lg mb-8 text-center">
            ✅ Found {comments.length} top comments!
          </div>
        )}

        <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-8">
          {comments.slice(0, 12).map((comment: any, i: number) => (
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
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
