// Shared types for the V3 "Experiments" module. Math is the first domain
// (formal proof verification via Lean 4); physics/biology/chemistry will
// plug into the same shell with domain-specific verification backends
// (see V3-EXPERIMENTS-PLAN.md, Phase 3).

export type ExperimentDomain = "math" | "physics" | "biology" | "chemistry";

export const EXPERIMENT_DOMAINS: {
  id: ExperimentDomain;
  label: string;
  available: boolean;
}[] = [
  { id: "math", label: "Mathematics", available: true },
  { id: "physics", label: "Physics", available: false },
  { id: "biology", label: "Biology", available: false },
  { id: "chemistry", label: "Chemistry", available: false },
];

export type ProofVerdict = "verified" | "failed" | "incomplete" | "error";

export interface ProofAttempt {
  /** Autoformalized Lean 4 source generated from the user's claim. */
  leanCode: string;
  /** Raw error/diagnostic output from the Lean checker, if any. */
  diagnostics?: string;
}

export interface ProofResult {
  claim: string;
  verdict: ProofVerdict;
  attempts: ProofAttempt[];
  /** True when the proof compiled but still contains `sorry`. */
  hasSorry?: boolean;
  note?: string;
}
