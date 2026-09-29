import type { ExperimentRecord, MathResult, PhysicsResult, ProtocolResult } from './types'

function resultSummary(record: ExperimentRecord): string {
  if (!record.result) return record.status
  if (record.domain === 'math') {
    const r = record.result as MathResult
    if (r.hasSorry) return 'proved with an unproved `sorry` step'
    return record.status === 'verified' ? 'proved in Lean' : record.status
  }
  if (record.domain === 'physics') {
    const r = record.result as PhysicsResult
    if (r.unitsOk === false) return `dimensional mismatch (${r.unitError ?? 'units incompatible'})`
    if (r.numericOk === false) return 'units consistent but numeric value did not match'
    if (r.numericOk === true) return 'verified — units and numeric value match'
    return record.status
  }
  const r = record.result as ProtocolResult
  const flagCount = r.flags?.length ?? 0
  return flagCount > 0 ? `${flagCount} flag(s) raised on review` : record.status
}

/**
 * Formats linked sessions as a short read-only context block for an LLM
 * prompt (autoformalize, physics extraction, protocol review). This is
 * background only — the linked session's claim/result is shown so the model
 * can avoid contradicting or re-deriving it, but it is never treated as a
 * verified premise the new claim can lean on. See the V3 follow-up on
 * sharing verification context across linked sessions.
 */
export function formatLinkedContext(sessions: ExperimentRecord[]): string | undefined {
  if (sessions.length === 0) return undefined
  return sessions.map((s) => `- [${s.domain}] "${s.claim}" — ${resultSummary(s)}`).join('\n')
}
