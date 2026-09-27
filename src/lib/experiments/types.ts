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

/**
 * One claim in a research session's notebook. The workflow is client-driven
 * and explicit rather than one opaque "Prove" call:
 *
 *   formalize -> "ready" (human reviews/edits the Lean code)
 *             -> verify -> "verified" | "failed" | "incomplete" | "error"
 *             -> (on failure) "ask AI to fix" re-formalizes -> "ready" again
 *
 * "formalizing"/"verifying" are in-flight states while a request is out;
 * "ready" means Lean code exists but hasn't been checked since it last
 * changed (including right after a hand edit).
 */
export type ClaimStatus = ProofVerdict | "formalizing" | "ready" | "verifying";

export interface ClaimEntry {
  id: string;
  domain: ExperimentDomain;
  claim: string;
  leanCode: string;
  status: ClaimStatus;
  /** True once the human has looked at/edited leanCode at least once. */
  reviewed: boolean;
  /** True when the last verify reported success but the proof still has `sorry`. */
  hasSorry?: boolean;
  diagnostics?: string;
  note?: string;
  createdAt: number;
  updatedAt: number;
}
