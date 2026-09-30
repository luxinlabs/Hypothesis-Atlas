// Shared types for the V3 "Experiments" module. Math was the first domain
// (formal proof verification via Lean 4); physics (dimensional analysis +
// numeric check) and chemistry/biology/drug_discovery (protocol review +
// dose/reagent math, plus a Lipinski Rule of Five check for drug_discovery)
// plug into the same shell with their own verification backends (see
// V3-EXPERIMENTS-PLAN.md, Phase 3).
//
// Claims are persisted server-side as `Experiment` rows (see
// prisma/schema.prisma), grouped into `ExperimentSession`s. A session is
// scoped to exactly one domain by construction — this replaced an earlier
// groupId-based "linking" scheme that had no domain check and let a math
// claim and a drug-discovery claim end up sharing context.

export type ExperimentDomain = "math" | "physics" | "biology" | "chemistry" | "drug_discovery";

/**
 * Which verification backend a domain uses. Every place that needs to route
 * by domain (creating a claim, verifying it, summarizing it, choosing which
 * workspace component to render) should classify through this one function
 * rather than re-writing its own `domain === 'math' ? ... : domain ===
 * 'physics' ? ...` chain — four such chains existed independently before
 * (ProveClaimPanel's create/verify dispatch, its summary line, its render
 * switch, and context.ts's result summary) and could silently drift out of
 * sync when a domain was added.
 */
export type DomainKind = "math" | "physics" | "protocol";

export function domainKind(domain: ExperimentDomain): DomainKind {
  if (domain === "math") return "math";
  if (domain === "physics") return "physics";
  return "protocol";
}

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

export interface GroundedFact {
  compound: string;
  molecularWeightGMol: number | null;
  source: string;
}

export interface DrugLikeness {
  compound: string;
  molecularWeightGMol: number | null;
  xLogP: number | null;
  hBondDonorCount: number | null;
  hBondAcceptorCount: number | null;
  violations: string[];
  passesRuleOfFive: boolean;
  source: string;
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
  /** Reference facts pulled from an external database (currently: PubChem for chemistry), not the LLM's own recollection. */
  groundedFacts?: GroundedFact[];
  /** drug_discovery only: Lipinski's Rule of Five, evaluated against real PubChem descriptors — a genuine pharmacology check, not arithmetic. */
  drugLikeness?: DrugLikeness[];
  note?: string;
}

export type ExperimentResult = MathResult | PhysicsResult | ProtocolResult;

/**
 * One claim in a session's Experiments notebook, persisted as an
 * `Experiment` row. The workflow is client-driven and explicit rather than
 * one opaque "verify" call — see each domain's verify route for its own
 * state machine (math: formalize -> ready -> verify; physics/protocol:
 * state claim -> verify directly).
 */
export interface ExperimentRecord {
  id: string;
  jobId: string;
  sessionId: string;
  domain: ExperimentDomain;
  claim: string;
  status: ClaimStatus;
  result: ExperimentResult | null;
  createdAt: string;
  updatedAt: string;
}

/**
 * A conversation thread, scoped to exactly one domain. Claims (Experiment
 * rows) belong to a session; a session's domain determines what its claims
 * are checked as, and there is no way to mix domains within one session.
 */
export interface ExperimentSessionRecord {
  id: string;
  jobId: string;
  domain: ExperimentDomain;
  title: string | null;
  createdAt: string;
  updatedAt: string;
}
