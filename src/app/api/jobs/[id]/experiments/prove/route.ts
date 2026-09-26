import { NextRequest, NextResponse } from 'next/server'
import { anthropic, ANTHROPIC_MODEL } from '@/lib/anthropic'
import type { ProofAttempt, ProofResult, ProofVerdict } from '@/lib/experiments/types'

// How many autoformalize -> check -> (on failure) retry-with-error-feedback
// rounds we'll run before giving up. Keeps latency/cost bounded — see
// V3-EXPERIMENTS-PLAN.md Phase 1.
const MAX_ATTEMPTS = 3

// Lean typechecking can hang on pathological input; bound it rather than
// tying up the request indefinitely (Phase 2 guardrail). Slightly above the
// checker's own 50s kill timer so a slow proof comes back as a clean "timed
// out" result from the service instead of an aborted request.
const LEAN_SERVICE_TIMEOUT_MS = 60_000

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
- Begin the file with \`import Mathlib\`.
- State the theorem so it faithfully captures the claim — never weaken or \
  change the statement to make the proof easier.
- Prefer standard Mathlib lemmas and tactics (ring, linarith, nlinarith, simp, \
  induction, omega, field_simp, norm_num) over ad-hoc proofs.
- Do not use #eval, axiom, IO, or metaprogramming (elab, run_cmd) — the \
  checker rejects them.
- If you cannot complete the proof, still emit a syntactically valid theorem \
  statement and use \`sorry\` for the parts you can't close — never fabricate \
  a proof that doesn't type-check.
- Respond with ONLY the Lean 4 source code, no prose, no markdown fences.`

interface LeanCheckResponse {
  success: boolean
  errors?: string
  sorryCount?: number
}

type LeanCheckOutcome =
  | { kind: 'not-configured' }
  | { kind: 'unreachable'; message: string }
  | { kind: 'checked'; result: LeanCheckResponse }

/**
 * Calls the Lean 4 + Mathlib checking service at LEAN_SERVICE_URL (see
 * lean-checker/ and `make lean-up`). An unreachable service is reported
 * separately from a failed proof so we don't burn retries feeding "fetch
 * failed" back to the model as if it were a Lean error.
 */
async function checkWithLeanService(leanCode: string): Promise<LeanCheckOutcome> {
  const url = process.env.LEAN_SERVICE_URL
  if (!url) return { kind: 'not-configured' }

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
      return { kind: 'unreachable', message: `Lean service returned HTTP ${res.status}` }
    }
    return { kind: 'checked', result: (await res.json()) as LeanCheckResponse }
  } catch (err) {
    if (err instanceof Error && err.name === 'AbortError') {
      // Reachable but too slow — a simpler proof might pass, so treat as a failed check.
      return {
        kind: 'checked',
        result: {
          success: false,
          errors: `Lean check timed out after ${LEAN_SERVICE_TIMEOUT_MS / 1000}s`,
        },
      }
    }
    return {
      kind: 'unreachable',
      message: err instanceof Error ? err.message : 'Lean service request failed',
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

    const outcome = await checkWithLeanService(leanCode)
    if (outcome.kind === 'not-configured') {
      // No Lean service configured — surface the generated formalization
      // without a verified/failed verdict rather than claiming success.
      attempts.push({ leanCode })
      verdict = 'incomplete'
      note = 'LEAN_SERVICE_URL is not configured — showing the autoformalized proof unverified. Configure a Lean 4 + Mathlib checking service to get a real verdict.'
      break
    }
    if (outcome.kind === 'unreachable') {
      // Infrastructure problem, not a proof problem — retrying won't help.
      attempts.push({ leanCode })
      verdict = 'error'
      note = `Could not reach the Lean checker (${outcome.message}). Is it running? Start it with \`make lean-up\`.`
      break
    }

    const checked = outcome.result
    const attempt: ProofAttempt = { leanCode, diagnostics: checked.errors }
    attempts.push(attempt)

    if (checked.success && !checked.sorryCount) {
      verdict = 'verified'
      note = 'Lean accepted this proof. The checker verifies the proof, not the translation — confirm the theorem statement below says what you meant.'
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

  if (verdict === 'failed' && !note) {
    note = `Lean rejected the proof after ${attempts.length} attempt(s) — see the error below.`
  }

  const result: ProofResult = { claim, verdict, attempts, hasSorry, note }
  return NextResponse.json(result)
}
