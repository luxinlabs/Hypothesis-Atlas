"use client";

import { useEffect, useState } from "react";
import MathText from "./MathText";
import {
  EXPERIMENT_DOMAINS,
  type ClaimStatus,
  type ExperimentDomain,
  type ExperimentRecord,
  type MathResult,
} from "@/lib/experiments/types";

interface ProveClaimPanelProps {
  jobId: string;
}

const EXAMPLE_CLAIMS: { label: string; value: string }[] = [
  { label: "Sum formula", value: "For all naturals n, the sum 1 + 2 + ... + n equals n(n+1)/2." },
  { label: "Parity", value: "For any natural number n, n^2 + n is even." },
  {
    label: "Sum of squares (LaTeX)",
    value: "$$\\forall n \\in \\mathbb{N},\\ \\sum_{k=1}^{n} k^2 = \\frac{n(n+1)(2n+1)}{6}$$",
  },
];

const STATUS_STYLE: Record<ClaimStatus, string> = {
  verified: "bg-emerald-50 text-emerald-700",
  failed: "bg-red-50 text-red-600",
  incomplete: "bg-amber-50 text-amber-700",
  flagged: "bg-amber-50 text-amber-700",
  error: "bg-gray-100 text-gray-500",
  ready: "bg-indigo-50 text-indigo-600",
  draft: "bg-gray-100 text-gray-500",
  formalizing: "bg-indigo-50 text-indigo-400",
  verifying: "bg-indigo-50 text-indigo-400",
};

const STATUS_LABEL: Record<ClaimStatus, string> = {
  verified: "Verified",
  failed: "Failed",
  incomplete: "Incomplete",
  flagged: "Flagged for review",
  error: "Error",
  ready: "Ready to verify",
  draft: "Draft",
  formalizing: "Formalizing…",
  verifying: "Verifying…",
};

type FetchOutcome<T> = { ok: true; data: T } | { ok: false; message: string };

/**
 * fetch + JSON parsing with a distinct message per failure mode, instead of
 * one generic "could not reach the service" catch-all that fires equally for
 * "server isn't running", "server crashed mid-response", and "request
 * succeeded but returned something unexpected".
 */
async function requestJson<T>(url: string, method: string, body?: unknown): Promise<FetchOutcome<T>> {
  let res: Response;
  try {
    res = await fetch(url, {
      method,
      headers: body !== undefined ? { "Content-Type": "application/json" } : undefined,
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
  } catch {
    return { ok: false, message: "Could not reach the server — is the dev server running?" };
  }
  let data: unknown;
  try {
    data = await res.json();
  } catch {
    return {
      ok: false,
      message: `Server returned an unreadable response (HTTP ${res.status}) — check the server logs.`,
    };
  }
  if (!res.ok) {
    const message =
      (typeof data === "object" && data && "error" in data && String((data as { error: unknown }).error)) ||
      `Request failed (HTTP ${res.status})`;
    return { ok: false, message };
  }
  return { ok: true, data: data as T };
}

export default function ProveClaimPanel({ jobId }: ProveClaimPanelProps) {
  const [domain, setDomain] = useState<ExperimentDomain>("math");
  const [experiments, setExperiments] = useState<ExperimentRecord[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [newClaim, setNewClaim] = useState("");
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState("");
  const [loaded, setLoaded] = useState(false);

  // Experiments are persisted server-side (see prisma Experiment model)
  // rather than in localStorage, so a session survives across devices/tabs
  // and can eventually be linked to other sessions.
  useEffect(() => {
    let cancelled = false;
    requestJson<{ experiments: ExperimentRecord[] }>(`/api/jobs/${jobId}/experiments?domain=math`, "GET").then(
      (outcome) => {
        if (cancelled) return;
        if (outcome.ok) setExperiments(outcome.data.experiments);
        setLoaded(true);
      }
    );
    return () => {
      cancelled = true;
    };
  }, [jobId]);

  const domainEntries = experiments.filter((e) => e.domain === "math");
  const active = domainEntries.find((e) => e.id === activeId) ?? null;

  function upsert(record: ExperimentRecord) {
    setExperiments((prev) => {
      const idx = prev.findIndex((e) => e.id === record.id);
      if (idx === -1) return [record, ...prev];
      const next = [...prev];
      next[idx] = record;
      return next;
    });
  }

  async function patchExperiment(
    id: string,
    patch: { status?: ClaimStatus; claim?: string; result?: unknown }
  ): Promise<ExperimentRecord | null> {
    const outcome = await requestJson<{ experiment: ExperimentRecord }>(
      `/api/jobs/${jobId}/experiments/${id}`,
      "PATCH",
      patch
    );
    return outcome.ok ? outcome.data.experiment : null;
  }

  async function handleFormalizeNew() {
    const claim = newClaim.trim();
    if (!claim) return;
    setCreating(true);
    setError("");
    const outcome = await requestJson<{ leanCode: string }>(`/api/jobs/${jobId}/experiments/formalize`, "POST", {
      claim,
    });
    if (!outcome.ok) {
      setError(outcome.message);
      setCreating(false);
      return;
    }
    const result: MathResult = { leanCode: outcome.data.leanCode };
    const created = await requestJson<{ experiment: ExperimentRecord }>(`/api/jobs/${jobId}/experiments`, "POST", {
      domain: "math",
      claim,
      status: "ready",
      result,
    });
    if (!created.ok) {
      setError(created.message);
      setCreating(false);
      return;
    }
    upsert(created.data.experiment);
    setActiveId(created.data.experiment.id);
    setNewClaim("");
    setCreating(false);
  }

  async function handleVerify(entry: ExperimentRecord) {
    upsert({ ...entry, status: "verifying" });
    const leanCode = (entry.result as MathResult | null)?.leanCode ?? "";
    const outcome = await requestJson<{
      status: ClaimStatus;
      hasSorry?: boolean;
      diagnostics?: string;
      note?: string;
    }>(`/api/jobs/${jobId}/experiments/prove`, "POST", { leanCode });
    if (!outcome.ok) {
      const patched = await patchExperiment(entry.id, { status: "error", result: { leanCode, note: outcome.message } });
      if (patched) upsert(patched);
      return;
    }
    const result: MathResult = {
      leanCode,
      hasSorry: outcome.data.hasSorry,
      diagnostics: outcome.data.diagnostics,
      note: outcome.data.note,
    };
    const patched = await patchExperiment(entry.id, { status: outcome.data.status, result });
    if (patched) upsert(patched);
  }

  async function handleAskAIToFix(entry: ExperimentRecord) {
    const mathResult = entry.result as MathResult | null;
    upsert({ ...entry, status: "formalizing" });
    const outcome = await requestJson<{ leanCode: string }>(`/api/jobs/${jobId}/experiments/formalize`, "POST", {
      claim: entry.claim,
      priorLeanCode: mathResult?.leanCode,
      priorDiagnostics: mathResult?.diagnostics,
    });
    if (!outcome.ok) {
      const patched = await patchExperiment(entry.id, { status: "error" });
      if (patched) upsert(patched);
      setError(outcome.message);
      return;
    }
    const result: MathResult = {
      leanCode: outcome.data.leanCode,
      note: "AI suggested a fix — review the updated Lean code, then verify again.",
    };
    const patched = await patchExperiment(entry.id, { status: "ready", result });
    if (patched) upsert(patched);
  }

  async function handleEditLeanCode(entry: ExperimentRecord, leanCode: string) {
    const result: MathResult = { leanCode };
    upsert({ ...entry, status: "ready", result });
    const patched = await patchExperiment(entry.id, { status: "ready", result });
    if (patched) upsert(patched);
  }

  async function handleDelete(id: string) {
    setExperiments((prev) => prev.filter((e) => e.id !== id));
    if (activeId === id) setActiveId(null);
    await requestJson(`/api/jobs/${jobId}/experiments/${id}`, "DELETE");
  }

  return (
    <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
      <div className="px-4 py-3 border-b border-gray-100 flex items-center gap-2">
        <span className="w-2 h-2 bg-indigo-500 rounded-full flex-shrink-0" />
        <span className="text-sm font-semibold text-gray-700">Claim Notebook</span>
        <span className="text-[10px] font-bold uppercase tracking-wide text-indigo-600 bg-indigo-50 px-1.5 py-0.5 rounded">
          Mathematics
        </span>
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
        <div className="flex flex-col md:flex-row md:h-[560px]">
          {/* Left: compose + notebook history */}
          <div className="w-full md:w-72 flex-shrink-0 border-b md:border-b-0 md:border-r border-gray-100 flex flex-col">
            <div className="p-3 space-y-2 border-b border-gray-100">
              <textarea
                value={newClaim}
                onChange={(e) => setNewClaim(e.target.value)}
                placeholder="State a claim in LaTeX or plain English…"
                rows={3}
                className="w-full rounded-xl border border-gray-200 px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-indigo-200 resize-none"
              />
              <div className="flex items-center gap-1.5 flex-wrap">
                {EXAMPLE_CLAIMS.map((example) => (
                  <button
                    key={example.label}
                    onClick={() => setNewClaim(example.value)}
                    className="text-[10px] font-medium text-indigo-600 bg-indigo-50 hover:bg-indigo-100 px-2 py-0.5 rounded-full"
                  >
                    {example.label}
                  </button>
                ))}
              </div>
              <button
                onClick={handleFormalizeNew}
                disabled={!newClaim.trim() || creating}
                className="w-full py-2 rounded-xl text-sm font-semibold text-white transition-colors disabled:opacity-40"
                style={{ background: "linear-gradient(135deg, #4f46e5, #6366f1)" }}
              >
                {creating ? "Formalizing…" : "Formalize claim"}
              </button>
              {error && <p className="text-[11px] text-red-500">{error}</p>}
            </div>

            <div className="flex-1 overflow-y-auto p-2 space-y-1.5">
              {loaded && domainEntries.length === 0 && (
                <p className="text-[11px] text-gray-400 px-2 py-3 text-center">
                  Formalized claims appear here. Nothing runs through Lean until you review the
                  code and click Verify.
                </p>
              )}
              {domainEntries.map((entry) => (
                <button
                  key={entry.id}
                  onClick={() => setActiveId(entry.id)}
                  className={`w-full text-left rounded-lg px-2.5 py-2 border transition-colors ${
                    activeId === entry.id
                      ? "border-indigo-300 bg-indigo-50"
                      : "border-transparent hover:bg-gray-50"
                  }`}
                >
                  <p className="text-[11px] text-gray-700 leading-snug line-clamp-2">{entry.claim}</p>
                  <span
                    className={`inline-block mt-1 text-[10px] font-semibold px-1.5 py-0.5 rounded-full ${STATUS_STYLE[entry.status]}`}
                  >
                    {(entry.result as MathResult | null)?.hasSorry ? "Contains sorry" : STATUS_LABEL[entry.status]}
                  </span>
                </button>
              ))}
            </div>
          </div>

          {/* Right: workspace for the active claim */}
          <div className="flex-1 min-w-0 overflow-y-auto p-4 space-y-3">
            {!active ? (
              <div className="h-full flex items-center justify-center text-center text-xs text-gray-400 px-8">
                Formalize a claim on the left, then review and verify it here — the formal
                statement is shown before anything runs through Lean, since an LLM's translation
                can silently change what's actually being proved.
              </div>
            ) : (
              <>
                <div className="rounded-lg bg-gray-50 border border-gray-100 px-3 py-2">
                  <p className="text-[10px] font-semibold uppercase tracking-wide text-gray-400 mb-1">
                    Claim
                  </p>
                  <MathText text={active.claim} className="text-xs text-gray-700" />
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1">
                    <p className="text-[10px] font-semibold uppercase tracking-wide text-gray-400">
                      Formal statement (Lean 4 + Mathlib) — editable
                    </p>
                    <span
                      className={`text-[11px] font-semibold px-2 py-0.5 rounded-full ${STATUS_STYLE[active.status]}`}
                    >
                      {(active.result as MathResult | null)?.hasSorry ? "Contains sorry" : STATUS_LABEL[active.status]}
                    </span>
                  </div>
                  <textarea
                    value={(active.result as MathResult | null)?.leanCode ?? ""}
                    onChange={(e) => handleEditLeanCode(active, e.target.value)}
                    spellCheck={false}
                    rows={10}
                    className="w-full rounded-lg bg-gray-900 text-gray-100 text-[11px] font-mono px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-400 resize-y"
                  />
                  <p className="text-[10px] text-gray-400 mt-1">
                    Read this before verifying — Lean checks that this exact statement is proved,
                    not that it faithfully captures your claim above. Edit tactics directly if you
                    know Lean.
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => handleVerify(active)}
                    disabled={active.status === "verifying" || active.status === "formalizing"}
                    title="Runs the Lean code above through a real Lean 4 + Mathlib checker — it confirms this exact statement compiles, not that the statement matches your claim."
                    className="flex-1 py-2 rounded-xl text-sm font-semibold text-white transition-colors disabled:opacity-40"
                    style={{ background: "linear-gradient(135deg, #4f46e5, #6366f1)" }}
                  >
                    {active.status === "verifying" ? "Verifying…" : "Verify in Lean"}
                  </button>
                  {active.status === "failed" && (
                    <button
                      onClick={() => handleAskAIToFix(active)}
                      className="py-2 px-3 rounded-xl text-sm font-semibold border border-indigo-200 text-indigo-600 hover:bg-indigo-50 transition-colors disabled:opacity-40"
                    >
                      Ask AI to fix
                    </button>
                  )}
                  <button
                    onClick={() => handleDelete(active.id)}
                    className="py-2 px-3 rounded-xl text-sm font-medium text-gray-400 hover:text-red-500 transition-colors"
                    title="Remove from notebook"
                  >
                    Delete
                  </button>
                </div>

                {(active.result as MathResult | null)?.note && (
                  <p className="text-[11px] text-gray-500">{(active.result as MathResult).note}</p>
                )}
                {(active.result as MathResult | null)?.diagnostics && (
                  <pre className="rounded-lg bg-red-50 text-red-700 text-[11px] px-3 py-2 overflow-x-auto whitespace-pre-wrap">
                    {(active.result as MathResult).diagnostics}
                  </pre>
                )}
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
