"use client";

import Link from "next/link";
import ProveClaimPanel from "@/components/ProveClaimPanel";

/**
 * Standalone Experiments session. Not gated behind a research job's paper
 * pipeline — the prove route only uses the job id as a rate-limit key (see
 * src/app/api/jobs/[id]/experiments/prove/route.ts), so this page uses a
 * fixed session id and works on its own.
 *
 * Mathematics is the first domain (Lean 4 proof verification, via
 * ProveClaimPanel's own domain selector); physics/biology/chemistry are
 * scaffolded there as "coming soon" — see V3-EXPERIMENTS-PLAN.md.
 */
export default function ExperimentsPage() {
  return (
    <main className="min-h-screen bg-gradient-to-b from-white to-zinc-50 text-gray-900">
      <div className="max-w-2xl mx-auto px-6 py-8">
        <header className="flex items-center justify-between mb-8 flex-wrap gap-4">
          <div className="flex items-center gap-3">
            <div
              className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
              style={{ background: "linear-gradient(135deg, #4f46e5, #6366f1)" }}
            >
              <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 3h6m-5 0v6.09a2 2 0 01-.4 1.2L5.3 17.5A2 2 0 007 21h10a2 2 0 001.7-3.5l-4.3-7.21a2 2 0 01-.4-1.2V3m-5 0h5" />
              </svg>
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-2xl font-bold">Experiments</h1>
                <span className="text-[10px] font-bold uppercase tracking-wide text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded">
                  V3
                </span>
              </div>
              <p className="text-sm text-gray-500">
                Pick a domain below. Mathematics is live today — claims are checked by a real
                proof assistant, not just an LLM self-report.
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <Link
              href="/explore"
              className="px-4 py-2 rounded-lg font-semibold text-sm border border-gray-200 text-gray-600 hover:bg-gray-50 transition-colors"
            >
              Explore
            </Link>
            <Link
              href="/jobs"
              className="px-4 py-2 rounded-lg font-semibold text-sm border border-gray-200 text-gray-600 hover:bg-gray-50 transition-colors"
            >
              My Research
            </Link>
          </div>
        </header>

        <ProveClaimPanel jobId="experiments-session" />

        <p className="text-xs text-gray-400 mt-6 leading-relaxed">
          Physics, biology, and chemistry experiment domains are scaffolded but not built yet —
          see <code className="text-xs bg-gray-100 px-1 py-0.5 rounded">V3-EXPERIMENTS-PLAN.md</code>{" "}
          in the repo. Without <code className="text-xs bg-gray-100 px-1 py-0.5 rounded">LEAN_SERVICE_URL</code>{" "}
          configured, math claims are autoformalized to Lean 4 but shown as unverified — a real
          Lean checker isn't wired up in this environment yet.
        </p>
      </div>
    </main>
  );
}
