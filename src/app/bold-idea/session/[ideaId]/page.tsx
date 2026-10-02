// SPDX-License-Identifier: AGPL-3.0-only
"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import AssistantChat from "@/components/AssistantChat";
import type { PaperAnalysis, BoldIdeaAgentTrace } from "@/lib/boldIdeaAgents";

interface BoldIdeaDetail {
  id: string;
  text: string;
  tags: string[];
  trace: BoldIdeaAgentTrace | null;
}

/**
 * Bold Idea's split-screen session view: chat on the left (opens with the
 * multi-agent synthesis — Summary / Gap / What we can still do), and a
 * lightweight papers panel on the right where hovering a paper reveals its
 * Method / Summary / Gap. No embedded /job/[id] iframe and no Write Paper
 * tab here — a bold idea is a self-contained exploration, not an on-ramp
 * into the Knowledge Tree pipeline.
 *
 * POST /api/bold-ideas now runs the whole multi-agent pipeline
 * synchronously, so the trace already exists by the time this page loads —
 * a single fetch on mount, no polling.
 */
export default function BoldIdeaSessionPage({ params }: { params: { ideaId: string } }) {
  const { ideaId } = params;
  const [idea, setIdea] = useState<BoldIdeaDetail | null>(null);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    fetch(`/api/bold-ideas/${ideaId}`)
      .then((r) => {
        if (!r.ok) throw new Error("not found");
        return r.json();
      })
      .then((d) => setIdea(d))
      .catch(() => setNotFound(true));
  }, [ideaId]);

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

      <div className="flex-1 flex min-h-0">
        {/* Left: chat, opens with the multi-agent synthesis */}
        <div className="w-full lg:w-[38%] min-w-0 border-r border-gray-200 bg-white flex flex-col">
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

        {/* Right: papers found during exploration — hover for method/summary/gap */}
        <div className="hidden lg:block flex-1 min-w-0 overflow-y-auto bg-gray-50">
          <PapersPanel papers={idea?.trace?.papers ?? []} loading={idea === null && !notFound} />
        </div>
      </div>
    </div>
  );
}

function PapersPanel({ papers, loading }: { papers: PaperAnalysis[]; loading: boolean }) {
  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center h-full">
        <p className="text-sm text-gray-400">Loading papers…</p>
      </div>
    );
  }

  if (papers.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center h-full px-8 text-center">
        <p className="text-sm text-gray-400">No papers were found for this idea.</p>
      </div>
    );
  }

  return (
    <div className="p-6 grid grid-cols-1 sm:grid-cols-2 gap-4">
      {papers.map((paper) => (
        <PaperCard key={paper.url || paper.title} paper={paper} />
      ))}
    </div>
  );
}

function PaperCard({ paper }: { paper: PaperAnalysis }) {
  const [hovered, setHovered] = useState(false);

  return (
    <div
      className="group relative bg-white border border-gray-200 rounded-xl p-4 shadow-sm hover:shadow-md hover:border-purple-300 transition-all cursor-default"
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
        className="text-sm font-semibold text-gray-900 hover:text-purple-700 hover:underline line-clamp-2"
      >
        {paper.title}
      </a>
      <p className="text-xs text-gray-400 mt-1">{paper.year}</p>

      {!hovered && (
        <p className="text-xs text-gray-500 mt-2 line-clamp-2">{paper.summary}</p>
      )}

      {hovered && (
        <div className="mt-2 space-y-2 text-xs">
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
