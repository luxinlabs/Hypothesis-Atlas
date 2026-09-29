import { NextRequest, NextResponse } from 'next/server'
import { groq } from '@/lib/groq'
import { verifyPhysicsClaim } from '@/lib/experiments/physics'
import { isRateLimited, RATE_LIMIT_MAX_REQUESTS_PER_MIN } from '@/lib/experiments/lean'
import type { ClaimStatus, PhysicsResult } from '@/lib/experiments/types'

function statusFor(result: PhysicsResult): ClaimStatus {
  if (result.unitsOk === null) return 'incomplete'
  if (result.unitsOk === false) return 'failed'
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
  if (!groq) {
    return NextResponse.json(
      { error: 'GROQ_API_KEY is not configured. Add it to your .env.local file.' },
      { status: 503 }
    )
  }
  if (isRateLimited(params.id)) {
    return NextResponse.json(
      { error: `Too many requests for this job — wait a minute and try again (limit: ${RATE_LIMIT_MAX_REQUESTS_PER_MIN}/min).` },
      { status: 429 }
    )
  }

  const { claim } = (await request.json().catch(() => ({}))) as { claim?: string }
  if (!claim || !claim.trim()) {
    return NextResponse.json({ error: 'No claim provided' }, { status: 400 })
  }

  const result = await verifyPhysicsClaim(claim)
  return NextResponse.json({ result, status: statusFor(result) })
}
