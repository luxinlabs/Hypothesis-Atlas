import { NextRequest, NextResponse } from 'next/server'
import { anthropic } from '@/lib/anthropic'
import { autoformalize, isRateLimited, RATE_LIMIT_MAX_REQUESTS_PER_MIN } from '@/lib/experiments/lean'

/**
 * Autoformalization only — no Lean check. Kept separate from /prove so the
 * generated Lean source is always shown to a human for review (and optional
 * hand-editing) before anything is run through the checker. See
 * V3-EXPERIMENTS-PLAN.md's statement-faithfulness finding: an LLM cannot be
 * the sole referee of whether a formal statement matches the informal claim.
 */
export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  if (!anthropic) {
    return NextResponse.json(
      { error: 'ANTHROPIC_API_KEY is not configured. Add it to your .env.local file.' },
      { status: 503 }
    )
  }

  if (isRateLimited(params.id)) {
    return NextResponse.json(
      { error: `Too many requests for this job — wait a minute and try again (limit: ${RATE_LIMIT_MAX_REQUESTS_PER_MIN}/min).` },
      { status: 429 }
    )
  }

  const { claim, priorLeanCode, priorDiagnostics } = (await request.json()) as {
    claim?: string
    priorLeanCode?: string
    priorDiagnostics?: string
  }
  if (!claim || !claim.trim()) {
    return NextResponse.json({ error: 'No claim provided' }, { status: 400 })
  }

  try {
    const leanCode = await autoformalize(claim, priorLeanCode, priorDiagnostics)
    return NextResponse.json({ leanCode })
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Autoformalization failed' },
      { status: 502 }
    )
  }
}
