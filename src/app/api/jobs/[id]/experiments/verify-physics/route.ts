// SPDX-License-Identifier: AGPL-3.0-only
import { NextRequest, NextResponse } from 'next/server'
import { groq } from '@/lib/groq'
import { verifyPhysicsClaim } from '@/lib/experiments/physics'
import { configuredOrError, rateLimitOrError } from '@/lib/experiments/guard'
import type { ClaimStatus, PhysicsResult } from '@/lib/experiments/types'

function statusFor(result: PhysicsResult): ClaimStatus {
  if (result.unitsOk === null) return 'incomplete'
  if (result.unitsOk === false) return 'failed'
  // A physical-plausibility violation (faster than light, below absolute
  // zero, negative mass) is a real correctness error, same tier as a
  // numeric mismatch — not a soft prediction like drug_discovery's Lipinski
  // check, so it fails rather than merely flags.
  if ((result.plausibilityFlags ?? []).length > 0) return 'failed'
  if (result.numericOk === null) return 'incomplete'
  return result.numericOk ? 'verified' : 'failed'
}

/**
 * Physics verification: dimensional-analysis + numeric check via mathjs
 * units, not a proof assistant (see V3-EXPERIMENTS-PLAN.md Phase 3 — physics
 * needs a simulation/numeric backend, not Lean). Distinct from the math
 * domain's formalize/prove split: physics claims are checked directly since
 * there's no formal statement to review before running the checker.
 */
export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  const guard = configuredOrError(!!groq, 'GROQ_API_KEY') ?? rateLimitOrError(params.id)
  if (guard) return guard

  const { claim, sessionContext } = (await request.json().catch(() => ({}))) as { claim?: string; sessionContext?: string }
  if (!claim || !claim.trim()) {
    return NextResponse.json({ error: 'No claim provided' }, { status: 400 })
  }

  const result = await verifyPhysicsClaim(claim, sessionContext)
  return NextResponse.json({ result, status: statusFor(result) })
}
