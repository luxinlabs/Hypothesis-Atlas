"use client";

import { useState } from "react";
import MathText from "./MathText";

interface ChatMessage {
  role: string;
  content: string;
}

interface ClaimResult {
  claim: string;
  expression: string;
  expected: string;
  computed: number | null;
  ok: boolean | null;
  note?: string;
}

interface ExperimentsPanelProps {
  jobId: string;
  messages: ChatMessage[];
}

function fmt(n: number): string {
  if (!isFinite(n)) return "—";
  return Math.abs(n) >= 1000 ? n.toLocaleString() : String(Number(n.toPrecision(6)));
}

export default function ExperimentsPanel({ jobId, messages }: ExperimentsPanelProps) {
  const [verifying, setVerifying] = useState(false);
  const [results, setResults] = useState<ClaimResult[] | null>(null);
  const [error, setError] = useState("");

  const transcript = messages.filter(
    (m) => (m.role === "user" || m.role === "assistant") && m.content.trim().length > 0
  );
  const ready = transcript.filter((m) => m.role === "assistant").length > 0;

  const handleVerify = async () => {
    setVerifying(true);
    setError("");
    try {
      const res = await fetch(`/api/jobs/${jobId}/experiments/verify`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: transcript }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.error ?? `Verification failed (${res.status})`);
        return;
      }
      const data = await res.json();
      setResults(Array.isArray(data.results) ? data.results : []);
    } catch {
      setError("Could not reach the verification service.");
    } finally {
      setVerifying(false);
    }
  };

  const checked = results?.filter((r) => r.ok !== null) ?? [];
  const passed = checked.filter((r) => r.ok === true).length;
  const failed = checked.filter((r) => r.ok === false).length;

  return (
    <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden flex flex-col">
      <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between">
        <div className="flex items-center gap-2 min-w-0">
          <span className="w-2 h-2 bg-violet-500 rounded-full flex-shrink-0" />
          <span className="text-sm font-semibold text-gray-700">Verify Quantitative Claims</span>
        </div>
        {results && checked.length > 0 && (
          <span
            className={`text-[11px] font-semibold px-2 py-0.5 rounded-full ${
              failed === 0 ? "bg-emerald-50 text-emerald-700" : "bg-red-50 text-red-600"
            }`}
          >
            {passed}/{checked.length} verified
          </span>
        )}
      </div>

      <div className="px-4 py-3 space-y-3 text-xs text-gray-600 leading-relaxed">
        <p>
          The assistant&rsquo;s experiment plan makes quantitative claims (sample sizes, expected
          gains, metric values). This panel re-evaluates each one with{" "}
          <strong>mathjs</strong> — the same expression evaluator family behind Math-Verify —
          and flags any mismatch.
        </p>
        <button
          onClick={handleVerify}
          disabled={!ready || verifying}
          className="w-full py-2 rounded-xl text-sm font-semibold text-white transition-colors disabled:opacity-40"
          style={{ background: "linear-gradient(135deg, #8b5cf6, #6366f1)" }}
        >
          {verifying ? "Checking claims…" : "Verify plan"}
        </button>
        {!ready && (
          <p className="text-[11px] text-gray-400">Chat a plan first — then verify its numbers.</p>
        )}
        {error && <p className="text-[11px] text-red-500">{error}</p>}
      </div>

      {results && (
        <div className="border-t border-gray-100 px-4 py-3 space-y-2 max-h-72 overflow-y-auto">
          {results.length === 0 && (
            <p className="text-xs text-gray-500">
              No machine-checkable quantitative claims found in the plan yet. Ask the assistant to
              state expected results as arithmetic (e.g. &ldquo;0.843 − 0.812 = 0.031&rdquo;).
            </p>
          )}
          {results.map((r, i) => (
            <div key={i} className="rounded-lg border border-gray-100 bg-gray-50 px-3 py-2 space-y-1">
              <div className="flex items-start gap-2">
                <span
                  className={`mt-0.5 w-4 h-4 rounded-full flex items-center justify-center text-[10px] font-bold text-white flex-shrink-0 ${
                    r.ok === true ? "bg-emerald-500" : r.ok === false ? "bg-red-500" : "bg-amber-400"
                  }`}
                >
                  {r.ok === true ? "✓" : r.ok === false ? "✗" : "!"}
                </span>
                <p className="text-xs font-medium text-gray-800 leading-snug">{r.claim}</p>
              </div>
              <div className="pl-6 space-y-0.5">
                <p className="text-[11px] text-gray-500 font-mono">
                  <MathText text={`$${r.expression}$`} /> → computed{" "}
                  <span className="font-semibold text-gray-700">
                    {r.computed === null ? "—" : fmt(r.computed)}
                  </span>
                  {r.computed !== null && `, expected ${fmt(Number(r.expected))}`}
                </p>
                {r.note && <p className="text-[11px] text-gray-400 italic">{r.note}</p>}
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="mt-auto px-4 py-2 border-t border-gray-100 bg-gray-50">
        <p className="text-[10px] text-gray-400 leading-snug">
          Math rendered with KaTeX · expressions evaluated with mathjs · Math-Verify available for
          Python-grade equivalence checks
        </p>
      </div>
    </div>
  );
}
