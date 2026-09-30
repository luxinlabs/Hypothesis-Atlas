// SPDX-License-Identifier: AGPL-3.0-only
import { NextRequest, NextResponse } from 'next/server'
import { groq } from '@/lib/groq'
import { verifyProtocolClaim } from '@/lib/experiments/protocol'
import { configuredOrError, rateLimitOrError } from '@/lib/experiments/guard'
import type { ClaimStatus, ProtocolResult } from '@/lib/experiments/types'

const PROTOCOL_DOMAINS = new Set(['chemistry', 'biology', 'drug_discovery'])

function statusFor(result: ProtocolResult): ClaimStatus {
  const checked = result.numericChecks.filter((c) => c.ok !== null)
  const anyNumericFailed = checked.some((c) => c.ok === false)
  const anyHighFlag = result.flags.some((f) => f.severity === 'high')
  if (anyNumericFailed || anyHighFlag) return 'failed'
  // A Rule of Five violation is a prediction about oral bioavailability, not
  // a correctness error like bad arithmetic — surface it as "flagged" (soft
  // review), same tier as an LLM-raised flag, never "failed".
  const anyPoorDrugLikeness = (result.drugLikeness ?? []).some((d) => !d.passesRuleOfFive)
  if (result.flags.length > 0 || anyPoorDrugLikeness) return 'flagged'
  // A clean drug-likeness pass is itself a completed check, same as a
  // passing numeric check — it shouldn't report "incomplete" just because
  // no arithmetic happened to be checkable in this claim.
  if (checked.length > 0 || (result.drugLikeness ?? []).length > 0) return 'verified'
  return 'incomplete'
}

/**
 * Shared verification route for chemistry, biology, and drug_discovery —
 * they differ in prompt focus (reagent math vs. dose math vs. sample-size
 * math) but share the same "soft review, not a proof" shape (see
 * V3-EXPERIMENTS-PLAN.md Phase 3), so one route serves all three rather than
 * three near-identical ones.
 */
export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  const guard = configuredOrError(!!groq, 'GROQ_API_KEY') ?? rateLimitOrError(params.id)
  if (guard) return guard

  const { domain, claim, sessionContext } = (await request.json().catch(() => ({}))) as {
    domain?: string
    claim?: string
    sessionContext?: string
  }
  if (!domain || !PROTOCOL_DOMAINS.has(domain)) {
    return NextResponse.json({ error: `Domain must be one of: ${[...PROTOCOL_DOMAINS].join(', ')}` }, { status: 400 })
  }
  if (!claim || !claim.trim()) {
    return NextResponse.json({ error: 'No claim provided' }, { status: 400 })
  }

  const result = await verifyProtocolClaim(domain as 'chemistry' | 'biology' | 'drug_discovery', claim, sessionContext)
  return NextResponse.json({ result, status: statusFor(result) })
}
