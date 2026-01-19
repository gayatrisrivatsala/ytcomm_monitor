import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import Link from "next/link";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "YouTube Comment Insights",
  description: "Extract, analyze, and summarize audience feedback",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        <div className="min-h-screen bg-gradient-to-br from-indigo-500 via-purple-500 to-pink-500">
          <header className="bg-black/30 backdrop-blur border-b border-white/10">
            <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between text-white">
              <Link href="/" className="text-2xl font-black tracking-tight">
                Mino Insights
              </Link>
              <nav className="flex gap-4 text-sm font-semibold">
                <Link
                  href="/"
                  className="px-3 py-1 rounded-full hover:bg-white/10 transition"
                >
                  Extract
                </Link>
                <Link
                  href="/insights"
                  className="px-3 py-1 rounded-full hover:bg-white/10 transition"
                >
                  Insights
                </Link>
              </nav>
            </div>
          </header>
          {children}
        </div>
      </body>
    </html>
  );
}
