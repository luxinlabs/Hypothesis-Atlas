import { anthropic, ANTHROPIC_MODEL } from '@/lib/anthropic'

// Lean typechecking can hang on pathological input; bound it rather than
// tying up the request indefinitely. Slightly above the checker's own 50s
// kill timer so a slow proof comes back as a clean "timed out" result from
// the service instead of an aborted request.
const LEAN_SERVICE_TIMEOUT_MS = 60_000

export const AUTOFORMALIZE_SYSTEM_PROMPT = `You are an expert Lean 4 + Mathlib formalizer. Given a mathematical claim \
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

export interface LeanCheckResponse {
  success: boolean
  errors?: string
  sorryCount?: number
}

export type LeanCheckOutcome =
  | { kind: 'not-configured' }
  | { kind: 'unreachable'; message: string }
  | { kind: 'checked'; result: LeanCheckResponse }

/**
 * Calls the Lean 4 + Mathlib checking service at LEAN_SERVICE_URL (see
 * lean-checker/ and `make lean-up`). An unreachable service is reported
 * separately from a failed proof so callers don't mistake "fetch failed"
 * for a Lean error.
 */
export async function checkWithLeanService(leanCode: string): Promise<LeanCheckOutcome> {
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

/**
 * Autoformalizes a claim into Lean 4 + Mathlib. When priorLeanCode/
 * priorDiagnostics are given, asks the model to fix that specific attempt
 * instead of starting fresh — used by the "ask AI to fix" action once a
 * human has already reviewed and possibly hand-edited the Lean code.
 */
export async function autoformalize(
  claim: string,
  priorLeanCode?: string,
  priorDiagnostics?: string,
  sessionContext?: string
): Promise<string> {
  if (!anthropic) throw new Error('ANTHROPIC_API_KEY is not configured')

  // Background only — see lib/experiments/context.ts. Never treated as a
  // premise the new proof can cite; just context to avoid contradicting.
  const contextBlock = sessionContext
    ? `Earlier claims already investigated in this conversation (background only — do not assume they are correct, and do not cite them as proved facts):\n${sessionContext}\n\n`
    : ''

  const userContent = priorLeanCode
    ? `${contextBlock}Claim:\n${claim}\n\nPrevious attempt:\n${priorLeanCode}\n\nLean reported these errors — fix them:\n${priorDiagnostics ?? '(no diagnostics)'}`
    : `${contextBlock}Claim:\n${claim}`

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

// Cheap per-job rate limit so one job can't spam the autoformalization LLM
// and the Lean service. In-memory only — resets on redeploy, which is fine
// for a soft guard on an experimental feature.
const RATE_LIMIT_WINDOW_MS = 60_000
const RATE_LIMIT_MAX_REQUESTS = 10
const requestLog = new Map<string, number[]>()

export function isRateLimited(jobId: string): boolean {
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

export const RATE_LIMIT_MAX_REQUESTS_PER_MIN = RATE_LIMIT_MAX_REQUESTS
