import { NextRequest, NextResponse } from 'next/server'
import { groq } from '@/lib/groq'
import { verifyProtocolClaim } from '@/lib/experiments/protocol'
import { isRateLimited, RATE_LIMIT_MAX_REQUESTS_PER_MIN } from '@/lib/experiments/lean'
import type { ClaimStatus, ProtocolResult } from '@/lib/experiments/types'

const PROTOCOL_DOMAINS = new Set(['chemistry', 'biology', 'drug_discovery'])

function statusFor(result: ProtocolResult): ClaimStatus {
  const checked = result.numericChecks.filter((c) => c.ok !== null)
  const anyNumericFailed = checked.some((c) => c.ok === false)
  const anyHighFlag = result.flags.some((f) => f.severity === 'high')
  if (anyNumericFailed || anyHighFlag) return 'failed'
  if (result.flags.length > 0) return 'flagged'
  if (checked.length > 0) return 'verified'
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
