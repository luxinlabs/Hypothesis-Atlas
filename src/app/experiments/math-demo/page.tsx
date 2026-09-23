"use client";

import Link from "next/link";
import ProveClaimPanel from "@/components/ProveClaimPanel";

/**
 * Standalone demo of the V3 "Mathematics" experiment domain — no job/research
 * run required. The prove route only uses the job id as a rate-limit key
 * (see src/app/api/jobs/[id]/experiments/prove/route.ts), so a fixed demo id
 * is safe here.
 */
export default function MathExperimentDemoPage() {
  return (
    <main className="min-h-screen bg-gradient-to-b from-white to-zinc-50">
      <div className="container mx-auto px-4 py-8 max-w-2xl">
        <Link
          href="/"
          className="inline-flex items-center gap-2 text-gray-600 hover:text-gray-900 transition-colors text-sm mb-8"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
          </svg>
          Back to Home
        </Link>

        <div className="mb-2 flex items-center gap-2">
          <span className="text-[10px] font-bold uppercase tracking-wide text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded">
            V3 · Experiments
          </span>
          <span className="text-[10px] font-bold uppercase tracking-wide text-violet-600 bg-violet-50 px-2 py-0.5 rounded">
            Mathematics
          </span>
        </div>
        <h1 className="text-2xl font-bold text-gray-900 mb-2">Math Proof Experiment — Demo</h1>
        <p className="text-sm text-gray-500 mb-8 leading-relaxed">
          This is the standalone entry point for the Mathematics experiment domain, the first
          domain in the V3 Experiments module (physics/biology/chemistry are scaffolded but not
          built yet — see <code className="text-xs bg-gray-100 px-1 py-0.5 rounded">V3-EXPERIMENTS-PLAN.md</code>).
          Click one of the &ldquo;Try&rdquo; examples below, then <strong>Prove claim</strong>.
          Without <code className="text-xs bg-gray-100 px-1 py-0.5 rounded">LEAN_SERVICE_URL</code>{" "}
          configured, you'll see the autoformalized Lean 4 code generated but marked{" "}
          <strong>unverified</strong> — that's expected; it shows the pipeline working end-to-end
          up to the point where a real Lean checker would confirm it.
        </p>

        <ProveClaimPanel jobId="demo-math" />

        <p className="text-xs text-gray-400 mt-6">
          In the full product this same panel lives inside a research job at{" "}
          <code className="bg-gray-100 px-1 py-0.5 rounded">/job/[id]/paper?step=experiments</code>.
        </p>
      </div>
    </main>
  );
}
