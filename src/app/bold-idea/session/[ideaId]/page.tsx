// SPDX-License-Identifier: AGPL-3.0-only
"use client";

import { useEffect, useRef, useState, type CSSProperties } from "react";
import Link from "next/link";
import AssistantChat from "@/components/AssistantChat";
import type { CandidateVerdict, CriticVerdict, PaperAnalysis, BoldIdeaAgentTrace } from "@/lib/boldIdeaAgents";

interface BoldIdeaDetail {
  id: string;
  text: string;
  tags: string[];
  trace: BoldIdeaAgentTrace | null;
}

/**
 * Bold Idea's split-screen session view: chat on the left (opens with the
 * multi-agent synthesis — Summary / Gap / What we can still do), and a
 * parent/child node tree on the right — same layout language as
 * KnowledgeTree (src/components/KnowledgeTree.tsx): the idea as the root,
 * its candidate directions as child nodes, and each candidate's own papers
 * as grandchild nodes, hoverable for Method / Summary / Gap. No embedded
 * /job/[id] iframe and no Write Paper tab here — a bold idea is a
 * self-contained exploration, not an on-ramp into the Knowledge Tree
 * pipeline (it just borrows that pipeline's node-tree visual language).
 *
 * POST /api/bold-ideas now runs the whole multi-agent pipeline
 * synchronously, so the trace already exists by the time this page loads —
 * a single fetch on mount, no polling.
 */
const SPLIT_STORAGE_KEY = "bold-idea-split-pct";
const SPLIT_MIN = 24;
const SPLIT_MAX = 65;

export default function BoldIdeaSessionPage({ params }: { params: { ideaId: string } }) {
  const { ideaId } = params;
  const [idea, setIdea] = useState<BoldIdeaDetail | null>(null);
  const [notFound, setNotFound] = useState(false);

  const containerRef = useRef<HTMLDivElement>(null);
  const draggingRef = useRef(false);
  const [leftPct, setLeftPct] = useState(38);

  useEffect(() => {
    fetch(`/api/bold-ideas/${ideaId}`)
      .then((r) => {
        if (!r.ok) throw new Error("not found");
        return r.json();
      })
      .then((d) => setIdea(d))
      .catch(() => setNotFound(true));
  }, [ideaId]);

  // Restore a previously chosen split so the layout stays how the user left it.
  useEffect(() => {
    try {
      const saved = Number(localStorage.getItem(SPLIT_STORAGE_KEY));
      if (saved && saved >= SPLIT_MIN && saved <= SPLIT_MAX) setLeftPct(saved);
    } catch {}
  }, []);

  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      if (!draggingRef.current || !containerRef.current) return;
      const rect = containerRef.current.getBoundingClientRect();
      const pct = ((e.clientX - rect.left) / rect.width) * 100;
      setLeftPct(Math.min(SPLIT_MAX, Math.max(SPLIT_MIN, pct)));
    };
    const onUp = () => {
      if (!draggingRef.current) return;
      draggingRef.current = false;
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
      setLeftPct((pct) => {
        try {
          localStorage.setItem(SPLIT_STORAGE_KEY, String(pct));
        } catch {}
        return pct;
      });
    };
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
    return () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };
  }, []);

  const startDrag = () => {
    draggingRef.current = true;
    document.body.style.cursor = "col-resize";
    document.body.style.userSelect = "none";
  };

  return (
    <div className="h-screen flex flex-col bg-gray-50">
      <header className="flex-shrink-0 h-14 px-4 sm:px-6 flex items-center justify-between border-b border-gray-200 bg-white z-10">
        <div className="flex items-center gap-3 min-w-0">
          <Link
            href="/jobs"
            className="text-xs font-semibold text-gray-500 hover:text-gray-800 px-3 py-1.5 rounded-lg hover:bg-gray-100 transition-colors flex-shrink-0"
          >
            ← My Research
          </Link>
          <span className="text-gray-300">|</span>
          <span className="text-sm font-bold text-gray-900 truncate">
            ✨ {idea?.text ?? "Bold Idea session"}
          </span>
        </div>
        <Link
          href="/bold-idea"
          className="text-xs font-semibold px-3 py-1.5 rounded-lg text-white flex-shrink-0"
          style={{ background: "linear-gradient(135deg, #f97316, #db2777)" }}
        >
          + New Bold Idea
        </Link>
      </header>

      <div ref={containerRef} className="flex-1 flex min-h-0">
        {/* Left: chat, opens with the multi-agent synthesis */}
        <div
          className="w-full lg:w-[var(--left-width)] min-w-0 bg-white flex flex-col"
          style={{ "--left-width": `${leftPct}%` } as CSSProperties}
        >
          {notFound ? (
            <div className="flex-1 flex items-center justify-center text-center px-8">
              <p className="text-sm text-gray-500">This bold idea could not be found.</p>
            </div>
          ) : idea === null ? (
            <div className="flex-1 flex flex-col items-center justify-center text-center px-8 gap-3">
              <div className="flex gap-1.5">
                <span className="w-2 h-2 rounded-full bg-orange-400 animate-bounce [animation-delay:-0.3s]" />
                <span className="w-2 h-2 rounded-full bg-pink-400 animate-bounce [animation-delay:-0.15s]" />
                <span className="w-2 h-2 rounded-full bg-purple-400 animate-bounce" />
              </div>
              <p className="text-sm text-gray-500">Loading this exploration…</p>
            </div>
          ) : (
            <AssistantChat
              jobId={ideaId}
              endpoint={`/api/bold-ideas/${ideaId}/chat`}
              enableNotes={false}
              storageKey={`bold-idea-chat:${ideaId}`}
              welcome={{
                role: "assistant",
                content: idea.trace?.chatSummary ?? "No synthesis available for this idea.",
              }}
            />
          )}
        </div>

        {/* Drag to resize the split — desktop only, the right panel is hidden below lg anyway */}
        <div
          onMouseDown={startDrag}
          className="hidden lg:flex relative flex-shrink-0 w-2.5 cursor-col-resize items-center justify-center group"
        >
          <div className="w-px h-full bg-gray-200 group-hover:bg-purple-300 transition-colors" />
          <div className="absolute w-1 h-10 rounded-full bg-gray-300 group-hover:bg-purple-400 transition-colors" />
        </div>

        {/* Right: idea -> candidate -> paper node tree, same layout language as KnowledgeTree */}
        <div className="hidden lg:block flex-1 min-w-0 overflow-y-auto bg-gray-50 border-l border-gray-200">
          <PaperTree
            ideaText={idea?.text ?? ""}
            candidates={idea?.trace?.candidates ?? []}
            loading={idea === null && !notFound}
          />
        </div>
      </div>
    </div>
  );
}

const VERDICT_MARK: Record<CriticVerdict, string> = {
  "well-supported": "✅",
  speculative: "🤔",
  contradicted: "❌",
};

const VERDICT_LABEL: Record<CriticVerdict, string> = {
  "well-supported": "Well-supported",
  speculative: "Speculative",
  contradicted: "Contradicted",
};

const VERDICT_STYLE: Record<CriticVerdict, { idle: string; idleBadge: string; selected: string; selectedBadge: string }> = {
  "well-supported": {
    idle: "bg-white border-gray-200 hover:border-emerald-300",
    idleBadge: "bg-emerald-50 text-emerald-700",
    selected: "bg-emerald-600 border-emerald-600 shadow-md",
    selectedBadge: "bg-emerald-700/40 text-white",
  },
  speculative: {
    idle: "bg-white border-gray-200 hover:border-amber-300",
    idleBadge: "bg-amber-50 text-amber-700",
    selected: "bg-amber-500 border-amber-500 shadow-md",
    selectedBadge: "bg-amber-600/40 text-white",
  },
  contradicted: {
    idle: "bg-white border-gray-200 hover:border-rose-300",
    idleBadge: "bg-rose-50 text-rose-700",
    selected: "bg-rose-600 border-rose-600 shadow-md",
    selectedBadge: "bg-rose-700/40 text-white",
  },
};

/** The selected candidate's session card — outer card tint and the inner critique/empty-state callout box, both color-matched to the candidate's verdict instead of unstyled floating text. */
const SESSION_CARD_STYLE: Record<CriticVerdict, string> = {
  "well-supported": "border-emerald-200 bg-emerald-50/40",
  speculative: "border-amber-200 bg-amber-50/40",
  contradicted: "border-rose-200 bg-rose-50/40",
};

const CALLOUT_STYLE: Record<CriticVerdict, string> = {
  "well-supported": "bg-emerald-100 border-emerald-200 text-emerald-800",
  speculative: "bg-amber-100 border-amber-200 text-amber-800",
  contradicted: "bg-rose-100 border-rose-200 text-rose-800",
};

/** Idea (root) -> candidate directions (children) -> each candidate's papers (grandchildren) — mirrors KnowledgeTree's parent/child pill-and-connector layout instead of a flat card grid. */
function PaperTree({
  ideaText,
  candidates,
  loading,
}: {
  ideaText: string;
  candidates: CandidateVerdict[];
  loading: boolean;
}) {
  const [selected, setSelected] = useState(0);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="animate-spin rounded-full h-10 w-10 border-b-4 border-purple-500" />
      </div>
    );
  }

  if (candidates.length === 0) {
    return (
      <div className="flex items-center justify-center h-full px-8 text-center">
        <p className="text-sm text-gray-400">No candidate directions were found for this idea.</p>
      </div>
    );
  }

  // Older ideas were created before CandidateVerdict carried a `papers` field
  // (their agentTraceJson was serialized under the old shape) — default to
  // an empty list rather than let `active.papers` be undefined.
  const active = { ...candidates[selected], papers: candidates[selected]?.papers ?? [] };

  return (
    <div className="p-8 max-w-4xl mx-auto">
      {/* Root node: the idea itself */}
      <div className="flex flex-col items-center">
        <div className="px-6 py-3 rounded-lg bg-gray-900 text-white text-sm font-semibold shadow-md text-center max-w-2xl leading-snug">
          {ideaText}
        </div>
        <div className="w-0.5 h-8 bg-gray-300 my-3" />

        {/* Child nodes: candidate directions — an even grid so different-length titles still line up, instead of flex-wrap's mismatched pill widths */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 w-full">
          {candidates.map((c, i) => {
            const style = VERDICT_STYLE[c.verdict];
            const isSelected = i === selected;
            return (
              <button
                key={c.title}
                onClick={() => setSelected(i)}
                aria-pressed={isSelected}
                className={`flex flex-col items-start gap-1.5 w-full h-full px-4 py-3 rounded-xl border-2 text-left transition-all ${
                  isSelected ? style.selected : style.idle
                }`}
              >
                <span
                  className={`text-sm font-semibold leading-snug ${isSelected ? "text-white" : "text-gray-900"}`}
                >
                  {c.title}
                </span>
                <span
                  className={`inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wide px-1.5 py-0.5 rounded-full ${
                    isSelected ? style.selectedBadge : style.idleBadge
                  }`}
                >
                  {VERDICT_MARK[c.verdict]} {VERDICT_LABEL[c.verdict]}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Selected candidate's session: a large, color-matched card holding its critique and its own papers (grandchild nodes) — not floating unstyled text below the tree */}
      <div className="mt-6 flex flex-col items-center">
        <div className="w-0.5 h-8 bg-gray-300" />
        <div className={`w-full rounded-2xl border-2 p-6 ${SESSION_CARD_STYLE[active.verdict]}`}>
          <div className="flex items-start justify-between gap-3 mb-4">
            <h3 className="text-sm font-bold text-gray-900 leading-snug">{active.title}</h3>
            <span
              className={`flex-shrink-0 inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wide px-2 py-1 rounded-full ${CALLOUT_STYLE[active.verdict]}`}
            >
              {VERDICT_MARK[active.verdict]} {VERDICT_LABEL[active.verdict]}
            </span>
          </div>

          <div className={`text-xs rounded-lg border px-4 py-3 mb-5 leading-relaxed ${CALLOUT_STYLE[active.verdict]}`}>
            {active.critique}
          </div>

          <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wide mb-2.5">
            {active.papers.length === 0
              ? "Papers"
              : `${active.papers.length} paper${active.papers.length === 1 ? "" : "s"} found`}
          </p>

          {active.papers.length === 0 ? (
            <div className={`text-xs rounded-lg border px-4 py-3 leading-relaxed ${CALLOUT_STYLE[active.verdict]}`}>
              No papers found for this direction.
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {active.papers.map((paper) => (
                <PaperNode key={paper.url || paper.title} paper={paper} />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function PaperNode({ paper }: { paper: PaperAnalysis }) {
  const [hovered, setHovered] = useState(false);

  return (
    <div
      className="bg-white border border-gray-200 rounded-xl p-3.5 shadow-sm hover:shadow-md hover:border-purple-300 transition-all cursor-default"
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onFocus={() => setHovered(true)}
      onBlur={() => setHovered(false)}
      tabIndex={0}
    >
      <a
        href={paper.url || undefined}
        target="_blank"
        rel="noopener noreferrer"
        className="text-xs font-semibold text-gray-900 hover:text-purple-700 hover:underline line-clamp-2"
      >
        {paper.title}
      </a>
      <p className="text-[11px] text-gray-400 mt-1">{paper.year}</p>

      {!hovered ? (
        <p className="text-[11px] text-gray-500 mt-2 line-clamp-2">{paper.summary}</p>
      ) : (
        <div className="mt-2 space-y-1.5 text-[11px]">
          <div>
            <span className="font-semibold text-purple-700">Method: </span>
            <span className="text-gray-700">{paper.method}</span>
          </div>
          <div>
            <span className="font-semibold text-pink-700">Summary: </span>
            <span className="text-gray-700">{paper.summary}</span>
          </div>
          <div>
            <span className="font-semibold text-orange-700">Gap: </span>
            <span className="text-gray-700">{paper.gap}</span>
          </div>
        </div>
      )}
    </div>
  );
}
