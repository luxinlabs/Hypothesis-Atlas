import type { Experiment, ExperimentSession } from "@prisma/client";
import type {
  ExperimentDomain,
  ExperimentRecord,
  ExperimentResult,
  ExperimentSessionRecord,
  ClaimStatus,
} from "./types";

/** Converts a persisted Experiment row into the shape the frontend consumes. */
export function serializeExperiment(row: Experiment): ExperimentRecord {
  let result: ExperimentResult | null = null;
  if (row.resultJson) {
    try {
      result = JSON.parse(row.resultJson) as ExperimentResult;
    } catch {
      result = null;
    }
  }
  return {
    id: row.id,
    jobId: row.jobId,
    sessionId: row.sessionId,
    domain: row.domain as ExperimentDomain,
    claim: row.claim,
    status: row.status as ClaimStatus,
    result,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

/** Converts a persisted ExperimentSession row into the shape the frontend consumes. */
export function serializeSession(row: ExperimentSession): ExperimentSessionRecord {
  return {
    id: row.id,
    jobId: row.jobId,
    domain: row.domain as ExperimentDomain,
    title: row.title,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}
