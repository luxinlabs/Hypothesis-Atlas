"use client";

import Link from "next/link";
import ProveClaimPanel from "@/components/ProveClaimPanel";

/**
 * Standalone Experiments session. Not gated behind a research job's paper
 * pipeline — Experiment rows carry jobId only as provenance, not an
 * enforced foreign key (see the schema comment on Experiment.jobId), so
 * this page uses a fixed session id and works on its own.
 *
 * Five domains, each with its own verification backend behind one shared
 * notebook/linking UI (ProveClaimPanel): math (Lean 4 proof), physics
 * (dimensional analysis + numeric check), chemistry/biology/drug_discovery
 * (protocol review + dose/reagent math) — see V3-EXPERIMENTS-PLAN.md.
 *
 * Full-screen app shell: a slim top bar, then the chat fills every
 * remaining pixel — this page's whole job is the conversation, so nothing
 * else should compete with it for space.
 */
export default function ExperimentsPage() {
  return (
    <main className="h-screen flex flex-col bg-gray-50 text-gray-900 overflow-hidden">
      <header className="flex-shrink-0 h-14 px-4 sm:px-6 flex items-center justify-between border-b border-gray-200 bg-white/90 backdrop-blur z-10">
        <div className="flex items-center gap-2.5 min-w-0">
          <div
            className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
            style={{ background: "linear-gradient(135deg, #4f46e5, #6366f1)" }}
          >
            <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 3h6m-5 0v6.09a2 2 0 01-.4 1.2L5.3 17.5A2 2 0 007 21h10a2 2 0 001.7-3.5l-4.3-7.21a2 2 0 01-.4-1.2V3m-5 0h5" />
            </svg>
          </div>
          <span className="text-sm font-bold truncate">Experiments</span>
          <span className="hidden sm:inline text-[10px] font-bold uppercase tracking-wide text-indigo-600 bg-indigo-50 px-1.5 py-0.5 rounded flex-shrink-0">
            V3
          </span>
        </div>
        <div className="flex items-center gap-1 flex-shrink-0">
          <Link
            href="/explore"
            className="text-xs font-semibold text-gray-500 hover:text-gray-800 px-3 py-1.5 rounded-lg hover:bg-gray-100 transition-colors"
          >
            Explore
          </Link>
          <Link
            href="/jobs"
            className="text-xs font-semibold text-gray-500 hover:text-gray-800 px-3 py-1.5 rounded-lg hover:bg-gray-100 transition-colors"
          >
            My Research
          </Link>
        </div>
      </header>

      <div className="flex-1 min-h-0">
        <ProveClaimPanel jobId="experiments-session" />
      </div>
    </main>
  );
}
