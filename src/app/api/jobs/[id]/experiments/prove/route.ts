import { NextRequest, NextResponse } from 'next/server'
import { anthropic, ANTHROPIC_MODEL } from '@/lib/anthropic'
import type { ProofAttempt, ProofResult, ProofVerdict } from '@/lib/experiments/types'

// How many autoformalize -> check -> (on failure) retry-with-error-feedback
// rounds we'll run before giving up. Keeps latency/cost bounded — see
// V3-EXPERIMENTS-PLAN.md Phase 1.
const MAX_ATTEMPTS = 3

// Lean typechecking can hang on pathological input; bound it rather than
// tying up the request indefinitely (Phase 2 guardrail).
const LEAN_SERVICE_TIMEOUT_MS = 20_000

// Cheap per-job rate limit so one job can't spam the autoformalization LLM
// and the Lean service. In-memory only — resets on redeploy, which is fine
// for a soft guard on an experimental feature (Phase 2 guardrail).
const RATE_LIMIT_WINDOW_MS = 60_000
const RATE_LIMIT_MAX_REQUESTS = 5
const requestLog = new Map<string, number[]>()

function isRateLimited(jobId: string): boolean {
  const now = Date.now()
  const timestamps = (requestLog.get(jobId) ?? []).filter(
    (t) => now - t < RATE_LIMIT_WINDOW_MS
  )
  if (timestamps.length >= RATE_LIMIT_MAX_REQUESTS) {
    requestLog.set(jobId, timestamps)
    return true
  }
  timestamps.push(now)
  requestLog.set(jobId, timestamps)
  return false
}

const AUTOFORMALIZE_SYSTEM_PROMPT = `You are an expert Lean 4 + Mathlib formalizer. Given a mathematical claim \
(possibly written in LaTeX and/or natural language), produce a Lean 4 theorem \
statement and a complete proof using Mathlib.

Rules:
- Prefer standard Mathlib lemmas and tactics (ring, linarith, nlinarith, simp, \
  induction, omega, field_simp, norm_num) over ad-hoc proofs.
- If you cannot complete the proof, still emit a syntactically valid theorem \
  statement and use \`sorry\` for the parts you can't close — never fabricate \
  a proof that doesn't type-check.
- Respond with ONLY the Lean 4 source code, no prose, no markdown fences.`

interface LeanCheckResponse {
  success: boolean
  errors?: string
  sorryCount?: number
}

/**
 * Calls out to an external Lean 4 + Mathlib checking service, configured via
 * LEAN_SERVICE_URL. Standing up that service (a containerized `elan` + Lean +
 * pinned Mathlib checkout exposing this HTTP contract) is an infra task
 * outside this repo — see "Open questions" in V3-EXPERIMENTS-PLAN.md.
 */
async function checkWithLeanService(leanCode: string): Promise<LeanCheckResponse | null> {
  const url = process.env.LEAN_SERVICE_URL
  if (!url) return null

  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), LEAN_SERVICE_TIMEOUT_MS)
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code: leanCode }),
      signal: controller.signal,
    })
    if (!res.ok) {
      return { success: false, errors: `Lean service returned ${res.status}` }
    }
    return (await res.json()) as LeanCheckResponse
  } catch (err) {
    const timedOut = err instanceof Error && err.name === 'AbortError'
    return {
      success: false,
      errors: timedOut
        ? `Lean check timed out after ${LEAN_SERVICE_TIMEOUT_MS / 1000}s`
        : err instanceof Error
          ? err.message
          : 'Lean service request failed',
    }
  } finally {
    clearTimeout(timeout)
  }
}

async function autoformalize(claim: string, priorAttempt?: ProofAttempt): Promise<string> {
  if (!anthropic) throw new Error('ANTHROPIC_API_KEY is not configured')

  const userContent = priorAttempt
    ? `Claim:\n${claim}\n\nPrevious attempt:\n${priorAttempt.leanCode}\n\nLean reported these errors — fix them:\n${priorAttempt.diagnostics}`
    : `Claim:\n${claim}`

  const message = await anthropic.messages.create({
    model: ANTHROPIC_MODEL,
    max_tokens: 1500,
    system: AUTOFORMALIZE_SYSTEM_PROMPT,
    messages: [{ role: 'user', content: userContent }],
  })

  const block = message.content.find((b) => b.type === 'text')
  const text = block && block.type === 'text' ? block.text : ''
  // Strip stray markdown fences in case the model adds them anyway.
  return text.replace(/^```(?:lean4?|lean)?\n?/, '').replace(/```$/, '').trim()
}

export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  if (!anthropic) {
    return NextResponse.json(
      { error: 'ANTHROPIC_API_KEY is not configured. Add it to your .env.local file.' },
      { status: 503 }
    )
  }

  if (isRateLimited(params.id)) {
    return NextResponse.json(
      { error: `Too many proof attempts for this job — wait a minute and try again (limit: ${RATE_LIMIT_MAX_REQUESTS}/min).` },
      { status: 429 }
    )
  }

  const { claim } = (await request.json()) as { claim?: string }
  if (!claim || !claim.trim()) {
    return NextResponse.json({ error: 'No claim provided' }, { status: 400 })
  }

  const attempts: ProofAttempt[] = []
  let verdict: ProofVerdict = 'error'
  let hasSorry = false
  let note: string | undefined

  let priorAttempt: ProofAttempt | undefined
  for (let i = 0; i < MAX_ATTEMPTS; i++) {
    let leanCode: string
    try {
      leanCode = await autoformalize(claim, priorAttempt)
    } catch (err) {
      note = err instanceof Error ? err.message : 'Autoformalization failed'
      break
    }

    const checked = await checkWithLeanService(leanCode)
    if (checked === null) {
      // No Lean service configured — surface the generated formalization
      // without a verified/failed verdict rather than claiming success.
      attempts.push({ leanCode })
      verdict = 'incomplete'
      note = 'LEAN_SERVICE_URL is not configured — showing the autoformalized proof unverified. Configure a Lean 4 + Mathlib checking service to get a real verdict.'
      break
    }

    const attempt: ProofAttempt = { leanCode, diagnostics: checked.errors }
    attempts.push(attempt)

    if (checked.success && !checked.sorryCount) {
      verdict = 'verified'
      break
    }
    if (checked.success && checked.sorryCount) {
      verdict = 'incomplete'
      hasSorry = true
      note = `Type-checks but contains ${checked.sorryCount} unproved sorry step(s).`
      break
    }

    // Failed — retry with the error fed back, unless we're out of attempts.
    verdict = 'failed'
    priorAttempt = attempt
  }

  const result: ProofResult = { claim, verdict, attempts, hasSorry, note }
  return NextResponse.json(result)
}
