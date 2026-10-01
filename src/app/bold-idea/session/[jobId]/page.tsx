// SPDX-License-Identifier: AGPL-3.0-only
"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import AssistantChat from "@/components/AssistantChat";

interface BoldIdeaWithTrace {
  id: string;
  jobId: string | null;
  agentTrace: { synthesisMarkdown: string } | null;
}

/**
 * Bold Idea's split-screen session view: chat permanently on the left,
 * the existing research pages (Knowledge Tree / Topic Workspace / Paper Map
 * / Notes / Write Paper — all of it, unmodified) on the right via an
 * embedded frame. This is a Bold-Idea-only surface — the regular word-cloud
 * flow still lands on the unmodified /job/[id] page directly, full-width,
 * with no chat pane and no change to its behavior.
 *
 * The right pane is an iframe rather than a shared/extracted component on
 * purpose: /job/[id] is a large, already-working page, and the instruction
 * for this session was explicit — try the bold idea, don't touch the
 * original workflow. An iframe gets the full existing page (every tab,
 * exactly as it already behaves) with zero risk of regressing it.
 *
 * The chat's opening message is the multi-agent trace (Explorer/Literature/
 * Critic — see lib/boldIdeaAgents.ts), which runs in the background after
 * the idea is submitted and is polled for here until it lands.
 */
export default function BoldIdeaSessionPage({ params }: { params: { jobId: string } }) {
  const { jobId } = params;
  const [topicQuery, setTopicQuery] = useState<string | null>(null);
  const [welcomeContent, setWelcomeContent] = useState<string | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    fetch(`/api/jobs/${jobId}`)
      .then((r) => r.json())
      .then((d) => setTopicQuery(d.topicQuery ?? null))
      .catch(() => {});
  }, [jobId]);

  useEffect(() => {
    const checkTrace = () => {
      fetch(`/api/bold-ideas?limit=50`)
        .then((r) => r.json())
        .then((d) => {
          const idea = (d.ideas ?? []).find((i: BoldIdeaWithTrace) => i.jobId === jobId);
          if (idea?.agentTrace?.synthesisMarkdown) {
            setWelcomeContent(idea.agentTrace.synthesisMarkdown);
            if (pollRef.current) clearInterval(pollRef.current);
          }
        })
        .catch(() => {});
    };
    checkTrace();
    pollRef.current = setInterval(checkTrace, 4000);
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, [jobId]);

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
            ✨ {topicQuery ?? "Bold Idea session"}
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
        {/* Left: chat, always visible — opens with the multi-agent synthesis once it's ready */}
        <div className="w-full lg:w-[38%] min-w-0 border-r border-gray-200 bg-white flex flex-col">
          {welcomeContent === null ? (
            <div className="flex-1 flex flex-col items-center justify-center text-center px-8 gap-3">
              <div className="flex gap-1.5">
                <span className="w-2 h-2 rounded-full bg-orange-400 animate-bounce [animation-delay:-0.3s]" />
                <span className="w-2 h-2 rounded-full bg-pink-400 animate-bounce [animation-delay:-0.15s]" />
                <span className="w-2 h-2 rounded-full bg-purple-400 animate-bounce" />
              </div>
              <p className="text-sm text-gray-500">
                Exploring this idea across multiple directions, searching literature, and cross-checking
                with a second model…
              </p>
            </div>
          ) : (
            <AssistantChat
              jobId={jobId}
              storageKey={`bold-idea-chat:${jobId}`}
              welcome={{ role: "assistant", content: welcomeContent }}
            />
          )}
        </div>

        {/* Right: the existing, unmodified research pages (all tabs) */}
        <div className="hidden lg:block flex-1 min-w-0">
          <iframe
            src={`/job/${jobId}`}
            title="Research session"
            className="w-full h-full border-0"
          />
        </div>
      </div>
    </div>
  );
}
