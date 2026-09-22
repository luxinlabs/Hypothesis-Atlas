"use client";

import { useState } from "react";
import MathText from "./MathText";
import { EXPERIMENT_DOMAINS, type ExperimentDomain, type ProofResult } from "@/lib/experiments/types";

interface ProveClaimPanelProps {
  jobId: string;
}

const VERDICT_STYLE: Record<string, string> = {
  verified: "bg-emerald-50 text-emerald-700",
  failed: "bg-red-50 text-red-600",
  incomplete: "bg-amber-50 text-amber-700",
  error: "bg-gray-100 text-gray-500",
};

const VERDICT_LABEL: Record<string, string> = {
  verified: "Verified",
  failed: "Failed to verify",
  incomplete: "Incomplete",
  error: "Error",
};

export default function ProveClaimPanel({ jobId }: ProveClaimPanelProps) {
  const [domain, setDomain] = useState<ExperimentDomain>("math");
  const [claim, setClaim] = useState("");
  const [proving, setProving] = useState(false);
  const [result, setResult] = useState<ProofResult | null>(null);
  const [error, setError] = useState("");
  const [showLean, setShowLean] = useState(false);

  const handleProve = async () => {
    if (!claim.trim()) return;
    setProving(true);
    setError("");
    setResult(null);
    try {
      const res = await fetch(`/api/jobs/${jobId}/experiments/prove`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ claim }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.error ?? `Proof attempt failed (${res.status})`);
        return;
      }
      const data = (await res.json()) as ProofResult;
      setResult(data);
    } catch {
      setError("Could not reach the proof verification service.");
    } finally {
      setProving(false);
    }
  };

  const lastAttempt = result?.attempts[result.attempts.length - 1];

  return (
    <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden flex flex-col">
      <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between">
        <div className="flex items-center gap-2 min-w-0">
          <span className="w-2 h-2 bg-indigo-500 rounded-full flex-shrink-0" />
          <span className="text-sm font-semibold text-gray-700">Prove a Claim</span>
        </div>
        {result && (
          <span
            className={`text-[11px] font-semibold px-2 py-0.5 rounded-full ${
              VERDICT_STYLE[result.verdict]
            }`}
          >
            {result.hasSorry ? "Contains sorry" : VERDICT_LABEL[result.verdict]}
          </span>
        )}
      </div>

      <div className="px-4 pt-3 flex flex-wrap gap-1.5">
        {EXPERIMENT_DOMAINS.map((d) => (
          <button
            key={d.id}
            onClick={() => d.available && setDomain(d.id)}
            disabled={!d.available}
            title={d.available ? undefined : "Coming soon"}
            className={`text-[11px] font-semibold px-2.5 py-1 rounded-full transition-colors ${
              domain === d.id
                ? "bg-indigo-600 text-white"
                : d.available
                  ? "bg-gray-100 text-gray-600 hover:bg-gray-200"
                  : "bg-gray-50 text-gray-300 cursor-not-allowed"
            }`}
          >
            {d.label}
            {!d.available && " · soon"}
          </button>
        ))}
      </div>

      {domain !== "math" ? (
        <div className="px-4 py-6 text-xs text-gray-400 text-center">
          {EXPERIMENT_DOMAINS.find((d) => d.id === domain)?.label} experiments are coming in a
          future release — see V3-EXPERIMENTS-PLAN.md.
        </div>
      ) : (
      <>
      <div className="px-4 py-3 space-y-3 text-xs text-gray-600 leading-relaxed">
        <p>
          State a mathematical claim in LaTeX or plain English. It's autoformalized into{" "}
          <strong>Lean 4 + Mathlib</strong> and checked against a real proof assistant —
          not just an LLM self-report.
        </p>
        <textarea
          value={claim}
          onChange={(e) => setClaim(e.target.value)}
          placeholder="e.g. For all naturals n, the sum 1 + 2 + ... + n equals n(n+1)/2."
          rows={3}
          className="w-full rounded-xl border border-gray-200 px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-indigo-200 resize-none"
        />
        {claim.trim() && (
          <div className="rounded-lg bg-gray-50 border border-gray-100 px-3 py-2">
            <MathText text={claim} className="text-xs text-gray-700" />
          </div>
        )}
        <button
          onClick={handleProve}
          disabled={!claim.trim() || proving}
          className="w-full py-2 rounded-xl text-sm font-semibold text-white transition-colors disabled:opacity-40"
          style={{ background: "linear-gradient(135deg, #4f46e5, #6366f1)" }}
        >
          {proving ? "Formalizing & checking…" : "Prove claim"}
        </button>
        {error && <p className="text-[11px] text-red-500">{error}</p>}
      </div>

      {result && (
        <div className="border-t border-gray-100 px-4 py-3 space-y-2">
          {result.note && <p className="text-[11px] text-gray-500">{result.note}</p>}
          {lastAttempt && (
            <div>
              <button
                onClick={() => setShowLean((v) => !v)}
                className="text-[11px] font-semibold text-indigo-600 hover:underline"
              >
                {showLean ? "Hide" : "Show"} generated Lean code
              </button>
              {showLean && (
                <pre className="mt-2 rounded-lg bg-gray-900 text-gray-100 text-[11px] px-3 py-2 overflow-x-auto whitespace-pre-wrap">
                  {lastAttempt.leanCode}
                </pre>
              )}
              {lastAttempt.diagnostics && (
                <pre className="mt-2 rounded-lg bg-red-50 text-red-700 text-[11px] px-3 py-2 overflow-x-auto whitespace-pre-wrap">
                  {lastAttempt.diagnostics}
                </pre>
              )}
            </div>
          )}
        </div>
      )}
      </>
      )}
    </div>
  );
}
