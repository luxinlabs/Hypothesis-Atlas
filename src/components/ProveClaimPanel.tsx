"use client";

import { useEffect, useRef, useState } from "react";
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
    { label: "Orbital velocity", value: "sqrt(6.674e-11 m^3/(kg s^2) * 5.972e24 kg / (7000 km)) = 7545.78 m/s" },
  ],
  chemistry: [
    { label: "Molarity", value: "Dissolving 0.5 mol NaCl in 2 L of water gives a 0.25 mol/L solution." },
    { label: "Stoichiometry", value: "Reacting 2 mol of H2 with 1 mol of O2 produces 2 mol of water, a yield of 36.03 g." },
  ],
  biology: [
    { label: "Dilution series", value: "A 1:10 serial dilution repeated 3 times from a 10^6 cells/mL stock gives 10^3 cells/mL." },
  ],
  drug_discovery: [
    { label: "Dose conversion", value: "A 70 kg patient dosed at 5 mg/kg receives 350 mg total." },
    { label: "Half-life", value: "A drug with clearance CL = 5 L/h and volume of distribution Vd = 50 L has elimination half-life t1/2 = 0.693 * Vd / CL = 6.93 hours." },
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

/** One-line result summary shown on the collapsed response bubble, before it's expanded into the full workspace. */
function summaryLine(entry: ExperimentRecord): string {
  if (entry.domain === "math") {
    const r = entry.result as MathResult | null;
    if (r?.hasSorry) return "Contains sorry — type-checks but incomplete";
    if (r?.note) return r.note;
    return STATUS_LABEL[entry.status];
  }
  if (entry.domain === "physics") {
    const r = entry.result as PhysicsResult | null;
    if (!r) return STATUS_LABEL[entry.status];
    const parts: string[] = [];
    if (r.unitsOk !== null) parts.push(`units ${r.unitsOk ? "consistent" : "mismatch"}`);
    if (r.numericOk !== null) parts.push(`numeric ${r.numericOk ? "matches" : "mismatch"}`);
    return parts.length > 0 ? parts.join(" · ") : STATUS_LABEL[entry.status];
  }
  const r = entry.result as ProtocolResult | null;
  if (!r) return STATUS_LABEL[entry.status];
  const checked = r.numericChecks.filter((c) => c.ok !== null).length;
  const failed = r.numericChecks.filter((c) => c.ok === false).length;
  const parts: string[] = [];
  if (checked > 0) parts.push(`${checked - failed}/${checked} checks passed`);
  if (r.flags.length > 0) parts.push(`${r.flags.length} flag${r.flags.length > 1 ? "s" : ""}`);
  return parts.length > 0 ? parts.join(" · ") : STATUS_LABEL[entry.status];
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
  const feedEndRef = useRef<HTMLDivElement | null>(null);

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

  // Feed reads oldest-first, newest at the bottom — a conversation, not an
  // inbox. The API returns newest-first (for the old list-style UI this
  // replaced), so reverse it here rather than changing the API's contract.
  const domainEntries = experiments.filter((e) => e.domain === domain).slice().reverse();
  const active = experiments.find((e) => e.id === activeId) ?? null;
  const linkedSessions = active?.groupId
    ? experiments.filter((e) => e.groupId === active.groupId && e.id !== active.id)
    : [];
  const linkable = experiments.filter(
    (e) => e.id !== active?.id && (!active?.groupId || e.groupId !== active.groupId)
  );

  useEffect(() => {
    feedEndRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [domainEntries.length, domain]);

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

  function handleComposerKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleCreate();
    }
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
    setExperiments((prev) => prev.filter((e) => e.id !== id));
    if (activeId === id) setActiveId(null);
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
    <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden flex flex-col h-[680px]">
      <div className="px-4 py-3 border-b border-gray-100 flex items-center gap-2 flex-shrink-0">
        <span className="w-2 h-2 bg-indigo-500 rounded-full flex-shrink-0" />
        <span className="text-sm font-semibold text-gray-700">Claim Notebook</span>
      </div>

      <div className="px-4 pt-3 pb-1 flex flex-wrap gap-1.5 flex-shrink-0">
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

      <div className="flex-1 flex min-h-0">
        {/* Left: chat-style feed + bottom composer for the active domain */}
        <div className="flex-1 min-w-0 flex flex-col border-r border-gray-100">
          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            {loaded && domainEntries.length === 0 && (
              <div className="h-full flex items-center justify-center text-center text-xs text-gray-400 px-8">
                {domain === "math"
                  ? "Formalize a claim below, then review and verify it — the formal statement is shown before anything runs through Lean, since an LLM's translation can silently change what's actually being proved."
                  : "State a claim below to check it."}
              </div>
            )}
            {domainEntries.map((entry) => (
              <FeedItem
                key={entry.id}
                entry={entry}
                expanded={activeId === entry.id}
                onToggle={() => setActiveId(activeId === entry.id ? null : entry.id)}
                onVerify={handleVerify}
                onAskAIToFix={handleAskAIToFix}
                onEditLeanCode={handleEditLeanCode}
                onDelete={handleDelete}
              />
            ))}
            <div ref={feedEndRef} />
          </div>

          {/* Bottom composer — larger, chat-style input bar */}
          <div className="border-t border-gray-100 bg-gray-50/60 p-3 flex-shrink-0">
            {EXAMPLE_CLAIMS[domain].length > 0 && (
              <div className="flex items-center gap-1.5 flex-wrap mb-2">
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
            )}
            <div className="flex items-end gap-2">
              <textarea
                value={newClaim}
                onChange={(e) => setNewClaim(e.target.value)}
                onKeyDown={handleComposerKeyDown}
                placeholder="State a claim in LaTeX or plain English… (Enter to send, Shift+Enter for a new line)"
                rows={3}
                className="flex-1 rounded-2xl border border-gray-200 bg-white px-4 py-3 text-sm leading-relaxed focus:outline-none focus:ring-2 focus:ring-indigo-200 resize-none min-h-[72px] max-h-48"
              />
              <button
                onClick={handleCreate}
                disabled={!newClaim.trim() || creating}
                className="h-[72px] px-5 rounded-2xl text-sm font-semibold text-white transition-colors disabled:opacity-40 flex-shrink-0"
                style={{ background: "linear-gradient(135deg, #4f46e5, #6366f1)" }}
              >
                {creating ? "…" : domain === "math" ? "Formalize" : "Check"}
              </button>
            </div>
            {error && <p className="text-[11px] text-red-500 mt-1.5">{error}</p>}
          </div>
        </div>

        {/* Right: linked sessions sidebar */}
        <div className="w-full lg:w-56 flex-shrink-0 flex flex-col">
          <div className="px-3 py-2.5 border-b border-gray-100 flex items-center justify-between flex-shrink-0">
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

/**
 * One claim in the feed, rendered as a two-bubble exchange like a chat turn:
 * the claim itself (what the user stated) followed by the verifier's
 * response. Collapsed by default to a one-line summary; expanding it swaps
 * in the full domain workspace (editable Lean code, physics breakdown, or
 * protocol review) in place.
 */
function FeedItem({
  entry,
  expanded,
  onToggle,
  onVerify,
  onAskAIToFix,
  onEditLeanCode,
  onDelete,
}: {
  entry: ExperimentRecord;
  expanded: boolean;
  onToggle: () => void;
  onVerify: (e: ExperimentRecord) => void;
  onAskAIToFix: (e: ExperimentRecord) => void;
  onEditLeanCode: (e: ExperimentRecord, leanCode: string) => void;
  onDelete: (id: string) => void;
}) {
  const busy = entry.status === "verifying" || entry.status === "formalizing";

  return (
    <div className="space-y-1.5">
      {/* Claim bubble */}
      <div className="max-w-[85%] rounded-2xl rounded-tl-sm bg-gray-100 px-4 py-2.5">
        <MathText text={entry.claim} className="text-sm text-gray-800" />
      </div>

      {/* Response bubble */}
      <div className="max-w-[92%] ml-2">
        <button
          onClick={onToggle}
          className={`w-full text-left rounded-2xl rounded-tl-sm px-4 py-2.5 transition-colors ${
            expanded ? "bg-indigo-50" : "bg-indigo-50/60 hover:bg-indigo-50"
          }`}
        >
          <div className="flex items-center gap-2 flex-wrap">
            <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full ${STATUS_STYLE[entry.status]}`}>
              {STATUS_LABEL[entry.status]}
            </span>
            {entry.groupId && (
              <span className="text-[10px] text-gray-400" title="Linked to other sessions">
                🔗
              </span>
            )}
            <span className="text-xs text-gray-600 truncate">{summaryLine(entry)}</span>
            <span className="ml-auto text-[10px] text-indigo-400">{expanded ? "hide details ▲" : "details ▼"}</span>
          </div>
        </button>

        {expanded && (
          <div className="mt-2 rounded-xl border border-indigo-100 bg-white p-3 space-y-3">
            {entry.domain === "math" && (
              <MathWorkspace entry={entry} onVerify={onVerify} onAskAIToFix={onAskAIToFix} onEditLeanCode={onEditLeanCode} />
            )}
            {entry.domain === "physics" && <PhysicsWorkspace entry={entry} />}
            {(entry.domain === "chemistry" || entry.domain === "biology" || entry.domain === "drug_discovery") && (
              <ProtocolWorkspace entry={entry} />
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
          </div>
        )}
      </div>
    </div>
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

function PhysicsWorkspace({ entry }: { entry: ExperimentRecord }) {
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
          {result.computed !== null && <p>computed: {result.computed}</p>}
          {result.unitError && <p className="text-red-500">{result.unitError}</p>}
          {result.note && <p className="text-gray-400 italic">{result.note}</p>}
        </div>
      )}
    </div>
  );
}

function ProtocolWorkspace({ entry }: { entry: ExperimentRecord }) {
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
          {result.groundedFacts && result.groundedFacts.length > 0 && (
            <div className="rounded-lg bg-blue-50 border border-blue-100 px-3 py-2 space-y-1">
              <p className="text-[9px] font-bold uppercase tracking-wide text-blue-500">Reference data</p>
              {result.groundedFacts.map((f, i) => (
                <p key={i} className="text-[11px] text-gray-700">
                  <span className="font-medium">{f.compound}</span>
                  {f.molecularWeightGMol !== null && (
                    <span className="text-gray-500"> — {f.molecularWeightGMol} g/mol</span>
                  )}
                  <span className="text-gray-400 ml-1">({f.source})</span>
                </p>
              ))}
            </div>
          )}
          {result.note && <p className="text-[11px] text-gray-400 italic">{result.note}</p>}
        </div>
      )}
    </div>
  );
}
