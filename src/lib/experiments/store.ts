import type { Experiment } from "@prisma/client";
import type { ExperimentDomain, ExperimentRecord, ExperimentResult, ClaimStatus } from "./types";

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
    domain: row.domain as ExperimentDomain,
    claim: row.claim,
    status: row.status as ClaimStatus,
    result,
    groupId: row.groupId,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}
