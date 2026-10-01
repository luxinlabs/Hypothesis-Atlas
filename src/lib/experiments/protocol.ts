// SPDX-License-Identifier: AGPL-3.0-only
import { create, all } from 'mathjs'
import { groq } from '@/lib/groq'
import { toAsciiMath, closeEnough } from './numeric'
import { lookupCompounds, lookupDrugLikenessMany } from './pubchem'
import { checkEquationBalance, type EquationSide } from './chemistry'
import type { ExperimentDomain, ProtocolFlag, ProtocolResult } from './types'

const math = create(all)

const MIN_BIOLOGICAL_REPLICATES = 3

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
interface RawEquationSide {
  formula?: string
  coefficient?: number
}
interface RawReview {
  numericChecks?: RawNumericCheck[]
  flags?: RawFlag[]
  compounds?: string[]
  equation?: { reactants?: RawEquationSide[]; products?: RawEquationSide[] }
  replicateCount?: number
}

const DOMAIN_FOCUS: Record<Extract<ExperimentDomain, 'chemistry' | 'biology' | 'drug_discovery'>, string> = {
  chemistry: 'reagent quantities, molarity/concentration conversions, and stoichiometry',
  biology: 'sample sizes, replicate counts, dilution ratios, and incubation/measurement math',
  drug_discovery:
    'dose math (e.g. mg/kg conversions), exposure calculations, concentration series, and named compounds’ drug-likeness',
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
  // Chemistry and drug_discovery both get a third extraction task: named
  // compounds. For chemistry these ground molecular-weight arithmetic
  // (lookupCompounds); for drug_discovery they drive a genuinely different,
  // domain-specific check — Lipinski's Rule of Five (lookupDrugLikenessMany)
  // — rather than reusing chemistry's molecular-weight grounding, since
  // "is this compound likely orally bioavailable" is not a chemistry
  // question, it's a drug-discovery one.
  const compoundTask =
    domain === 'chemistry' || domain === 'drug_discovery'
      ? ' (3) Extract up to 3 named compound/drug names mentioned by name (e.g. "NaCl", "ibuprofen") into "compounds".'
      : ''
  const compoundSchema = domain === 'chemistry' || domain === 'drug_discovery' ? ',"compounds":["..."]' : ''
  // Chemistry additionally gets a reaction-equation extraction task, so a
  // deterministic atom-balance check (checkEquationBalance in chemistry.ts)
  // can run on it — a real chemistry concept, not arithmetic.
  const equationTask =
    domain === 'chemistry'
      ? ' (4) If the claim states a chemical reaction/equation, extract its reactants and products as ' +
        '{"formula":"H2","coefficient":2} pairs (omit "equation" entirely if no reaction is present).'
      : ''
  const equationSchema =
    domain === 'chemistry'
      ? ',"equation":{"reactants":[{"formula":"...","coefficient":1}],"products":[{"formula":"...","coefficient":1}]}'
      : ''
  // Biology additionally gets a replicate-count extraction task, so a
  // deterministic minimum-replicate check can run on it — the number is
  // only extracted here; the threshold comparison happens in code below,
  // not left to the LLM's judgment.
  const replicateTask =
    domain === 'biology'
      ? ' (4) If the claim states a sample size or number of biological replicates, extract it as "replicateCount" (omit if not stated).'
      : ''
  const replicateSchema = domain === 'biology' ? ',"replicateCount":3' : ''
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
          `far outside typical ranges, or an internally inconsistent quantity. Do not flag stylistic issues.${compoundTask}${equationTask}${replicateTask} ` +
          'Respond with ONLY JSON: {"numericChecks":[{"label":"...","expression":"...","expected":"..."}],' +
          `"flags":[{"step":"...","reason":"...","severity":"low"|"medium"|"high"}]${compoundSchema}${equationSchema}${replicateSchema}}. ` +
          `Empty arrays/omitted fields are fine if nothing applies.${contextBlock}`,
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

  // Deterministic, code-computed check (not LLM judgment): a stated sample
  // size below the conventional minimum of 3 biological replicates is a
  // real, widely-cited experimental-design threshold — the same shape of
  // rule as drug_discovery's Lipinski Rule of Five, just for biology.
  if (domain === 'biology' && typeof review.replicateCount === 'number' && review.replicateCount < MIN_BIOLOGICAL_REPLICATES) {
    flags.push({
      step: 'Sample size / replicate count',
      reason: `Only ${review.replicateCount} replicate(s) stated — below the conventional minimum of ${MIN_BIOLOGICAL_REPLICATES} biological replicates for statistical inference.`,
      severity: 'medium',
    })
  }

  // Ground chemistry claims against PubChem when the review named specific
  // compounds. A miss (not found, PubChem unreachable) is silently dropped —
  // this is confidence on top of the LLM review, not a new hard requirement.
  const compoundNames = (review.compounds ?? []).map((c) => String(c).trim()).filter(Boolean)
  const groundedFacts = domain === 'chemistry' && compoundNames.length > 0 ? await lookupCompounds(compoundNames) : []

  // drug_discovery: Lipinski's Rule of Five — a genuine pharmacology check
  // (real PubChem descriptors, a real oral-bioavailability heuristic), not
  // the generic dose arithmetic every other check in this file does. See
  // lookupDrugLikenessMany's doc comment for the rule itself.
  const drugLikeness =
    domain === 'drug_discovery' && compoundNames.length > 0 ? await lookupDrugLikenessMany(compoundNames) : []

  // chemistry: stoichiometric balance — a deterministic, well-defined
  // chemistry concept (atom conservation), not arithmetic. Only runs when
  // the review actually extracted a reaction; checkEquationBalance returns
  // null (not false) if a formula couldn't be parsed, so an unparseable
  // equation is silently skipped rather than reported as unbalanced.
  const toEquationSides = (sides: RawEquationSide[] | undefined): EquationSide[] =>
    (sides ?? [])
      .filter((s): s is Required<RawEquationSide> => typeof s.formula === 'string' && typeof s.coefficient === 'number')
      .map((s) => ({ formula: s.formula, coefficient: s.coefficient }))
  const equationBalance =
    domain === 'chemistry' && review.equation
      ? checkEquationBalance(toEquationSides(review.equation.reactants), toEquationSides(review.equation.products))
      : null

  return {
    numericChecks,
    flags,
    ...(groundedFacts.length > 0 ? { groundedFacts } : {}),
    ...(drugLikeness.length > 0 ? { drugLikeness } : {}),
    ...(equationBalance ? { equationBalance } : {}),
  }
}
