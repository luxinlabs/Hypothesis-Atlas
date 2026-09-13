"use client";

import { useEffect, useRef, useState } from "react";

interface ReviewScores {
  novelty: number;
  soundness: number;
  clarity: number;
  significance: number;
  overall: number;
}

interface AgentReview {
  id: string;
  name: string;
  unavailable?: boolean;
  summary?: string;
  strengths?: string[];
  weaknesses?: string[];
  questions?: string[];
  scores?: ReviewScores;
  recommendation?: string;
}

interface ReviewResult {
  venue: { name: string; url: string | null; criteria: string[]; focus: string[] };
  agents: AgentReview[];
  final: { scores: ReviewScores; consensus: string; metaReview: string; reviewerCount: number };
}

const PRESET_VENUES = [
  { id: "nature", name: "Nature / Nature Portfolio journal" },
  { id: "ieee", name: "IEEE Transactions / Journals" },
  { id: "acm", name: "ACM Conference / Journal" },
  { id: "springer", name: "Springer / Elsevier journal" },
  { id: "mlconf", name: "ML Conference (NeurIPS / ICML / ICLR)" },
  { id: "acl", name: "ACL / NLP venue" },
  { id: "preprint", name: "Preprint (arXiv-style)" },
  { id: "other", name: "Other / unspecified venue" },
];

const CRITERIA_LABELS: [keyof ReviewScores, string][] = [
  ["novelty", "Novelty"],
  ["soundness", "Soundness"],
  ["clarity", "Clarity"],
  ["significance", "Significance"],
  ["overall", "Overall"],
];

const REC_STYLE: Record<string, { background: string; color: string }> = {
  accept: { background: "#dcfce7", color: "#15803d" },
  "minor revision": { background: "#fef9c3", color: "#a16207" },
  "major revision": { background: "#ffedd5", color: "#c2410c" },
  reject: { background: "#fee2e2", color: "#b91c1c" },
};

const AGENT_HUES = [
  { bg: "#eef2ff", text: "#4338ca", ring: "#6366f1" },
  { bg: "#fdf4ff", text: "#a21caf", ring: "#d946ef" },
  { bg: "#ecfeff", text: "#0e7490", ring: "#06b6d4" },
  { bg: "#fff7ed", text: "#c2410c", ring: "#f97316" },
];

function scoreColor(v: number): string {
  if (v >= 8) return "#16a34a";
  if (v >= 6) return "#ca8a04";
  if (v >= 4) return "#ea580c";
  return "#dc2626";
}

function extractDraftFromKey(key: string): { text: string; savedAt: number } | null {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    const messages: { role: string; content: string }[] = parsed.messages ?? [];
    const assistantParts = messages.filter((m) => m.role === "assistant" && m.content?.trim());
    if (assistantParts.length === 0) return null;
    // Last assistant message is usually the full draft; prepend earlier substantial ones
    const last = assistantParts[assistantParts.length - 1].content.trim();
    const text =
      last.length >= 1500 || assistantParts.length === 1
        ? last
        : assistantParts
            .slice(-2)
            .map((m) => m.content.trim())
            .join("\n\n");
    if (!text) return null;
    return { text, savedAt: typeof parsed.savedAt === "number" ? parsed.savedAt : 0 };
  } catch {
    return null;
  }
}

interface DraftInfo {
  label: string;
  savedAt: number;
  text: string;
}

// The "current paper" is the most recently saved Write Paper (ARS) draft on this device
function findCurrentDraft(): DraftInfo | null {
  try {
    const lastJobId = localStorage.getItem("lastJobId");
    if (!lastJobId) return null;
    const prefix = `ars-plan:${lastJobId}:`;
    let best: { key: string; savedAt: number } | null = null;
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (!key || !key.startsWith(prefix)) continue;
      const hit = extractDraftFromKey(key);
      if (hit && (!best || hit.savedAt > best.savedAt)) best = { key, savedAt: hit.savedAt };
    }
    if (!best) return null;
    const hit = extractDraftFromKey(best.key);
    if (!hit) return null;
    const slug = best.key.slice(prefix.length);
    const label = slug.split("-").filter(Boolean).join(" ") || "Write Paper session";
    return { label, savedAt: hit.savedAt, text: hit.text };
  } catch {
    return null;
  }
}

export default function PaperReviewPanel() {
  const cacheKey = "paper-review:standalone";

  const [venueId, setVenueId] = useState("mlconf");
  const [venueUrl, setVenueUrl] = useState("");
  const [paperText, setPaperText] = useState("");
  const [source, setSource] = useState<"draft" | "upload">("draft");
  const [draftInfo, setDraftInfo] = useState<{ label: string; savedAt: number } | null>(null);
  const [uploadedName, setUploadedName] = useState("");
  const [uploading, setUploading] = useState(false);
  const [customName, setCustomName] = useState("");
  const [customPersona, setCustomPersona] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<ReviewResult | null>(null);

  // Restore cached review on mount (avoids re-running on refresh); otherwise default to the current draft
  useEffect(() => {
    try {
      const raw = localStorage.getItem(cacheKey);
      let hasCachedText = false;
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed?.result?.agents && parsed?.result?.final) {
          setResult(parsed.result);
          if (typeof parsed.venueId === "string") setVenueId(parsed.venueId);
          if (typeof parsed.venueUrl === "string") setVenueUrl(parsed.venueUrl);
          if (typeof parsed.paperText === "string") {
            setPaperText(parsed.paperText);
            hasCachedText = parsed.paperText.trim().length > 0;
          }
          if (typeof parsed.customName === "string") setCustomName(parsed.customName);
          if (typeof parsed.customPersona === "string") setCustomPersona(parsed.customPersona);
        }
      }
      if (!hasCachedText) {
        const draft = findCurrentDraft();
        if (draft) {
          setDraftInfo({ label: draft.label, savedAt: draft.savedAt });
          setPaperText(draft.text);
        }
      }
    } catch {}
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const resultRef = useRef(result);
  useEffect(() => { resultRef.current = result; }, [result]);
  const inputsRef = useRef({ venueId, venueUrl, paperText, customName, customPersona });
  useEffect(() => { inputsRef.current = { venueId, venueUrl, paperText, customName, customPersona }; }, [venueId, venueUrl, paperText, customName, customPersona]);
  useEffect(() => {
    const save = () => {
      try {
        if (resultRef.current) {
          localStorage.setItem(
            cacheKey,
            JSON.stringify({ result: resultRef.current, ...inputsRef.current })
          );
        }
      } catch {}
    };
    window.addEventListener("pagehide", save);
    return () => window.removeEventListener("pagehide", save);
  }, [cacheKey]);

  const handleLoadDraft = () => {
    const draft = findCurrentDraft();
    if (draft) {
      setDraftInfo({ label: draft.label, savedAt: draft.savedAt });
      setPaperText(draft.text);
      setSource("draft");
      setUploadedName("");
      setError(null);
    } else {
      setError("No Write Paper draft found on this device. Upload a paper or paste your text below.");
    }
  };

  const handleUploadPaper = async (file: File) => {
    setUploading(true);
    setError(null);
    try {
      const form = new FormData();
      form.append("file", file);
      form.append("textOnly", "1");
      const res = await fetch("/api/jobs/upload", { method: "POST", body: form });
      const data = await res.json();
      if (!res.ok || typeof data.text !== "string" || !data.text.trim()) {
        setError(data.error ?? "Could not extract text from this file.");
        return;
      }
      setPaperText(data.text);
      setSource("upload");
      setUploadedName(String(data.fileName ?? file.name));
      setDraftInfo(null);
    } catch {
      setError("Upload failed — please try again.");
    } finally {
      setUploading(false);
    }
  };

  const venueName = PRESET_VENUES.find((v) => v.id === venueId)?.name ?? "the target venue";

  const runReview = async () => {
    if (paperText.trim().length < 200) {
      setError("Paper draft is too short to review (min 200 chars). Load a draft or paste your paper.");
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/paper-review`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          paperText,
          venueName,
          venueUrl: venueUrl.trim(),
          customAgent:
            customName.trim() && customPersona.trim()
              ? { name: customName.trim(), persona: customPersona.trim() }
              : null,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Review failed");
        return;
      }
      setResult(data);
      try {
        localStorage.setItem(cacheKey, JSON.stringify({ result: data, venueId, venueUrl, paperText, customName, customPersona }));
      } catch {}
    } catch {
      setError("Network error while running the review");
    } finally {
      setLoading(false);
    }
  };

  const clearReview = () => {
    setResult(null);
    try { localStorage.removeItem(cacheKey); } catch {}
  };

  const inputCard = "bg-white rounded-2xl border border-gray-200 p-6 shadow-sm";

  return (
    <div className="space-y-6">
      {/* Setup */}
      <div className={inputCard}>
        <h2 className="text-lg font-semibold text-gray-900 mb-1">Peer Review Session</h2>
        <p className="text-sm text-gray-500 mb-5">
          Choose a publisher — or paste its call-for-papers page so reviewers grade against its real criteria.
          A committee of three reviewer agents (plus your custom one) will review your paper and produce a final score.
        </p>

        <div className="grid md:grid-cols-2 gap-4 mb-4">
          <div>
            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">Publisher / Venue</label>
            <select
              value={venueId}
              onChange={(e) => setVenueId(e.target.value)}
              className="w-full px-3 py-2.5 rounded-xl border border-gray-200 bg-white text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-indigo-300"
            >
              {PRESET_VENUES.map((v) => (
                <option key={v.id} value={v.id}>{v.name}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">
              Call-for-papers URL <span className="normal-case text-gray-400 font-normal">(optional — we extract review criteria)</span>
            </label>
            <input
              type="url"
              value={venueUrl}
              onChange={(e) => setVenueUrl(e.target.value)}
              placeholder="https://conf2027.org/call-for-papers"
              className="w-full px-3 py-2.5 rounded-xl border border-gray-200 text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-indigo-300"
            />
          </div>
        </div>

        <div className="mb-4">
          <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">Paper to review</label>
          <div className="flex flex-wrap items-center gap-2 mb-2">
            <button
              type="button"
              onClick={handleLoadDraft}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-colors ${
                source === "draft"
                  ? "border-indigo-300 bg-indigo-50 text-indigo-700"
                  : "border-gray-200 text-gray-500 hover:border-gray-300 hover:text-gray-700"
              }`}
            >
              Current paper draft
            </button>
            <label
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold border cursor-pointer transition-colors ${
                source === "upload"
                  ? "border-indigo-300 bg-indigo-50 text-indigo-700"
                  : "border-gray-200 text-gray-500 hover:border-gray-300 hover:text-gray-700"
              } ${uploading ? "opacity-60 pointer-events-none" : ""}`}
            >
              <input
                type="file"
                accept=".pdf,.txt,.md"
                className="hidden"
                disabled={uploading}
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) handleUploadPaper(file);
                  e.target.value = "";
                }}
              />
              {uploading ? "Extracting text…" : "Upload a paper"}
            </label>
            <span className="text-xs text-gray-400">
              {source === "upload" && uploadedName
                ? `Extracted from ${uploadedName}`
                : draftInfo
                ? `Draft: "${draftInfo.label}"${draftInfo.savedAt ? ` · saved ${new Date(draftInfo.savedAt).toLocaleString()}` : ""}`
                : "No Write Paper draft found on this device — upload a paper or paste text below"}
            </span>
          </div>
          <textarea
            value={paperText}
            onChange={(e) => setPaperText(e.target.value)}
            rows={8}
            placeholder="Paste your paper here, load your current draft, or upload a file…"
            className="w-full px-3 py-2.5 rounded-xl border border-gray-200 text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-indigo-300 leading-relaxed"
          />
          <p className="text-xs text-gray-400 mt-1">{paperText.trim().length.toLocaleString()} characters</p>
        </div>

        <div className="rounded-xl border border-dashed border-indigo-200 bg-indigo-50/50 p-4 mb-5">
          <p className="text-xs font-semibold text-indigo-700 mb-3">CUSTOM REVIEWER (OPTIONAL)</p>
          <div className="grid md:grid-cols-2 gap-3">
            <input
              value={customName}
              onChange={(e) => setCustomName(e.target.value)}
              placeholder="Reviewer name & role — e.g. Prof. Anna Weiss, Cryptography"
              className="px-3 py-2 rounded-lg border border-indigo-100 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300"
            />
            <input
              value={customPersona}
              onChange={(e) => setCustomPersona(e.target.value)}
              placeholder="Persona — what they care about, how strict they are…"
              className="px-3 py-2 rounded-lg border border-indigo-100 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300"
            />
          </div>
        </div>

        {error && (
          <div className="mb-4 px-4 py-2.5 bg-red-50 border border-red-200 rounded-xl text-sm text-red-700">{error}</div>
        )}

        <div className="flex items-center gap-3">
          <button
            onClick={runReview}
            disabled={loading}
            className="px-6 py-2.5 rounded-xl text-sm font-semibold text-white shadow transition-opacity hover:opacity-90 disabled:opacity-50"
            style={{ background: "linear-gradient(to right, #4f46e5, #9333ea)" }}
          >
            {loading ? "Reviewers reading… (30–90s)" : result ? "Re-run Review" : "Start Review"}
          </button>
          {result && (
            <button onClick={clearReview} className="text-sm text-gray-400 hover:text-red-500 transition-colors">
              Clear
            </button>
          )}
        </div>
      </div>

      {/* Results */}
      {result && (
        <>
          {/* Final verdict */}
          <div className="rounded-2xl p-6 shadow-sm" style={{ background: "linear-gradient(135deg, #1e1b4b, #4338ca)", color: "#fff" }}>
            <div className="flex flex-wrap items-start gap-6">
              <div className="text-center flex-shrink-0">
                <div className="text-5xl font-bold" style={{ color: "#a5b4fc" }}>
                  {result.final.scores.overall}
                  <span className="text-lg font-medium text-indigo-300">/10</span>
                </div>
                <p className="text-xs text-indigo-300 mt-1">FINAL SCORE</p>
              </div>
              <div className="flex-1 min-w-[240px]">
                <div className="flex flex-wrap items-center gap-2 mb-2">
                  <h3 className="font-bold">Editor's Meta-Review — {result.venue.name}</h3>
                  <span
                    className="text-xs font-semibold px-2.5 py-0.5 rounded-full capitalize"
                    style={REC_STYLE[result.final.consensus] ?? { bg: "#e0e7ff", text: "#3730a3" }}
                  >
                    {result.final.consensus}
                  </span>
                </div>
                {result.venue.criteria.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 mb-3">
                    {result.venue.criteria.map((c, i) => (
                      <span key={i} className="text-xs px-2 py-0.5 rounded-full bg-white/10 text-indigo-100">{c}</span>
                    ))}
                  </div>
                )}
                <p className="text-sm leading-relaxed" style={{ color: "#c7d2fe" }}>{result.final.metaReview}</p>
              </div>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mt-5">
              {CRITERIA_LABELS.map(([key, label]) => (
                <div key={key} className="bg-white/5 rounded-xl px-3 py-2.5">
                  <div className="flex justify-between text-xs mb-1.5">
                    <span className="text-indigo-200">{label}</span>
                    <span className="font-bold">{result.final.scores[key]}</span>
                  </div>
                  <div className="h-1.5 rounded-full bg-white/10 overflow-hidden">
                    <div
                      className="h-full rounded-full"
                      style={{ width: `${result.final.scores[key] * 10}%`, background: "#a5b4fc" }}
                    />
                  </div>
                </div>
              ))}
            </div>
            <p className="text-xs text-indigo-300/70 mt-3">
              Averaged across {result.final.reviewerCount} reviewer{result.final.reviewerCount > 1 ? "s" : ""}
              {result.agents.some((a) => a.unavailable) ? " (one reviewer unavailable)" : ""} for {result.venue.name}.
            </p>
          </div>

          {/* Per-agent reviews */}
          {result.agents.map((agent, idx) => {
            const hue = AGENT_HUES[idx % AGENT_HUES.length];
            return (
              <div key={agent.id} className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6">
                <div className="flex flex-wrap items-center gap-3 mb-4">
                  <div
                    className="w-10 h-10 rounded-full flex items-center justify-center font-bold text-sm flex-shrink-0"
                    style={{ background: hue.bg, color: hue.text, boxShadow: `0 0 0 2px ${hue.ring}33` }}
                  >
                    {agent.name.replace(/^Prof\.\s*|^Dr\.\s*/, "").charAt(0)}
                  </div>
                  <div className="flex-1 min-w-[200px]">
                    <p className="font-semibold text-gray-900 text-sm">{agent.name}</p>
                    {agent.unavailable ? (
                      <p className="text-xs text-red-500">This reviewer failed — LLM service may have been rate-limited.</p>
                    ) : (
                      <p className="text-xs text-gray-500 line-clamp-2">{agent.summary}</p>
                    )}
                  </div>
                  {agent.recommendation && (
                    <span
                      className="text-xs font-semibold px-2.5 py-1 rounded-full capitalize flex-shrink-0"
                      style={REC_STYLE[agent.recommendation] ?? { bg: "#f4f4f5", text: "#52525b" }}
                    >
                      {agent.recommendation}
                    </span>
                  )}
                </div>

                {agent.scores && (
                  <div className="grid grid-cols-5 gap-2 mb-4">
                    {CRITERIA_LABELS.map(([key, label]) => {
                      const sc = agent.scores![key];
                      return (
                        <div key={key} className="text-center">
                          <div className="text-lg font-bold" style={{ color: scoreColor(sc) }}>
                            {sc}
                          </div>
                          <div className="text-[10px] text-gray-400 uppercase tracking-wide">{label}</div>
                          <div className="h-1 rounded-full bg-gray-100 mt-1 overflow-hidden">
                            <div
                              className="h-full rounded-full"
                              style={{ width: `${sc * 10}%`, background: scoreColor(sc) }}
                            />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}

                {agent.summary && !agent.unavailable && <p className="text-sm text-gray-700 leading-relaxed mb-4">{agent.summary}</p>}

                <div className="grid md:grid-cols-2 gap-4">
                  {(agent.strengths?.length ?? 0) > 0 && (
                    <div>
                      <p className="text-xs font-semibold text-emerald-600 uppercase tracking-wide mb-2">Strengths</p>
                      <ul className="space-y-1.5">
                        {agent.strengths!.map((s, i) => (
                          <li key={i} className="text-xs text-gray-600 flex gap-2 leading-relaxed">
                            <span className="text-emerald-500 flex-shrink-0">+</span>{s}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                  {(agent.weaknesses?.length ?? 0) > 0 && (
                    <div>
                      <p className="text-xs font-semibold text-amber-600 uppercase tracking-wide mb-2">Weaknesses</p>
                      <ul className="space-y-1.5">
                        {agent.weaknesses!.map((w, i) => (
                          <li key={i} className="text-xs text-gray-600 flex gap-2 leading-relaxed">
                            <span className="text-amber-500 flex-shrink-0">–</span>{w}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>

                {(agent.questions?.length ?? 0) > 0 && (
                  <div className="mt-4 pt-3 border-t border-gray-100">
                    <p className="text-xs font-semibold text-indigo-500 uppercase tracking-wide mb-2">Questions to Authors</p>
                    <ul className="space-y-1.5">
                      {agent.questions!.map((q, i) => (
                        <li key={i} className="text-xs text-gray-600 flex gap-2 leading-relaxed">
                          <span className="text-indigo-400 flex-shrink-0">?</span>{q}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            );
          })}
        </>
      )}
    </div>
  );
}
