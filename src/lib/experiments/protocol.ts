import { create, all } from 'mathjs'
import { groq } from '@/lib/groq'
import { toAsciiMath, closeEnough } from './numeric'
import { lookupCompounds } from './pubchem'
import type { ExperimentDomain, ProtocolFlag, ProtocolResult } from './types'

const math = create(all)

interface RawNumericCheck {
  label?: string
  expression?: string
  expected?: string | number
}
interface RawFlag {
  step?: string
  reason?: string
  severity?: string
}
interface RawReview {
  numericChecks?: RawNumericCheck[]
  flags?: RawFlag[]
  compounds?: string[]
}

const DOMAIN_FOCUS: Record<Extract<ExperimentDomain, 'chemistry' | 'biology' | 'drug_discovery'>, string> = {
  chemistry: 'reagent quantities, molarity/concentration conversions, and stoichiometry',
  biology: 'sample sizes, replicate counts, dilution ratios, and incubation/measurement math',
  drug_discovery: 'dose math (e.g. mg/kg conversions), exposure calculations, and concentration series',
}

/**
 * Protocol review: there is no formal verifier for "is this experimental
 * protocol correct" (see V3-EXPERIMENTS-PLAN.md Phase 3), so this is
 * deliberately a review/flag step, not a pass/fail proof. It does two
 * distinct things in one LLM call:
 *   1. Extracts any checkable arithmetic (dose/reagent/dilution math) so the
 *      existing mathjs numeric path can confirm or reject it exactly like
 *      the math-domain claim verifier does.
 *   2. Flags steps that look implausible (missing controls, unit errors,
 *      dosage outside typical bounds) for human review — these are
 *      suggestions, not verdicts.
 */
async function reviewProtocol(
  domain: 'chemistry' | 'biology' | 'drug_discovery',
  claim: string,
  sessionContext?: string
): Promise<RawReview | null> {
  if (!groq) return null
  const contextBlock = sessionContext
    ? `\n\nEarlier claims already investigated in this conversation (background only, not verified facts to assume):\n${sessionContext}`
    : ''
  // Chemistry gets a third extraction task: named compounds, so their
  // molecular weight can be grounded against PubChem instead of trusting
  // the LLM's own recollection (see lookupCompounds below).
  const compoundTask =
    domain === 'chemistry'
      ? ' (3) Extract up to 3 chemical compound names mentioned by name (e.g. "NaCl", "ethanol") into "compounds".'
      : ''
  const compoundSchema = domain === 'chemistry' ? ',"compounds":["..."]' : ''
  const completion = await groq.chat.completions.create({
    model: 'openai/gpt-oss-120b',
    temperature: 0,
    max_tokens: 1200,
    messages: [
      {
        role: 'system',
        content:
          `You are reviewing a ${domain} experimental protocol/claim, focused on ${DOMAIN_FOCUS[domain]}. ` +
          'Do these things: ' +
          '(1) Extract up to 5 checkable arithmetic claims (numeric expression + its claimed value), ' +
          'converting any LaTeX to ASCII math (+, -, *, /, ^, parentheses, sqrt()). ' +
          '(2) Flag any step that looks implausible: missing controls, unit errors, a dose/concentration ' +
          `far outside typical ranges, or an internally inconsistent quantity. Do not flag stylistic issues.${compoundTask} ` +
          'Respond with ONLY JSON: {"numericChecks":[{"label":"...","expression":"...","expected":"..."}],' +
          `"flags":[{"step":"...","reason":"...","severity":"low"|"medium"|"high"}]${compoundSchema}}. ` +
          `Empty arrays are fine if nothing applies.${contextBlock}`,
      },
      { role: 'user', content: claim },
    ],
  })
  const raw = completion.choices[0]?.message?.content ?? ''
  const match = raw.match(/\{[\s\S]*\}/)
  if (!match) return null
  try {
    return JSON.parse(match[0]) as RawReview
  } catch {
    return null
  }
}

export async function verifyProtocolClaim(
  domain: 'chemistry' | 'biology' | 'drug_discovery',
  claim: string,
  sessionContext?: string
): Promise<ProtocolResult> {
  const review = await reviewProtocol(domain, claim, sessionContext)
  if (!review) {
    return {
      numericChecks: [],
      flags: [],
      note: 'Review service unavailable or returned nothing usable.',
    }
  }

  const numericChecks = (review.numericChecks ?? []).slice(0, 5).map((c) => {
    const label = String(c.label ?? '').trim() || 'Untitled check'
    const expression = String(c.expression ?? '').trim()
    const expectedRaw = String(c.expected ?? '').trim()
    if (!expression || !expectedRaw) {
      return { label, expression, expected: expectedRaw, computed: null, ok: null }
    }
    try {
      const computed = math.evaluate(toAsciiMath(expression)) as number
      if (typeof computed !== 'number' || !isFinite(computed)) {
        return { label, expression, expected: expectedRaw, computed: null, ok: null }
      }
      let expected: number
      try {
        expected = math.evaluate(toAsciiMath(expectedRaw)) as number
      } catch {
        expected = Number(expectedRaw)
      }
      if (typeof expected !== 'number' || !isFinite(expected)) {
        return { label, expression, expected: expectedRaw, computed, ok: null }
      }
      return { label, expression, expected: expectedRaw, computed, ok: closeEnough(computed, expected) }
    } catch {
      return { label, expression, expected: expectedRaw, computed: null, ok: null }
    }
  })

  const flags: ProtocolFlag[] = (review.flags ?? [])
    .filter((f) => f.step && f.reason)
    .map((f) => ({
      step: String(f.step),
      reason: String(f.reason),
      severity: f.severity === 'high' || f.severity === 'medium' ? f.severity : 'low',
    }))

  // Ground chemistry claims against PubChem when the review named specific
  // compounds. A miss (not found, PubChem unreachable) is silently dropped —
  // this is confidence on top of the LLM review, not a new hard requirement.
  const compoundNames = (review.compounds ?? []).map((c) => String(c).trim()).filter(Boolean)
  const groundedFacts = domain === 'chemistry' && compoundNames.length > 0 ? await lookupCompounds(compoundNames) : []

  return { numericChecks, flags, ...(groundedFacts.length > 0 ? { groundedFacts } : {}) }
}
