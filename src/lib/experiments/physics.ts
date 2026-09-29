import { create, all } from 'mathjs'
import { groq } from '@/lib/groq'
import type { PhysicsResult } from './types'

const math = create(all)

interface RawPhysicsClaim {
  expression?: string
  expected?: string
}

/**
 * Extracts one checkable, unit-bearing expression from a physics claim.
 * Unlike the math-domain autoformalizer (LLM -> Lean, then a real checker
 * verifies), there is no proof assistant for physics derivations — the LLM's
 * job here is much narrower: pull out an equation mathjs can evaluate with
 * units attached (e.g. "9.8 m/s^2 * 2 s"), not judge correctness itself.
 */
async function extractPhysicsClaim(claim: string, linkedContext?: string): Promise<RawPhysicsClaim | null> {
  if (!groq) return null
  const contextBlock = linkedContext
    ? `\n\nRelated sessions already investigated in this notebook (background only, not verified facts to assume):\n${linkedContext}`
    : ''
  const completion = await groq.chat.completions.create({
    model: 'openai/gpt-oss-120b',
    temperature: 0,
    max_tokens: 400,
    messages: [
      {
        role: 'system',
        content:
          'Extract ONE checkable physics expression from the claim below, using mathjs unit syntax ' +
          '(e.g. "9.8 m/s^2 * 2 s", "0.5 * 2 kg * (3 m/s)^2", "6.674e-11 m^3/(kg s^2)"). If the claim ' +
          'states an expected result with units, put it in "expected" (e.g. "19.6 m/s"). Respond with ' +
          'ONLY JSON: {"expression":"...","expected":"..."}. If nothing checkable is present, respond ' +
          `{"expression":"","expected":""}.${contextBlock}`,
      },
      { role: 'user', content: claim },
    ],
  })
  const raw = completion.choices[0]?.message?.content ?? ''
  const match = raw.match(/\{[\s\S]*\}/)
  if (!match) return null
  try {
    return JSON.parse(match[0]) as RawPhysicsClaim
  } catch {
    return null
  }
}

function toPlainNumber(value: unknown): number | null {
  if (typeof value === 'number') return isFinite(value) ? value : null
  if (value && typeof (value as { toNumber?: unknown }).toNumber === 'function') {
    try {
      const n = (value as { toNumber: () => number }).toNumber()
      return typeof n === 'number' && isFinite(n) ? n : null
    } catch {
      return null
    }
  }
  return null
}

function errorMessage(err: unknown): string {
  return err instanceof Error ? err.message : 'Unit/expression error'
}

/**
 * Verifies a physics claim via dimensional analysis + a numeric check —
 * distinct failure modes from math's Lean path (no proof assistant here) and
 * from math's plain-mathjs numeric path (units matter: adding a length to a
 * velocity must fail even if the raw numbers happen to line up).
 *
 * mathjs's own unit system does the dimensional-analysis work: evaluating
 * `(expression) - (expected)` throws if the two sides have incompatible
 * units, and otherwise returns their difference converted to a common unit —
 * exactly what "is this dimensionally consistent" means.
 */
export async function verifyPhysicsClaim(claim: string, linkedContext?: string): Promise<PhysicsResult> {
  const extracted = await extractPhysicsClaim(claim, linkedContext)
  if (!extracted?.expression) {
    return {
      expression: '',
      expected: '',
      computed: null,
      unitsOk: null,
      numericOk: null,
      note:
        'No machine-checkable expression found in this claim. State it as a unit-bearing equation, ' +
        'e.g. "9.8 m/s^2 * 2 s = 19.6 m/s".',
    }
  }
  const expression = extracted.expression ?? ''
  const expected = extracted.expected ?? ''

  let computedValue: unknown
  try {
    computedValue = math.evaluate(expression)
  } catch (err) {
    return {
      expression,
      expected,
      computed: null,
      unitsOk: false,
      numericOk: null,
      unitError: errorMessage(err),
      note: 'mathjs rejected this expression — check for a unit or syntax error.',
    }
  }
  const computed = toPlainNumber(computedValue)

  if (!expected) {
    return {
      expression,
      expected: '',
      computed,
      unitsOk: true,
      numericOk: null,
      note: 'Expression is dimensionally valid; no expected value was given to compare against.',
    }
  }

  let diffValue: unknown
  try {
    diffValue = math.evaluate(`(${expression}) - (${expected})`)
  } catch (err) {
    return {
      expression,
      expected,
      computed,
      unitsOk: false,
      numericOk: null,
      unitError: errorMessage(err),
      note: 'Computed and expected values have incompatible units — dimensional analysis failed.',
    }
  }

  const diffNumber = toPlainNumber(diffValue)
  const scaleNumber = toPlainNumber(math.evaluate(`abs(${expected})`))
  if (diffNumber === null || scaleNumber === null) {
    return {
      expression,
      expected,
      computed,
      unitsOk: true,
      numericOk: null,
      note: 'Units check out, but the result was not a plain numeric/unit quantity to compare.',
    }
  }
  const scale = Math.max(1, Math.abs(scaleNumber))
  const numericOk = Math.abs(diffNumber) <= 1e-6 * scale

  return {
    expression,
    expected,
    computed,
    unitsOk: true,
    numericOk,
    note: numericOk
      ? 'Units are dimensionally consistent and the numeric value matches.'
      : 'Units are dimensionally consistent, but the numeric value does not match.',
  }
}
