"use client";
import { useMemo, useState } from "react";

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

export default function InsightsPage() {
  const [videoUrl, setVideoUrl] = useState("");
  const [comments, setComments] = useState<Comment[]>([]);
  const [analysis, setAnalysis] = useState<Analysis>({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const fetchData = async () => {
    if (!videoUrl.trim()) {
      setError("Paste a YouTube URL first.");
      return;
    }
    setLoading(true);
    setError("");
    try {
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || "/api";
      const res = await fetch(`${apiUrl}/extract-comments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ video_url: videoUrl, analyze: true }),
      });
      if (!res.ok) {
        const msg = await res.text();
        throw new Error(msg || `HTTP ${res.status}`);
      }
      const data = await res.json();
      if (Array.isArray(data.comments) && data.comments.length > 0) {
        setComments(data.comments);
        setAnalysis({
          sentiment_breakdown: data.sentiment_breakdown,
          intent_breakdown: data.intent_breakdown,
          comment_count: data.comment_count,
          analysis_source: data.analysis_source,
        });
      } else {
        setComments([]);
        setAnalysis({});
        setError("No comments found. Try another video.");
      }
    } catch (err: any) {
      setError(err.message || "Request failed");
      setComments([]);
      setAnalysis({});
    }
    setLoading(false);
  };

  const total = useMemo(
    () => analysis.comment_count || comments.length || 0,
    [analysis.comment_count, comments.length]
  );

  const percentage = (count?: number) =>
    total > 0 && count !== undefined ? Math.round((count / total) * 100) : 0;

  const sortedByLikes = (list: Comment[]) =>
    [...list].sort((a, b) => (b.like_count || 0) - (a.like_count || 0));

  const highlights = useMemo(
    () => ({
      positive: sortedByLikes(
        comments.filter((c) => c.sentiment === "positive")
      ).slice(0, 3),
      negative: sortedByLikes(
        comments.filter((c) => c.sentiment === "negative")
      ).slice(0, 3),
      feature: sortedByLikes(
        comments.filter((c) => c.intent === "feature request")
      ).slice(0, 3),
      questions: sortedByLikes(
        comments.filter((c) => c.intent === "question")
      ).slice(0, 3),
    }),
    [comments]
  );

  return (
    <main className="max-w-6xl mx-auto px-6 py-10 text-white">
      <div className="mb-10">
        <h1 className="text-4xl md:text-5xl font-black leading-tight">
          Audience Insights
        </h1>
        <p className="text-white/80 text-lg md:text-xl mt-2 max-w-3xl">
          Extract comments, classify sentiment and intent, and see the key
          takeaways for your video in one place.
        </p>
      </div>

      <section className="bg-black/25 backdrop-blur-2xl border border-white/10 rounded-3xl p-6 md:p-8 mb-10">
        <div className="flex flex-col md:flex-row gap-4">
          <input
            className="flex-1 px-5 py-4 rounded-2xl bg-white/70 text-gray-900 text-lg border-2 border-white/40 focus:border-purple-400 focus:ring-4 focus:ring-purple-400/40 outline-none"
            placeholder="https://www.youtube.com/watch?v=..."
            value={videoUrl}
            onChange={(e) => {
              setVideoUrl(e.target.value);
              setError("");
            }}
          />
          <button
            onClick={fetchData}
            disabled={loading || !videoUrl.trim()}
            className="px-8 py-4 rounded-2xl text-lg font-semibold bg-gradient-to-r from-purple-600 to-pink-600 disabled:opacity-60 disabled:cursor-not-allowed shadow-lg hover:-translate-y-1 transition"
          >
            {loading ? "Analyzing..." : "Get Insights"}
          </button>
        </div>
        {error && (
          <p className="mt-4 text-red-200 bg-red-500/15 border border-red-300/40 rounded-2xl px-4 py-3">
            {error}
          </p>
        )}
      </section>

      {comments.length > 0 && (
        <>
          {/* KPI Cards */}
          <section className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
            <KPICard
              label="Comments analyzed"
              value={total.toLocaleString()}
              hint={
                analysis.analysis_source === "huggingface"
                  ? "Hugging Face models"
                  : "Analysis available"
              }
            />
            <KPICard
              label="Positive"
              value={analysis.sentiment_breakdown?.positive ?? 0}
              hint={`${percentage(analysis.sentiment_breakdown?.positive)}%`}
            />
            <KPICard
              label="Neutral"
              value={analysis.sentiment_breakdown?.neutral ?? 0}
              hint={`${percentage(analysis.sentiment_breakdown?.neutral)}%`}
            />
            <KPICard
              label="Negative"
              value={analysis.sentiment_breakdown?.negative ?? 0}
              hint={`${percentage(analysis.sentiment_breakdown?.negative)}%`}
            />
          </section>

          {/* Sentiment + Intent Bars */}
          <section className="grid md:grid-cols-2 gap-6 mb-10">
            <BarCard
              title="Sentiment pulse"
              data={analysis.sentiment_breakdown}
              total={total}
            />
            <BarCard
              title="Intent mix"
              data={analysis.intent_breakdown}
              total={total}
            />
          </section>

          {/* Highlights */}
          <section className="grid md:grid-cols-2 xl:grid-cols-4 gap-6 mb-12">
            <HighlightCard
              title="Why people love it"
              items={highlights.positive}
              tone="positive"
              empty="No clear praise yet."
            />
            <HighlightCard
              title="Where it hurts"
              items={highlights.negative}
              tone="negative"
              empty="No major complaints."
            />
            <HighlightCard
              title="Feature requests"
              items={highlights.feature}
              tone="info"
              empty="No feature asks detected."
            />
            <HighlightCard
              title="Questions to answer"
              items={highlights.questions}
              tone="info"
              empty="No questions detected."
            />
          </section>

          {/* Comment list */}
          <section className="bg-white/10 border border-white/15 rounded-3xl p-6 mb-12">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-xl font-semibold">All extracted comments</h3>
              <span className="text-sm text-white/70">
                Showing {Math.min(comments.length, 50)} of {comments.length}
              </span>
            </div>
            <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-4">
              {comments.slice(0, 50).map((c, i) => (
                <div
                  key={i}
                  className="bg-white/80 rounded-2xl p-4 text-gray-900 border border-white/60 shadow-sm"
                >
                  <div className="flex items-center justify-between text-sm text-gray-700 mb-2">
                    <span className="font-semibold truncate pr-2">
                      {c.username}
                    </span>
                    <span>{c.like_count.toLocaleString()} 👍</span>
                  </div>
                  <p className="text-sm text-gray-800 leading-relaxed line-clamp-4">
                    {c.full_comment_text}
                  </p>
                  <div className="flex gap-2 mt-3 text-xs font-semibold text-gray-700">
                    {c.sentiment && (
                      <span className="px-3 py-1 rounded-full bg-green-100 text-green-700">
                        {c.sentiment}
                      </span>
                    )}
                    {c.intent && (
                      <span className="px-3 py-1 rounded-full bg-blue-100 text-blue-700">
                        {c.intent}
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </section>
        </>
      )}
    </main>
  );
}

type KPICardProps = { label: string; value: string | number; hint?: string };
function KPICard({ label, value, hint }: KPICardProps) {
  return (
    <div className="bg-white/15 rounded-3xl p-4 border border-white/20">
      <div className="text-sm text-white/70">{label}</div>
      <div className="text-3xl font-bold mt-1">{value}</div>
      {hint && <div className="text-xs text-white/60 mt-1">{hint}</div>}
    </div>
  );
}

type BarCardProps = {
  title: string;
  data?: Record<string, number>;
  total: number;
};
function BarCard({ title, data, total }: BarCardProps) {
  const entries = data ? Object.entries(data) : [];
  return (
    <div className="bg-white/15 rounded-3xl p-6 border border-white/20">
      <h4 className="text-lg font-semibold mb-4">{title}</h4>
      {entries.length === 0 ? (
        <p className="text-white/70 text-sm">No data yet.</p>
      ) : (
        <div className="space-y-3">
          {entries.map(([k, v]) => {
            const pct = total > 0 ? Math.round((v / total) * 100) : 0;
            return (
              <div key={k}>
                <div className="flex justify-between text-sm text-white/80 mb-1">
                  <span className="capitalize">{k}</span>
                  <span>
                    {v} • {pct}%
                  </span>
                </div>
                <div className="w-full h-2 bg-white/10 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-purple-400 to-pink-500"
                    style={{ width: `${pct}%` }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

type HighlightCardProps = {
  title: string;
  items: Comment[];
  empty: string;
  tone: "positive" | "negative" | "info";
};
function HighlightCard({ title, items, empty, tone }: HighlightCardProps) {
  const toneClasses =
    tone === "positive"
      ? "bg-green-100 text-green-800"
      : tone === "negative"
      ? "bg-red-100 text-red-800"
      : "bg-blue-100 text-blue-800";

  return (
    <div className="bg-white/80 rounded-3xl p-5 text-gray-900 border border-white/50 shadow-lg">
      <h4 className="text-lg font-bold mb-3">{title}</h4>
      {items.length === 0 ? (
        <p className="text-gray-600 text-sm">{empty}</p>
      ) : (
        <div className="space-y-3">
          {items.map((c, i) => (
            <div key={i} className="bg-white rounded-2xl p-3 border border-gray-100">
              <div className="flex items-center justify-between text-xs text-gray-600 mb-2">
                <span className="font-semibold text-gray-900 truncate pr-2">
                  {c.username}
                </span>
                <span>{c.like_count.toLocaleString()} 👍</span>
              </div>
              <p className="text-sm text-gray-800 leading-relaxed line-clamp-3">
                {c.full_comment_text}
              </p>
              <div className="flex gap-2 mt-2 text-[11px] font-semibold">
                {c.sentiment && (
                  <span className={`px-3 py-1 rounded-full ${toneClasses}`}>
                    {c.sentiment}
                  </span>
                )}
                {c.intent && (
                  <span className="px-3 py-1 rounded-full bg-purple-100 text-purple-800">
                    {c.intent}
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
