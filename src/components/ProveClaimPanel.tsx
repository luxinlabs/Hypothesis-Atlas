"use client";

import { useEffect, useState } from "react";
import MathText from "./MathText";
import {
  EXPERIMENT_DOMAINS,
  type ClaimStatus,
  type ExperimentDomain,
  type ExperimentRecord,
  type MathResult,
  type PhysicsResult,
  type ProtocolResult,
} from "@/lib/experiments/types";
import { formatLinkedContext } from "@/lib/experiments/context";

interface ProveClaimPanelProps {
  jobId: string;
}

const EXAMPLE_CLAIMS: Record<ExperimentDomain, { label: string; value: string }[]> = {
  math: [
    { label: "Sum formula", value: "For all naturals n, the sum 1 + 2 + ... + n equals n(n+1)/2." },
    { label: "Parity", value: "For any natural number n, n^2 + n is even." },
    {
      label: "Sum of squares (LaTeX)",
      value: "$$\\forall n \\in \\mathbb{N},\\ \\sum_{k=1}^{n} k^2 = \\frac{n(n+1)(2n+1)}{6}$$",
    },
  ],
  physics: [
    { label: "Free fall", value: "9.8 m/s^2 * 2 s = 19.6 m/s" },
    { label: "Kinetic energy", value: "0.5 * 2 kg * (3 m/s)^2 = 9 J" },
  ],
  chemistry: [
    { label: "Molarity", value: "Dissolving 0.5 mol NaCl in 2 L of water gives a 0.25 mol/L solution." },
  ],
  biology: [
    { label: "Dilution series", value: "A 1:10 serial dilution repeated 3 times from a 10^6 cells/mL stock gives 10^3 cells/mL." },
  ],
  drug_discovery: [
    { label: "Dose conversion", value: "A 70 kg patient dosed at 5 mg/kg receives 350 mg total." },
  ],
};

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
  const [linkPickerOpen, setLinkPickerOpen] = useState(false);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    let cancelled = false;
    requestJson<{ experiments: ExperimentRecord[] }>(`/api/jobs/${jobId}/experiments`, "GET").then((outcome) => {
      if (cancelled) return;
      if (outcome.ok) setExperiments(outcome.data.experiments);
      setLoaded(true);
    });
    return () => {
      cancelled = true;
    };
  }, [jobId]);

  const domainEntries = experiments.filter((e) => e.domain === domain);
  const active = experiments.find((e) => e.id === activeId) ?? null;
  const linkedSessions = active?.groupId
    ? experiments.filter((e) => e.groupId === active.groupId && e.id !== active.id)
    : [];
  const linkable = experiments.filter(
    (e) => e.id !== active?.id && (!active?.groupId || e.groupId !== active.groupId)
  );

  // Background-only context for LLM steps (autoformalize, physics
  // extraction, protocol review) — the linked sessions' own claims/results
  // are shown so a re-check doesn't contradict them, but never trusted as
  // verified premises. See the V3 follow-up on sharing context across
  // linked sessions.
  function getLinkedContext(entry: ExperimentRecord): string | undefined {
    if (!entry.groupId) return undefined;
    const linked = experiments.filter((e) => e.groupId === entry.groupId && e.id !== entry.id);
    return formatLinkedContext(linked);
  }

  function upsert(record: ExperimentRecord) {
    setExperiments((prev) => {
      const idx = prev.findIndex((e) => e.id === record.id);
      if (idx === -1) return [record, ...prev];
      const next = [...prev];
      next[idx] = record;
      return next;
    });
  }

  function removeLocal(id: string) {
    setExperiments((prev) => prev.filter((e) => e.id !== id));
    if (activeId === id) setActiveId(null);
  }

  async function handleCreate() {
    const claim = newClaim.trim();
    if (!claim) return;
    setCreating(true);
    setError("");

    if (domain === "math") {
      const outcome = await requestJson<{ leanCode: string }>(`/api/jobs/${jobId}/experiments/formalize`, "POST", { claim });
      if (!outcome.ok) {
        setError(outcome.message);
        setCreating(false);
        return;
      }
      const result: MathResult = { leanCode: outcome.data.leanCode };
      const created = await requestJson<{ experiment: ExperimentRecord }>(`/api/jobs/${jobId}/experiments`, "POST", {
        domain,
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
      return;
    }

    // physics / chemistry / biology / drug_discovery: create a draft record
    // immediately, then verify — unlike math there's no separate review step
    // before a checker runs (no formal statement to review).
    const created = await requestJson<{ experiment: ExperimentRecord }>(`/api/jobs/${jobId}/experiments`, "POST", {
      domain,
      claim,
      status: "draft",
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
    await handleVerify(created.data.experiment);
  }

  async function handleVerify(entry: ExperimentRecord) {
    upsert({ ...entry, status: entry.domain === "math" ? "verifying" : entry.status });

    if (entry.domain === "math") {
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
      return;
    }

    if (entry.domain === "physics") {
      const outcome = await requestJson<{ status: ClaimStatus; result: PhysicsResult }>(
        `/api/jobs/${jobId}/experiments/verify-physics`,
        "POST",
        { claim: entry.claim, linkedContext: getLinkedContext(entry) }
      );
      if (!outcome.ok) {
        const patched = await patchExperiment(entry.id, { status: "error" });
        if (patched) upsert(patched);
        setError(outcome.message);
        return;
      }
      const patched = await patchExperiment(entry.id, { status: outcome.data.status, result: outcome.data.result });
      if (patched) upsert(patched);
      return;
    }

    // chemistry / biology / drug_discovery
    const outcome = await requestJson<{ status: ClaimStatus; result: ProtocolResult }>(
      `/api/jobs/${jobId}/experiments/verify-protocol`,
      "POST",
      { domain: entry.domain, claim: entry.claim, linkedContext: getLinkedContext(entry) }
    );
    if (!outcome.ok) {
      const patched = await patchExperiment(entry.id, { status: "error" });
      if (patched) upsert(patched);
      setError(outcome.message);
      return;
    }
    const patched = await patchExperiment(entry.id, { status: outcome.data.status, result: outcome.data.result });
    if (patched) upsert(patched);
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

  async function handleAskAIToFix(entry: ExperimentRecord) {
    const mathResult = entry.result as MathResult | null;
    upsert({ ...entry, status: "formalizing" });
    const outcome = await requestJson<{ leanCode: string }>(`/api/jobs/${jobId}/experiments/formalize`, "POST", {
      claim: entry.claim,
      priorLeanCode: mathResult?.leanCode,
      priorDiagnostics: mathResult?.diagnostics,
      linkedContext: getLinkedContext(entry),
    });
    if (!outcome.ok) {
      const patched = await patchExperiment(entry.id, { status: "error" });
      if (patched) upsert(patched);
      setError(outcome.message);
      return;
    }
    const result: MathResult = { leanCode: outcome.data.leanCode, note: "AI suggested a fix — review the updated Lean code, then verify again." };
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
    removeLocal(id);
    await requestJson(`/api/jobs/${jobId}/experiments/${id}`, "DELETE");
  }

  async function handleLink(targetId: string) {
    if (!active) return;
    const outcome = await requestJson<{ experiments: ExperimentRecord[] }>(
      `/api/jobs/${jobId}/experiments/${active.id}/link`,
      "POST",
      { targetId }
    );
    if (outcome.ok) {
      setExperiments((prev) => {
        const byId = new Map(prev.map((e) => [e.id, e]));
        for (const e of outcome.data.experiments) byId.set(e.id, e);
        return Array.from(byId.values());
      });
    }
    setLinkPickerOpen(false);
  }

  async function handleUnlink(id: string) {
    const outcome = await requestJson<{ experiment: ExperimentRecord }>(
      `/api/jobs/${jobId}/experiments/${id}/link`,
      "DELETE"
    );
    if (outcome.ok) upsert(outcome.data.experiment);
  }

  return (
    <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
      <div className="px-4 py-3 border-b border-gray-100 flex items-center gap-2">
        <span className="w-2 h-2 bg-indigo-500 rounded-full flex-shrink-0" />
        <span className="text-sm font-semibold text-gray-700">Claim Notebook</span>
      </div>

      <div className="px-4 pt-3 flex flex-wrap gap-1.5">
        {EXPERIMENT_DOMAINS.map((d) => (
          <button
            key={d.id}
            onClick={() => setDomain(d.id)}
            className={`text-[11px] font-semibold px-2.5 py-1 rounded-full transition-colors ${
              domain === d.id ? "bg-indigo-600 text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200"
            }`}
          >
            {d.label}
          </button>
        ))}
      </div>

      <div className="flex flex-col lg:flex-row lg:h-[560px]">
        {/* Left: compose + notebook history for the active domain */}
        <div className="w-full lg:w-64 flex-shrink-0 border-b lg:border-b-0 lg:border-r border-gray-100 flex flex-col">
          <div className="p-3 space-y-2 border-b border-gray-100">
            <textarea
              value={newClaim}
              onChange={(e) => setNewClaim(e.target.value)}
              placeholder="State a claim in LaTeX or plain English…"
              rows={3}
              className="w-full rounded-xl border border-gray-200 px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-indigo-200 resize-none"
            />
            <div className="flex items-center gap-1.5 flex-wrap">
              {EXAMPLE_CLAIMS[domain].map((example) => (
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
              onClick={handleCreate}
              disabled={!newClaim.trim() || creating}
              className="w-full py-2 rounded-xl text-sm font-semibold text-white transition-colors disabled:opacity-40"
              style={{ background: "linear-gradient(135deg, #4f46e5, #6366f1)" }}
            >
              {creating ? "Working…" : domain === "math" ? "Formalize claim" : "Check claim"}
            </button>
            {error && <p className="text-[11px] text-red-500">{error}</p>}
          </div>

          <div className="flex-1 overflow-y-auto p-2 space-y-1.5">
            {loaded && domainEntries.length === 0 && (
              <p className="text-[11px] text-gray-400 px-2 py-3 text-center">
                {domain === "math"
                  ? "Formalized claims appear here. Nothing runs through Lean until you review the code and click Verify."
                  : "Checked claims appear here."}
              </p>
            )}
            {domainEntries.map((entry) => (
              <button
                key={entry.id}
                onClick={() => setActiveId(entry.id)}
                className={`w-full text-left rounded-lg px-2.5 py-2 border transition-colors ${
                  activeId === entry.id ? "border-indigo-300 bg-indigo-50" : "border-transparent hover:bg-gray-50"
                }`}
              >
                <p className="text-[11px] text-gray-700 leading-snug line-clamp-2">{entry.claim}</p>
                <div className="flex items-center gap-1 mt-1">
                  <span className={`inline-block text-[10px] font-semibold px-1.5 py-0.5 rounded-full ${STATUS_STYLE[entry.status]}`}>
                    {entry.domain === "math" && (entry.result as MathResult | null)?.hasSorry
                      ? "Contains sorry"
                      : STATUS_LABEL[entry.status]}
                  </span>
                  {entry.groupId && (
                    <span className="text-[10px] text-gray-400" title="Linked to other sessions">
                      🔗
                    </span>
                  )}
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* Middle: workspace for the active claim */}
        <div className="flex-1 min-w-0 overflow-y-auto p-4 space-y-3">
          {!active ? (
            <div className="h-full flex items-center justify-center text-center text-xs text-gray-400 px-8">
              {domain === "math"
                ? "Formalize a claim on the left, then review and verify it here — the formal statement is shown before anything runs through Lean, since an LLM's translation can silently change what's actually being proved."
                : "State a claim on the left to check it."}
            </div>
          ) : (
            <ActiveExperiment
              entry={active}
              onVerify={handleVerify}
              onAskAIToFix={handleAskAIToFix}
              onEditLeanCode={handleEditLeanCode}
              onDelete={handleDelete}
            />
          )}
        </div>

        {/* Right: linked sessions sidebar */}
        <div className="w-full lg:w-56 flex-shrink-0 border-t lg:border-t-0 lg:border-l border-gray-100 flex flex-col">
          <div className="px-3 py-2.5 border-b border-gray-100 flex items-center justify-between">
            <span className="text-[11px] font-semibold text-gray-500 uppercase tracking-wide">Linked sessions</span>
            {active && (
              <button
                onClick={() => setLinkPickerOpen((v) => !v)}
                className="text-[10px] font-semibold text-indigo-600 hover:text-indigo-700"
              >
                + Link
              </button>
            )}
          </div>

          {!active ? (
            <p className="text-[11px] text-gray-400 px-3 py-3">Select a session to see or add links.</p>
          ) : linkPickerOpen ? (
            <div className="flex-1 overflow-y-auto p-2 space-y-1">
              {linkable.length === 0 && <p className="text-[11px] text-gray-400 px-1 py-2">No other sessions to link yet.</p>}
              {linkable.map((e) => (
                <button
                  key={e.id}
                  onClick={() => handleLink(e.id)}
                  className="w-full text-left rounded-lg px-2 py-1.5 border border-transparent hover:bg-gray-50 hover:border-gray-200"
                >
                  <p className="text-[11px] text-gray-700 line-clamp-2">{e.claim}</p>
                  <span className="text-[10px] text-gray-400">{EXPERIMENT_DOMAINS.find((d) => d.id === e.domain)?.label}</span>
                </button>
              ))}
            </div>
          ) : (
            <div className="flex-1 overflow-y-auto p-2 space-y-1.5">
              {linkedSessions.length === 0 && (
                <p className="text-[11px] text-gray-400 px-2 py-3 text-center">
                  Not linked to anything. Link this session to related claims to browse them together.
                </p>
              )}
              {linkedSessions.map((e) => (
                <div key={e.id} className="rounded-lg border border-gray-100 px-2 py-1.5">
                  <button onClick={() => setActiveId(e.id)} className="w-full text-left">
                    <p className="text-[11px] text-gray-700 line-clamp-2">{e.claim}</p>
                    <span className={`inline-block mt-1 text-[10px] font-semibold px-1.5 py-0.5 rounded-full ${STATUS_STYLE[e.status]}`}>
                      {STATUS_LABEL[e.status]}
                    </span>
                  </button>
                  <button
                    onClick={() => handleUnlink(e.id)}
                    className="text-[10px] text-gray-400 hover:text-red-500 mt-1"
                  >
                    Unlink
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function ActiveExperiment({
  entry,
  onVerify,
  onAskAIToFix,
  onEditLeanCode,
  onDelete,
}: {
  entry: ExperimentRecord;
  onVerify: (e: ExperimentRecord) => void;
  onAskAIToFix: (e: ExperimentRecord) => void;
  onEditLeanCode: (e: ExperimentRecord, leanCode: string) => void;
  onDelete: (id: string) => void;
}) {
  const busy = entry.status === "verifying" || entry.status === "formalizing";

  return (
    <>
      <div className="rounded-lg bg-gray-50 border border-gray-100 px-3 py-2">
        <p className="text-[10px] font-semibold uppercase tracking-wide text-gray-400 mb-1">Claim</p>
        <MathText text={entry.claim} className="text-xs text-gray-700" />
      </div>

      {entry.domain === "math" && <MathWorkspace entry={entry} onVerify={onVerify} onAskAIToFix={onAskAIToFix} onEditLeanCode={onEditLeanCode} />}
      {entry.domain === "physics" && <PhysicsWorkspace entry={entry} onVerify={onVerify} />}
      {(entry.domain === "chemistry" || entry.domain === "biology" || entry.domain === "drug_discovery") && (
        <ProtocolWorkspace entry={entry} onVerify={onVerify} />
      )}

      <div className="flex items-center gap-2">
        {entry.domain !== "math" && (
          <button
            onClick={() => onVerify(entry)}
            disabled={busy}
            className="flex-1 py-2 rounded-xl text-sm font-semibold text-white transition-colors disabled:opacity-40"
            style={{ background: "linear-gradient(135deg, #4f46e5, #6366f1)" }}
          >
            {busy ? "Checking…" : "Re-check"}
          </button>
        )}
        <button
          onClick={() => onDelete(entry.id)}
          className="py-2 px-3 rounded-xl text-sm font-medium text-gray-400 hover:text-red-500 transition-colors"
          title="Remove from notebook"
        >
          Delete
        </button>
      </div>
    </>
  );
}

function MathWorkspace({
  entry,
  onVerify,
  onAskAIToFix,
  onEditLeanCode,
}: {
  entry: ExperimentRecord;
  onVerify: (e: ExperimentRecord) => void;
  onAskAIToFix: (e: ExperimentRecord) => void;
  onEditLeanCode: (e: ExperimentRecord, leanCode: string) => void;
}) {
  const result = entry.result as MathResult | null;
  const busy = entry.status === "verifying" || entry.status === "formalizing";
  return (
    <>
      <div>
        <div className="flex items-center justify-between mb-1">
          <p className="text-[10px] font-semibold uppercase tracking-wide text-gray-400">
            Formal statement (Lean 4 + Mathlib) — editable
          </p>
          <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full ${STATUS_STYLE[entry.status]}`}>
            {result?.hasSorry ? "Contains sorry" : STATUS_LABEL[entry.status]}
          </span>
        </div>
        <textarea
          value={result?.leanCode ?? ""}
          onChange={(e) => onEditLeanCode(entry, e.target.value)}
          spellCheck={false}
          rows={10}
          className="w-full rounded-lg bg-gray-900 text-gray-100 text-[11px] font-mono px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-400 resize-y"
        />
        <p className="text-[10px] text-gray-400 mt-1">
          Read this before verifying — Lean checks that this exact statement is proved, not that it faithfully
          captures your claim above. Edit tactics directly if you know Lean.
        </p>
      </div>

      <div className="flex items-center gap-2">
        <button
          onClick={() => onVerify(entry)}
          disabled={busy}
          title="Runs the Lean code above through a real Lean 4 + Mathlib checker — it confirms this exact statement compiles, not that the statement matches your claim."
          className="flex-1 py-2 rounded-xl text-sm font-semibold text-white transition-colors disabled:opacity-40"
          style={{ background: "linear-gradient(135deg, #4f46e5, #6366f1)" }}
        >
          {entry.status === "verifying" ? "Verifying…" : "Verify in Lean"}
        </button>
        {entry.status === "failed" && (
          <button
            onClick={() => onAskAIToFix(entry)}
            className="py-2 px-3 rounded-xl text-sm font-semibold border border-indigo-200 text-indigo-600 hover:bg-indigo-50 transition-colors disabled:opacity-40"
          >
            Ask AI to fix
          </button>
        )}
      </div>

      {result?.note && <p className="text-[11px] text-gray-500">{result.note}</p>}
      {result?.diagnostics && (
        <pre className="rounded-lg bg-red-50 text-red-700 text-[11px] px-3 py-2 overflow-x-auto whitespace-pre-wrap">
          {result.diagnostics}
        </pre>
      )}
    </>
  );
}

function PhysicsWorkspace({ entry }: { entry: ExperimentRecord; onVerify: (e: ExperimentRecord) => void }) {
  const result = entry.result as PhysicsResult | null;
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <p className="text-[10px] font-semibold uppercase tracking-wide text-gray-400">
          Dimensional analysis + numeric check
        </p>
        <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full ${STATUS_STYLE[entry.status]}`}>
          {STATUS_LABEL[entry.status]}
        </span>
      </div>
      {!result ? (
        <p className="text-[11px] text-gray-400">Not checked yet.</p>
      ) : (
        <div className="rounded-lg bg-gray-50 border border-gray-100 px-3 py-2 space-y-1 text-[11px] font-mono text-gray-600">
          <p>{result.expression || "—"}{result.expected ? ` = ${result.expected}` : ""}</p>
          <p>
            units:{" "}
            <span className={result.unitsOk === false ? "text-red-500" : result.unitsOk ? "text-emerald-600" : "text-gray-400"}>
              {result.unitsOk === null ? "n/a" : result.unitsOk ? "consistent" : "mismatch"}
            </span>
            {result.numericOk !== null && (
              <>
                {" · numeric: "}
                <span className={result.numericOk ? "text-emerald-600" : "text-red-500"}>
                  {result.numericOk ? "matches" : "mismatch"}
                </span>
              </>
            )}
          </p>
          {result.unitError && <p className="text-red-500">{result.unitError}</p>}
          {result.note && <p className="text-gray-400 italic">{result.note}</p>}
        </div>
      )}
    </div>
  );
}

function ProtocolWorkspace({ entry }: { entry: ExperimentRecord; onVerify: (e: ExperimentRecord) => void }) {
  const result = entry.result as ProtocolResult | null;
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <p className="text-[10px] font-semibold uppercase tracking-wide text-gray-400">Protocol review</p>
        <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full ${STATUS_STYLE[entry.status]}`}>
          {STATUS_LABEL[entry.status]}
        </span>
      </div>
      {!result ? (
        <p className="text-[11px] text-gray-400">Not checked yet.</p>
      ) : (
        <div className="space-y-2">
          {result.numericChecks.length > 0 && (
            <div className="rounded-lg bg-gray-50 border border-gray-100 px-3 py-2 space-y-1.5">
              {result.numericChecks.map((c, i) => (
                <div key={i} className="text-[11px]">
                  <span
                    className={`inline-block w-3.5 h-3.5 rounded-full text-center text-[9px] font-bold text-white mr-1.5 ${
                      c.ok === true ? "bg-emerald-500" : c.ok === false ? "bg-red-500" : "bg-amber-400"
                    }`}
                  >
                    {c.ok === true ? "✓" : c.ok === false ? "✗" : "!"}
                  </span>
                  <span className="text-gray-700 font-medium">{c.label}</span>
                  <span className="text-gray-400 font-mono ml-1">
                    ({c.expression} = {c.expected}, computed {c.computed ?? "—"})
                  </span>
                </div>
              ))}
            </div>
          )}
          {result.flags.length > 0 && (
            <div className="rounded-lg bg-amber-50 border border-amber-100 px-3 py-2 space-y-1.5">
              {result.flags.map((f, i) => (
                <div key={i} className="text-[11px]">
                  <span
                    className={`text-[9px] font-bold uppercase px-1.5 py-0.5 rounded-full mr-1.5 ${
                      f.severity === "high"
                        ? "bg-red-500 text-white"
                        : f.severity === "medium"
                          ? "bg-amber-400 text-white"
                          : "bg-amber-100 text-amber-700"
                    }`}
                  >
                    {f.severity}
                  </span>
                  <span className="text-gray-700 font-medium">{f.step}</span>
                  <span className="text-gray-500 block pl-6">{f.reason}</span>
                </div>
              ))}
            </div>
          )}
          {result.numericChecks.length === 0 && result.flags.length === 0 && (
            <p className="text-[11px] text-gray-400">No checkable arithmetic or flagged steps found.</p>
          )}
          {result.note && <p className="text-[11px] text-gray-400 italic">{result.note}</p>}
        </div>
      )}
    </div>
  );
}
