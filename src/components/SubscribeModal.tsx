"use client";

import { useState } from "react";

interface SubscribeModalProps {
  topic: string;
  onClose: () => void;
  theme?: "dark" | "light" | "vibrant";
}

const FREQUENCY_OPTIONS = [
  { value: 5, label: "5 papers", desc: "A focused weekly digest" },
  { value: 10, label: "10 papers", desc: "Balanced coverage" },
  { value: 20, label: "20 papers", desc: "Deep dive — every relevant paper" },
];

export default function SubscribeModal({ topic, onClose, theme = "light" }: SubscribeModalProps) {
  const [email, setEmail] = useState("");
  const [frequency, setFrequency] = useState(10);
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState("");

  const isDark = theme === "dark";

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setError("Please enter a valid email address.");
      return;
    }
    setLoading(true);
    try {
      const res = await fetch("/api/subscriptions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, topic, frequency }),
      });
      if (!res.ok) {
        const data = await res.json();
        setError(data.error ?? "Something went wrong.");
        return;
      }
      setDone(true);
    } catch {
      setError("Network error — please try again.");
    } finally {
      setLoading(false);
    }
  };

  const overlay = isDark ? "bg-black/70" : "bg-black/50";
  const panel = isDark ? "bg-zinc-900 border-zinc-700 text-zinc-100" : "bg-white border-gray-200 text-gray-900";
  const sub = isDark ? "text-zinc-400" : "text-gray-500";
  const inputCls = isDark
    ? "bg-zinc-800 border-zinc-600 text-zinc-100 placeholder-zinc-500 focus:ring-indigo-400"
    : "bg-white border-gray-300 text-gray-900 placeholder-gray-400 focus:ring-indigo-400";
  const optionBase = isDark
    ? "border-zinc-700 hover:border-indigo-500 hover:bg-indigo-500/10"
    : "border-gray-200 hover:border-indigo-400 hover:bg-indigo-50";
  const optionActive = isDark
    ? "border-indigo-400 bg-indigo-500/20"
    : "border-indigo-500 bg-indigo-50";

  return (
    <div
      className={`fixed inset-0 z-50 flex items-center justify-center p-4 ${overlay}`}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className={`w-full max-w-md rounded-2xl border shadow-2xl p-6 ${panel}`}>
        {done ? (
          /* ── Success state ── */
          <div className="text-center py-4">
            <div className="w-14 h-14 rounded-full flex items-center justify-center mx-auto mb-4"
              style={{ background: "linear-gradient(135deg, #4f46e5, #9333ea)" }}>
              <svg className="w-7 h-7 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <h3 className="text-lg font-bold mb-1">You're subscribed!</h3>
            <p className={`text-sm mb-1 ${sub}`}>
              We'll send <span className="font-semibold text-indigo-500">{frequency} papers / week</span> on:
            </p>
            <p className={`text-xs font-semibold px-3 py-1 rounded-full inline-block mb-4 ${isDark ? "bg-indigo-500/20 text-indigo-300" : "bg-indigo-100 text-indigo-700"}`}>
              {topic}
            </p>
            <p className={`text-xs ${sub}`}>Digest delivered to <span className="font-medium">{email}</span></p>
            <button
              onClick={onClose}
              className="mt-5 w-full py-2.5 rounded-xl font-semibold text-sm text-white"
              style={{ background: "linear-gradient(to right, #4f46e5, #9333ea)" }}
            >
              Done
            </button>
          </div>
        ) : (
          /* ── Subscribe form ── */
          <form onSubmit={handleSubmit}>
            {/* Header */}
            <div className="flex items-start justify-between mb-5">
              <div>
                <h3 className="text-base font-bold">Subscribe to Weekly Papers</h3>
                <p className={`text-xs mt-0.5 ${sub}`}>Get the latest research delivered to your inbox</p>
              </div>
              <button type="button" onClick={onClose}
                className={`p-1.5 rounded-lg transition-colors ${isDark ? "hover:bg-zinc-700 text-zinc-400" : "hover:bg-gray-100 text-gray-400"}`}>
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Selected topic chip */}
            <div className="mb-5">
              <p className={`text-xs font-semibold uppercase tracking-wide mb-1.5 ${sub}`}>Topic</p>
              <div className={`flex items-center gap-2 px-3 py-2 rounded-xl border ${isDark ? "bg-indigo-500/10 border-indigo-500/30" : "bg-indigo-50 border-indigo-200"}`}>
                <svg className="w-4 h-4 text-indigo-500 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />
                </svg>
                <span className="text-sm font-semibold text-indigo-600 truncate">{topic}</span>
              </div>
            </div>

            {/* Email */}
            <div className="mb-5">
              <label className={`block text-xs font-semibold uppercase tracking-wide mb-1.5 ${sub}`}>
                Your email
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                required
                className={`w-full rounded-xl border px-4 py-2.5 text-sm outline-none focus:ring-2 transition ${inputCls}`}
              />
            </div>

            {/* Frequency */}
            <div className="mb-5">
              <label className={`block text-xs font-semibold uppercase tracking-wide mb-2 ${sub}`}>
                Papers per week
              </label>
              <div className="grid grid-cols-3 gap-2">
                {FREQUENCY_OPTIONS.map((opt) => (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => setFrequency(opt.value)}
                    className={`rounded-xl border p-3 text-left transition-all ${
                      frequency === opt.value ? optionActive : optionBase
                    }`}
                  >
                    <p className={`text-sm font-bold ${frequency === opt.value ? "text-indigo-600" : ""}`}>
                      {opt.label}
                    </p>
                    <p className={`text-xs mt-0.5 ${sub}`}>{opt.desc}</p>
                  </button>
                ))}
              </div>
            </div>

            {error && (
              <p className="text-xs text-red-500 mb-3">{error}</p>
            )}

            <button
              type="submit"
              disabled={loading || !email}
              className="w-full py-2.5 rounded-xl font-semibold text-sm text-white disabled:opacity-50 flex items-center justify-center gap-2"
              style={{ background: "linear-gradient(to right, #4f46e5, #9333ea)" }}
            >
              {loading ? (
                <><div className="animate-spin h-4 w-4 border-2 border-white border-t-transparent rounded-full" /> Subscribing…</>
              ) : (
                <><svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                </svg> Subscribe</>
              )}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
