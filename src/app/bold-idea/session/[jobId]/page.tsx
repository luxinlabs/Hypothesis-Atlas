// SPDX-License-Identifier: AGPL-3.0-only
"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import AssistantChat from "@/components/AssistantChat";

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
 */
export default function BoldIdeaSessionPage({ params }: { params: { jobId: string } }) {
  const { jobId } = params;
  const [topicQuery, setTopicQuery] = useState<string | null>(null);

  useEffect(() => {
    fetch(`/api/jobs/${jobId}`)
      .then((r) => r.json())
      .then((d) => setTopicQuery(d.job?.topicQuery ?? null))
      .catch(() => {});
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
        {/* Left: chat, always visible */}
        <div className="w-full lg:w-[38%] min-w-0 border-r border-gray-200 bg-white flex flex-col">
          <AssistantChat jobId={jobId} storageKey={`bold-idea-chat:${jobId}`} />
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
