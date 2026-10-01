"use client";

import { useEffect, useRef, useState } from "react";
import MathText from "./MathText";
import {
  EXPERIMENT_DOMAINS,
  domainKind,
  type ClaimStatus,
  type ExperimentDomain,
  type ExperimentRecord,
  type ExperimentSessionRecord,
  type MathResult,
  type PhysicsResult,
  type ProtocolResult,
} from "@/lib/experiments/types";
import { formatSessionContext } from "@/lib/experiments/context";

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
    { label: "Equation balance", value: "The combustion reaction 2 H2 + O2 -> 2 H2O is a balanced chemical equation." },
  ],
  biology: [
    { label: "Dilution series", value: "A 1:10 serial dilution repeated 3 times from a 10^6 cells/mL stock gives 10^3 cells/mL." },
    { label: "Sample size", value: "Using n=2 biological replicates per group, we observed a significant difference (p<0.05) in gene expression." },
  ],
  drug_discovery: [
    { label: "Dose conversion", value: "A 70 kg patient dosed at 5 mg/kg receives 350 mg total." },
    { label: "Half-life", value: "A drug with clearance CL = 5 L/h and volume of distribution Vd = 50 L has elimination half-life t1/2 = 0.693 * Vd / CL = 6.93 hours." },
    { label: "Drug-likeness", value: "Is cyclosporine a good candidate for an oral formulation?" },
  ],
};

/**
 * Per-domain visual identity — written as full literal class strings (not
 * built via template interpolation) so Tailwind's JIT scanner can see them
 * statically. Gives each domain a distinct color so the chat feels like a
 * different "space" per subject rather than one undifferentiated stream.
 */
const DOMAIN_STYLE: Record<
  ExperimentDomain,
  { icon: string; tabActive: string; bubble: string; gradient: string; ring: string; accentText: string; accentBg: string }
> = {
  math: {
    icon: "📐",
    tabActive: "bg-indigo-600 text-white shadow-sm",
    bubble: "bg-indigo-600 text-white",
    gradient: "linear-gradient(135deg, #4f46e5, #6366f1)",
    ring: "focus:ring-indigo-200",
    accentText: "text-indigo-600",
    accentBg: "bg-indigo-50",
  },
  physics: {
    icon: "⚛️",
    tabActive: "bg-blue-600 text-white shadow-sm",
    bubble: "bg-blue-600 text-white",
    gradient: "linear-gradient(135deg, #2563eb, #3b82f6)",
    ring: "focus:ring-blue-200",
    accentText: "text-blue-600",
    accentBg: "bg-blue-50",
  },
  chemistry: {
    icon: "🧪",
    tabActive: "bg-emerald-600 text-white shadow-sm",
    bubble: "bg-emerald-600 text-white",
    gradient: "linear-gradient(135deg, #059669, #10b981)",
    ring: "focus:ring-emerald-200",
    accentText: "text-emerald-600",
    accentBg: "bg-emerald-50",
  },
  biology: {
    icon: "🧬",
    tabActive: "bg-teal-600 text-white shadow-sm",
    bubble: "bg-teal-600 text-white",
    gradient: "linear-gradient(135deg, #0d9488, #14b8a6)",
    ring: "focus:ring-teal-200",
    accentText: "text-teal-600",
    accentBg: "bg-teal-50",
  },
  drug_discovery: {
    icon: "💊",
    tabActive: "bg-purple-600 text-white shadow-sm",
    bubble: "bg-purple-600 text-white",
    gradient: "linear-gradient(135deg, #7c3aed, #a855f7)",
    ring: "focus:ring-purple-200",
    accentText: "text-purple-600",
    accentBg: "bg-purple-50",
  },
};

const DOMAIN_TAGLINE: Record<ExperimentDomain, string> = {
  math: "Autoformalize a claim to Lean 4, review it yourself, then verify against a real proof assistant.",
  physics: "State a unit-bearing equation — dimensional analysis and a numeric check run automatically.",
  chemistry: "Dose/reagent math is checked exactly; named compounds are grounded against real PubChem data.",
  biology: "Dilution, sample-size, and replicate math is checked; implausible steps get flagged for review.",
  drug_discovery: "Dose conversions and pharmacokinetic math are checked; missing controls get flagged.",
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
  const kind = domainKind(entry.domain);
  if (kind === "math") {
    const r = entry.result as MathResult | null;
    if (r?.hasSorry) return "Contains sorry — type-checks but incomplete";
    if (r?.note) return r.note;
    return STATUS_LABEL[entry.status];
  }
  if (kind === "physics") {
    const r = entry.result as PhysicsResult | null;
    if (!r) return STATUS_LABEL[entry.status];
    if (r.plausibilityFlags && r.plausibilityFlags.length > 0) return "physically impossible";
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
  if (r.equationBalance) parts.push(r.equationBalance.balanced ? "equation balanced" : "equation NOT balanced");
  if (checked > 0) parts.push(`${checked - failed}/${checked} checks passed`);
  if (r.flags.length > 0) parts.push(`${r.flags.length} flag${r.flags.length > 1 ? "s" : ""}`);
  return parts.length > 0 ? parts.join(" · ") : STATUS_LABEL[entry.status];
}

export default function ProveClaimPanel({ jobId }: ProveClaimPanelProps) {
  const [domain, setDomain] = useState<ExperimentDomain>("math");
  const [sessions, setSessions] = useState<ExperimentSessionRecord[]>([]);
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
  const [experiments, setExperiments] = useState<ExperimentRecord[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [newClaim, setNewClaim] = useState("");
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState("");
  const [loaded, setLoaded] = useState(false);
  const feedEndRef = useRef<HTMLDivElement | null>(null);
  const creatingRef = useRef(false);
  const leanEditSeqRef = useRef<Record<string, number>>({});

  useEffect(() => {
    let cancelled = false;
    Promise.all([
      requestJson<{ sessions: ExperimentSessionRecord[] }>(`/api/jobs/${jobId}/experiment-sessions`, "GET"),
      requestJson<{ experiments: ExperimentRecord[] }>(`/api/jobs/${jobId}/experiments`, "GET"),
    ]).then(([sessionsOutcome, experimentsOutcome]) => {
      if (cancelled) return;
      if (sessionsOutcome.ok) setSessions(sessionsOutcome.data.sessions);
      if (experimentsOutcome.ok) setExperiments(experimentsOutcome.data.experiments);
      setLoaded(true);
    });
    return () => {
      cancelled = true;
    };
  }, [jobId]);

  // Sessions are scoped to exactly one domain by construction, so switching
  // the domain tab naturally switches which sessions are even selectable —
  // there is no way to see, let alone mix, another domain's sessions here.
  const domainSessions = sessions.filter((s) => s.domain === domain);
  const activeSession = domainSessions.find((s) => s.id === activeSessionId) ?? null;

  // Feed reads oldest-first, newest at the bottom — a conversation, not an
  // inbox. The API returns newest-first, so reverse it here rather than
  // changing the API's contract. Scoped to the active session only — this
  // is what replaced one never-ending per-domain feed with real,
  // switchable conversations.
  const domainEntries = activeSessionId
    ? experiments.filter((e) => e.sessionId === activeSessionId).slice().reverse()
    : [];
  const active = experiments.find((e) => e.id === activeId) ?? null;

  useEffect(() => {
    feedEndRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [domainEntries.length, activeSessionId]);

  // A draft claim belongs to the session it was being composed for — it
  // should never survive a switch to a different session (via the sidebar,
  // a domain change, or creating a new session) and get sent there instead.
  useEffect(() => {
    setNewClaim("");
    setError("");
  }, [activeSessionId]);

  // Runs on domain change and once the initial fetch completes — lands on
  // that domain's most recently active session (or none, if it has none
  // yet). Switching domains should never leave a stale session from a
  // different domain selected, since sessions are domain-exclusive.
  useEffect(() => {
    const stillValid = domainSessions.some((s) => s.id === activeSessionId);
    if (!stillValid) {
      setActiveSessionId(domainSessions[0]?.id ?? null);
      setActiveId(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [domain, loaded]);

  // Background-only context for LLM steps (autoformalize, physics
  // extraction, protocol review) — sibling claims already in the same
  // session are shown so a re-check doesn't contradict them, but never
  // trusted as verified premises. Automatic and unconditional: every claim
  // in a session is, by construction, the same domain and about the same
  // line of investigation, so there's no picking/linking step needed.
  function getSessionContext(entry: ExperimentRecord): string | undefined {
    const siblings = experiments.filter((e) => e.sessionId === entry.sessionId && e.id !== entry.id);
    return formatSessionContext(siblings);
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

  function upsertSession(record: ExperimentSessionRecord) {
    setSessions((prev) => {
      const idx = prev.findIndex((s) => s.id === record.id);
      if (idx === -1) return [record, ...prev];
      const next = [...prev];
      next[idx] = record;
      return next;
    });
  }

  /** Creates a new session in the current domain and makes it active. Used both by "+ New" and by auto-create-on-first-message. */
  async function createSession(title?: string): Promise<ExperimentSessionRecord | null> {
    const outcome = await requestJson<{ session: ExperimentSessionRecord }>(
      `/api/jobs/${jobId}/experiment-sessions`,
      "POST",
      { domain, title }
    );
    if (!outcome.ok) {
      setError(outcome.message);
      return null;
    }
    upsertSession(outcome.data.session);
    setActiveSessionId(outcome.data.session.id);
    setActiveId(null);
    return outcome.data.session;
  }

  async function handleRenameSession(session: ExperimentSessionRecord) {
    const title = window.prompt("Rename session", session.title ?? "");
    if (title === null) return;
    const outcome = await requestJson<{ session: ExperimentSessionRecord }>(
      `/api/jobs/${jobId}/experiment-sessions/${session.id}`,
      "PATCH",
      { title }
    );
    if (outcome.ok) upsertSession(outcome.data.session);
  }

  async function handleDeleteSession(session: ExperimentSessionRecord) {
    if (!window.confirm(`Delete "${session.title ?? "this session"}" and everything in it?`)) return;
    setSessions((prev) => prev.filter((s) => s.id !== session.id));
    setExperiments((prev) => prev.filter((e) => e.sessionId !== session.id));
    if (activeSessionId === session.id) setActiveSessionId(null);
    await requestJson(`/api/jobs/${jobId}/experiment-sessions/${session.id}`, "DELETE");
  }

  async function handleCreate() {
    const claim = newClaim.trim();
    // creatingRef is checked/set synchronously, unlike the `creating` state
    // (which only takes effect on the next render) — this is what actually
    // stops two rapid Enter presses or held-key auto-repeat from both
    // reading the same claim text before either one commits, which
    // otherwise created two sessions/claims from a single message.
    if (!claim || creatingRef.current) return;
    creatingRef.current = true;
    setCreating(true);
    setError("");

    try {
      // Auto-create a session on first message, like a chat app opening a new
      // conversation the moment you start typing — no separate "new session"
      // click required.
      let sessionId = activeSessionId;
      if (!sessionId) {
        const created = await createSession(claim.length > 60 ? `${claim.slice(0, 57)}...` : claim);
        if (!created) return;
        sessionId = created.id;
      }

      if (domainKind(domain) === "math") {
        const outcome = await requestJson<{ leanCode: string }>(`/api/jobs/${jobId}/experiments/formalize`, "POST", { claim });
        if (!outcome.ok) {
          setError(outcome.message);
          return;
        }
        const result: MathResult = { leanCode: outcome.data.leanCode };
        const created = await requestJson<{ experiment: ExperimentRecord }>(`/api/jobs/${jobId}/experiments`, "POST", {
          sessionId,
          claim,
          status: "ready",
          result,
        });
        if (!created.ok) {
          setError(created.message);
          return;
        }
        upsert(created.data.experiment);
        setActiveId(created.data.experiment.id);
        setNewClaim("");
        return;
      }

      // physics / chemistry / biology / drug_discovery: create a draft record
      // immediately, then verify — unlike math there's no separate review step
      // before a checker runs (no formal statement to review).
      const created = await requestJson<{ experiment: ExperimentRecord }>(`/api/jobs/${jobId}/experiments`, "POST", {
        sessionId,
        claim,
        status: "draft",
      });
      if (!created.ok) {
        setError(created.message);
        return;
      }
      upsert(created.data.experiment);
      setActiveId(created.data.experiment.id);
      setNewClaim("");
      await handleVerify(created.data.experiment);
    } finally {
      creatingRef.current = false;
      setCreating(false);
    }
  }

  function handleComposerKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleCreate();
    }
  }

  async function handleVerify(entry: ExperimentRecord) {
    const kind = domainKind(entry.domain);
    upsert({ ...entry, status: kind === "math" ? "verifying" : entry.status });

    if (kind === "math") {
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

    if (kind === "physics") {
      const outcome = await requestJson<{ status: ClaimStatus; result: PhysicsResult }>(
        `/api/jobs/${jobId}/experiments/verify-physics`,
        "POST",
        { claim: entry.claim, sessionContext: getSessionContext(entry) }
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
      { domain: entry.domain, claim: entry.claim, sessionContext: getSessionContext(entry) }
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
      sessionContext: getSessionContext(entry),
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
    // The optimistic local update is the source of truth for what's in the
    // textarea; the PATCH is just persisting it. A sequence number per
    // entry guards against an out-of-order response overwriting newer text:
    // if the user has typed again since this request went out, its response
    // is stale by the time it arrives and must not be applied.
    upsert({ ...entry, status: "ready", result });
    const seq = (leanEditSeqRef.current[entry.id] ?? 0) + 1;
    leanEditSeqRef.current[entry.id] = seq;
    const patched = await patchExperiment(entry.id, { status: "ready", result });
    if (patched && leanEditSeqRef.current[entry.id] === seq) upsert(patched);
  }

  async function handleDelete(id: string) {
    setExperiments((prev) => prev.filter((e) => e.id !== id));
    if (activeId === id) setActiveId(null);
    await requestJson(`/api/jobs/${jobId}/experiments/${id}`, "DELETE");
  }

  const style = DOMAIN_STYLE[domain];

  return (
    <div className="h-full flex bg-white">
      {/* Center: domain switcher + chat feed + composer — the main event, given all the room */}
      <div className="flex-1 min-w-0 flex flex-col h-full">
        {/* Domain switcher: a segmented control with per-domain color + icon, and a one-line
            tagline that changes with it so the "what am I checking here" question is always answered. */}
        <div className="flex-shrink-0 border-b border-gray-100 px-4 sm:px-6 pt-3 pb-3 bg-white/95 backdrop-blur sticky top-0 z-10">
          <div className="flex flex-wrap gap-1.5">
            {EXPERIMENT_DOMAINS.map((d) => {
              const s = DOMAIN_STYLE[d.id];
              return (
                <button
                  key={d.id}
                  onClick={() => setDomain(d.id)}
                  className={`text-xs font-semibold px-3 py-1.5 rounded-full transition-all ${
                    domain === d.id ? s.tabActive : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                  }`}
                >
                  <span className="mr-1">{s.icon}</span>
                  {d.label}
                </button>
              );
            })}
          </div>
          <p className="text-xs text-gray-400 mt-2 max-w-2xl">{DOMAIN_TAGLINE[domain]}</p>
        </div>

        {/* Feed — centered reading column, oldest to newest, auto-scrolls to the latest turn */}
        <div className="flex-1 overflow-y-auto">
          <div className="max-w-3xl mx-auto px-4 sm:px-6 py-6 space-y-5 min-h-full flex flex-col justify-end">
            {loaded && domainEntries.length === 0 && (
              <div className="flex-1 flex flex-col items-center justify-center text-center px-8 py-12">
                <span className="text-4xl mb-3">{style.icon}</span>
                <p className="text-sm text-gray-500 max-w-sm">
                  {domain === "math"
                    ? "Formalize a claim below, then review and verify it — the formal statement is shown before anything runs through Lean, since an LLM's translation can silently change what's actually being proved."
                    : "State a claim below to check it."}
                </p>
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
        </div>

        {/* Composer — floating, full-width, large — the chat box itself */}
        <div className="flex-shrink-0 bg-gradient-to-t from-white via-white to-transparent pt-4">
          <div className="max-w-3xl mx-auto px-4 sm:px-6 pb-5">
            {EXAMPLE_CLAIMS[domain].length > 0 && (
              <div className="flex items-center gap-1.5 flex-wrap mb-2.5">
                {EXAMPLE_CLAIMS[domain].map((example) => (
                  <button
                    key={example.label}
                    onClick={() => setNewClaim(example.value)}
                    className={`text-[11px] font-medium px-2.5 py-1 rounded-full transition-colors ${style.accentText} ${style.accentBg} hover:brightness-95`}
                  >
                    {example.label}
                  </button>
                ))}
              </div>
            )}
            <div className="relative rounded-3xl border border-gray-200 bg-white shadow-lg shadow-gray-900/5 focus-within:border-gray-300 transition-colors">
              <textarea
                value={newClaim}
                onChange={(e) => setNewClaim(e.target.value)}
                onKeyDown={handleComposerKeyDown}
                placeholder="State a claim in LaTeX or plain English… (Enter to send, Shift+Enter for a new line)"
                rows={3}
                className={`w-full rounded-3xl bg-transparent pl-5 pr-16 py-4 text-sm leading-relaxed focus:outline-none resize-none min-h-[88px] max-h-56 ${style.ring}`}
              />
              <button
                onClick={handleCreate}
                disabled={!newClaim.trim() || creating}
                aria-label={domain === "math" ? "Formalize claim" : "Check claim"}
                title={domain === "math" ? "Formalize claim" : "Check claim"}
                className="absolute bottom-3 right-3 w-10 h-10 rounded-full flex items-center justify-center text-white transition-all disabled:opacity-30 disabled:cursor-not-allowed hover:scale-105"
                style={{ background: style.gradient }}
              >
                {creating ? (
                  <span className="w-3.5 h-3.5 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                ) : (
                  <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                    <path d="M10.894 2.553a1 1 0 00-1.788 0l-7 14a1 1 0 001.169 1.409l5-1.429A1 1 0 009 15.571V11a1 1 0 112 0v4.571a1 1 0 00.725.962l5 1.428a1 1 0 001.17-1.408l-7-14z" />
                  </svg>
                )}
              </button>
            </div>
            {error && <p className="text-[11px] text-red-500 mt-1.5 px-1">{error}</p>}
          </div>
        </div>
      </div>

      {/* Right: sessions sidebar — scoped to the active domain only, so a
          math conversation and a drug-discovery conversation can never
          appear side by side as if they were related. */}
      <div className="hidden lg:flex w-64 flex-shrink-0 flex-col border-l border-gray-100 h-full">
        <div className="px-4 py-3.5 border-b border-gray-100 flex items-center justify-between flex-shrink-0">
          <span className="text-[11px] font-semibold text-gray-500 uppercase tracking-wide">
            {style.icon} {EXPERIMENT_DOMAINS.find((d) => d.id === domain)?.label} sessions
          </span>
          <button
            onClick={() => createSession()}
            className={`text-[10px] font-semibold ${style.accentText} hover:brightness-90`}
          >
            + New
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-2 space-y-1">
          {loaded && domainSessions.length === 0 && (
            <p className="text-[11px] text-gray-400 px-3 py-4 text-center">
              No {EXPERIMENT_DOMAINS.find((d) => d.id === domain)?.label.toLowerCase()} sessions yet — one starts
              automatically the moment you send a claim below.
            </p>
          )}
          {domainSessions.map((s) => {
            const count = experiments.filter((e) => e.sessionId === s.id).length;
            return (
              <div
                key={s.id}
                className={`rounded-xl px-3 py-2 border transition-colors ${
                  s.id === activeSessionId ? `${style.accentBg} border-transparent` : "border-transparent hover:bg-gray-50"
                }`}
              >
                <button onClick={() => { setActiveSessionId(s.id); setActiveId(null); }} className="w-full text-left">
                  <p className="text-[11px] text-gray-700 line-clamp-2 font-medium">
                    {s.title ?? "Untitled session"}
                  </p>
                  <span className="text-[10px] text-gray-400">
                    {count} claim{count === 1 ? "" : "s"}
                  </span>
                </button>
                <div className="flex items-center gap-2 mt-1">
                  <button
                    onClick={() => handleRenameSession(s)}
                    className="text-[10px] text-gray-400 hover:text-gray-600"
                  >
                    Rename
                  </button>
                  <button
                    onClick={() => handleDeleteSession(s)}
                    className="text-[10px] text-gray-400 hover:text-red-500"
                  >
                    Delete
                  </button>
                </div>
              </div>
            );
          })}
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
  const style = DOMAIN_STYLE[entry.domain];
  const kind = domainKind(entry.domain);

  return (
    <div className="space-y-2">
      {/* Claim bubble — the "user" turn, right-aligned in the domain's color, the familiar chat convention */}
      <div className="flex justify-end">
        <div className={`max-w-[80%] rounded-3xl rounded-tr-md px-4 py-2.5 ${style.bubble}`}>
          <MathText text={entry.claim} className="text-sm" />
        </div>
      </div>

      {/* Response bubble — the "assistant" turn, left-aligned, expands in place for full detail */}
      <div className="flex justify-start">
        <div className="max-w-[85%] w-full sm:w-auto">
          <button
            onClick={onToggle}
            className={`w-full text-left rounded-3xl rounded-tl-md px-4 py-2.5 border transition-colors ${
              expanded ? "bg-gray-50 border-gray-200" : "bg-white border-gray-200 hover:bg-gray-50"
            }`}
          >
            <div className="flex items-center gap-2 flex-wrap">
              <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full ${STATUS_STYLE[entry.status]}`}>
                {STATUS_LABEL[entry.status]}
              </span>
              <span className="text-xs text-gray-600 truncate">{summaryLine(entry)}</span>
              <span className={`ml-auto text-[10px] ${style.accentText}`}>{expanded ? "hide details ▲" : "details ▼"}</span>
            </div>
          </button>

          {expanded && (
            <div className="mt-2 rounded-2xl border border-gray-200 bg-white p-4 space-y-3 shadow-sm">
              {kind === "math" && (
                <MathWorkspace entry={entry} onVerify={onVerify} onAskAIToFix={onAskAIToFix} onEditLeanCode={onEditLeanCode} />
              )}
              {kind === "physics" && <PhysicsWorkspace entry={entry} />}
              {kind === "protocol" && <ProtocolWorkspace entry={entry} />}

              <div className="flex items-center gap-2">
                {kind !== "math" && (
                  <button
                    onClick={() => onVerify(entry)}
                    disabled={busy}
                    className="flex-1 py-2 rounded-xl text-sm font-semibold text-white transition-colors disabled:opacity-40"
                    style={{ background: style.gradient }}
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
          {result.plausibilityFlags && result.plausibilityFlags.length > 0 && (
            <div className="not-italic font-sans space-y-0.5 pt-1">
              {result.plausibilityFlags.map((f, i) => (
                <p key={i} className="text-red-600">
                  ⚠ {f}
                </p>
              ))}
            </div>
          )}
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
          {result.equationBalance && (
            <div
              className={`rounded-lg border px-3 py-2 space-y-1 ${
                result.equationBalance.balanced ? "bg-emerald-50 border-emerald-100" : "bg-red-50 border-red-100"
              }`}
            >
              <p
                className={`text-[9px] font-bold uppercase tracking-wide ${
                  result.equationBalance.balanced ? "text-emerald-600" : "text-red-600"
                }`}
              >
                Equation balance {result.equationBalance.balanced ? "— balanced" : "— NOT balanced"}
              </p>
              {!result.equationBalance.balanced &&
                result.equationBalance.mismatches.map((m, i) => (
                  <p key={i} className="text-[11px] text-red-600 font-mono">
                    {m}
                  </p>
                ))}
            </div>
          )}
          {result.drugLikeness && result.drugLikeness.length > 0 && (
            <div className="rounded-lg bg-purple-50 border border-purple-100 px-3 py-2 space-y-2">
              <p className="text-[9px] font-bold uppercase tracking-wide text-purple-500">
                Drug-likeness — Lipinski&rsquo;s Rule of Five
              </p>
              {result.drugLikeness.map((d, i) => (
                <div key={i} className="text-[11px] text-gray-700">
                  <div className="flex items-center gap-1.5">
                    <span
                      className={`w-3.5 h-3.5 rounded-full flex items-center justify-center text-[9px] font-bold text-white ${
                        d.passesRuleOfFive ? "bg-emerald-500" : "bg-amber-400"
                      }`}
                    >
                      {d.passesRuleOfFive ? "✓" : "!"}
                    </span>
                    <span className="font-medium">{d.compound}</span>
                    <span className="text-gray-400">
                      {d.passesRuleOfFive ? "likely orally bioavailable" : "likely poor oral bioavailability"}
                    </span>
                  </div>
                  <p className="text-gray-400 font-mono pl-5">
                    MW {d.molecularWeightGMol ?? "—"} · LogP {d.xLogP ?? "—"} · HBD {d.hBondDonorCount ?? "—"} · HBA{" "}
                    {d.hBondAcceptorCount ?? "—"}
                  </p>
                  {d.violations.length > 0 && (
                    <p className="text-amber-600 pl-5">{d.violations.join(", ")}</p>
                  )}
                </div>
              ))}
            </div>
          )}
          {result.note && <p className="text-[11px] text-gray-400 italic">{result.note}</p>}
        </div>
      )}
    </div>
  );
}
