// SPDX-License-Identifier: AGPL-3.0-only
"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

const EXAMPLE =
  "I want to have more knowledge and research about the new drug for Type 2 Diabetes.";

/**
 * "Try Something Bold" — an unconstrained free-text on-ramp into the same
 * evidence-mapping pipeline the word-cloud flow uses. No topic list, no
 * domain picker — just type the idea in your own words. A small tag/refine
 * step (see /api/bold-ideas) categorizes it before handing it to the
 * existing pipeline, and it shows up under its own "Bold Idea" tab on My
 * Research, tags and all.
 */
export default function BoldIdeaPage() {
  const router = useRouter();
  const [text, setText] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit() {
    const trimmed = text.trim();
    if (!trimmed || submitting) return;
    setSubmitting(true);
    setError("");
    try {
      const res = await fetch("/api/bold-ideas", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: trimmed }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.jobId) {
        setError(data.error ?? "Could not start this idea — try again.");
        setSubmitting(false);
        return;
      }
      localStorage.setItem("lastJobId", data.jobId);
      router.push(`/bold-idea/session/${data.jobId}`);
    } catch {
      setError("Could not reach the server — is the dev server running?");
      setSubmitting(false);
    }
  }

  return (
    <main className="min-h-screen bg-gradient-to-br from-orange-50 via-white to-pink-50 text-gray-900">
      <div className="max-w-2xl mx-auto px-6 py-16">
        <Link
          href="/explore"
          className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700 mb-8"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          Back to Topic Explorer
        </Link>

        <div className="text-center mb-8">
          <span className="text-5xl">✨</span>
          <h1 className="text-3xl font-bold mt-3" style={{ background: "linear-gradient(135deg, #f97316, #db2777)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>
            Try Something Bold
          </h1>
          <p className="text-gray-500 mt-2 max-w-md mx-auto">
            Skip the word cloud. Type any research idea, in your own words — it'll be automatically
            tagged across whatever subjects it actually touches, even if that's more than one.
          </p>
        </div>

        <div className="rounded-3xl border border-gray-200 bg-white shadow-xl p-2">
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder={EXAMPLE}
            rows={5}
            autoFocus
            className="w-full rounded-2xl px-4 py-3 text-base leading-relaxed focus:outline-none resize-none"
          />
          <div className="flex items-center justify-between px-3 pb-2">
            <button
              onClick={() => setText(EXAMPLE)}
              className="text-xs font-medium text-pink-600 bg-pink-50 hover:bg-pink-100 px-2.5 py-1 rounded-full"
            >
              Use example
            </button>
            <button
              onClick={handleSubmit}
              disabled={!text.trim() || submitting}
              className="px-6 py-2.5 rounded-xl text-sm font-semibold text-white shadow-md transition-all disabled:opacity-40 flex items-center gap-2"
              style={{ background: "linear-gradient(135deg, #f97316, #db2777)" }}
            >
              {submitting ? (
                <>
                  <span className="w-3.5 h-3.5 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                  Categorizing…
                </>
              ) : (
                "Explore this idea →"
              )}
            </button>
          </div>
        </div>
        {error && <p className="text-sm text-red-500 mt-3 text-center">{error}</p>}

        <p className="text-xs text-gray-400 mt-6 text-center">
          This becomes a research run like any other — find it later under{" "}
          <Link href="/jobs" className="underline hover:text-gray-600">
            My Research → Bold Idea
          </Link>
          .
        </p>
      </div>
    </main>
  );
}
