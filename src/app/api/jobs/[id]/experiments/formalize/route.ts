import { NextRequest, NextResponse } from 'next/server'
import { anthropic } from '@/lib/anthropic'
import { autoformalize } from '@/lib/experiments/lean'
import { configuredOrError, rateLimitOrError } from '@/lib/experiments/guard'

/**
 * Autoformalization only — no Lean check. Kept separate from /prove so the
 * generated Lean source is always shown to a human for review (and optional
 * hand-editing) before anything is run through the checker. See
 * V3-EXPERIMENTS-PLAN.md's statement-faithfulness finding: an LLM cannot be
 * the sole referee of whether a formal statement matches the informal claim.
 */
export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  const guard = configuredOrError(!!anthropic, 'ANTHROPIC_API_KEY') ?? rateLimitOrError(params.id)
  if (guard) return guard

  const { claim, priorLeanCode, priorDiagnostics, sessionContext } = (await request.json()) as {
    claim?: string
    priorLeanCode?: string
    priorDiagnostics?: string
    sessionContext?: string
  }
  if (!claim || !claim.trim()) {
    return NextResponse.json({ error: 'No claim provided' }, { status: 400 })
  }

  try {
    const leanCode = await autoformalize(claim, priorLeanCode, priorDiagnostics, sessionContext)
    return NextResponse.json({ leanCode })
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Autoformalization failed' },
      { status: 502 }
    )
  }
}
