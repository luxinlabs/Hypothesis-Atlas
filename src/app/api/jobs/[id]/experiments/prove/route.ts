import { NextRequest, NextResponse } from 'next/server'
import { checkWithLeanService } from '@/lib/experiments/lean'
import { rateLimitOrError } from '@/lib/experiments/guard'
import type { ClaimStatus } from '@/lib/experiments/types'

interface VerifyResult {
  status: ClaimStatus
  hasSorry?: boolean
  diagnostics?: string
  note?: string
}

/**
 * Verification only — checks Lean source that has already been generated
 * (and possibly hand-edited) via /formalize. This route never calls the LLM;
 * it just runs `leanCode` through LEAN_SERVICE_URL and reports what Lean
 * said. See ProveClaimPanel's "ask AI to fix" action for the retry loop —
 * it's now a visible, human-in-the-loop step rather than hidden retries.
 */
export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  const guard = rateLimitOrError(params.id)
  if (guard) return guard

  const { leanCode } = (await request.json()) as { leanCode?: string }
  if (!leanCode || !leanCode.trim()) {
    return NextResponse.json({ error: 'No Lean code provided' }, { status: 400 })
  }

  const outcome = await checkWithLeanService(leanCode)

  if (outcome.kind === 'not-configured') {
    const result: VerifyResult = {
      status: 'incomplete',
      note: 'LEAN_SERVICE_URL is not configured — this Lean code has not been checked. Configure a Lean 4 + Mathlib checking service to get a real verdict.',
    }
    return NextResponse.json(result)
  }
  if (outcome.kind === 'unreachable') {
    const result: VerifyResult = {
      status: 'error',
      note: `Could not reach the Lean checker (${outcome.message}). Is it running? Start it with \`make lean-up\`.`,
    }
    return NextResponse.json(result)
  }

  const checked = outcome.result
  if (checked.success && !checked.sorryCount) {
    const result: VerifyResult = {
      status: 'verified',
      note: 'Lean accepted this proof. The checker verifies the proof, not the translation — confirm the theorem statement above says what you meant.',
    }
    return NextResponse.json(result)
  }
  if (checked.success && checked.sorryCount) {
    const result: VerifyResult = {
      status: 'incomplete',
      hasSorry: true,
      diagnostics: checked.errors,
      note: `Type-checks but contains ${checked.sorryCount} unproved sorry step(s).`,
    }
    return NextResponse.json(result)
  }

  const result: VerifyResult = {
    status: 'failed',
    diagnostics: checked.errors,
    note: 'Lean rejected this proof — see the error below.',
  }
  return NextResponse.json(result)
}
