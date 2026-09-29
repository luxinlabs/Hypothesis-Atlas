// Shared types for the V3 "Experiments" module. Math was the first domain
// (formal proof verification via Lean 4); physics (dimensional analysis +
// numeric check) and chemistry/biology/drug_discovery (protocol review +
// dose/reagent math) plug into the same shell with their own verification
// backends (see V3-EXPERIMENTS-PLAN.md, Phase 3).
//
// Sessions are persisted server-side as `Experiment` rows (see
// prisma/schema.prisma) rather than in localStorage, so they can be linked
// together (see `groupId`) and listed from the API.

export type ExperimentDomain = "math" | "physics" | "biology" | "chemistry" | "drug_discovery";

export const EXPERIMENT_DOMAINS: {
  id: ExperimentDomain;
  label: string;
  available: boolean;
}[] = [
  { id: "math", label: "Mathematics", available: true },
  { id: "physics", label: "Physics", available: true },
  { id: "chemistry", label: "Chemistry", available: true },
  { id: "biology", label: "Biology", available: true },
  { id: "drug_discovery", label: "Drug Discovery", available: true },
];

export type ProofVerdict = "verified" | "failed" | "incomplete" | "error";

/**
 * Status shared across all domains. Hard-verification domains (math, physics)
 * use the full proof-style vocabulary; soft-review domains (chemistry,
 * biology, drug_discovery) mostly land on "flagged" or "verified" since there
 * is no formal checker to reject/accept a protocol outright.
 */
export type ClaimStatus = ProofVerdict | "formalizing" | "ready" | "verifying" | "flagged" | "draft";

// --- Domain-specific result payloads (stored as Experiment.resultJson) ---

export interface MathResult {
  leanCode: string;
  hasSorry?: boolean;
  diagnostics?: string;
  note?: string;
}

export interface PhysicsResult {
  expression: string;
  expected: string;
  computed: number | null;
  unitsOk: boolean | null;
  numericOk: boolean | null;
  unitError?: string;
  note?: string;
}

export interface ProtocolFlag {
  step: string;
  reason: string;
  severity: "low" | "medium" | "high";
}

export interface ProtocolResult {
  numericChecks: {
    label: string;
    expression: string;
    expected: string;
    computed: number | null;
    ok: boolean | null;
  }[];
  flags: ProtocolFlag[];
  note?: string;
}

export type ExperimentResult = MathResult | PhysicsResult | ProtocolResult;

/**
 * One claim/session in a research job's Experiments notebook, persisted as
 * an `Experiment` row. The workflow is client-driven and explicit rather
 * than one opaque "verify" call — see each domain's verify route for its
 * own state machine (math: formalize -> ready -> verify; physics/protocol:
 * state claim -> verify directly).
 */
export interface ExperimentRecord {
  id: string;
  jobId: string;
  domain: ExperimentDomain;
  claim: string;
  status: ClaimStatus;
  result: ExperimentResult | null;
  groupId: string | null;
  createdAt: string;
  updatedAt: string;
}
