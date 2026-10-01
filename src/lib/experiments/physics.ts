// SPDX-License-Identifier: AGPL-3.0-only
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
async function extractPhysicsClaim(claim: string, sessionContext?: string): Promise<RawPhysicsClaim | null> {
  if (!groq) return null
  const contextBlock = sessionContext
    ? `\n\nEarlier claims already investigated in this conversation (background only, not verified facts to assume):\n${sessionContext}`
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

/**
 * Extracts a plain number from a mathjs value, normalizing any Unit to SI
 * base units first. This matters more than it looks: `.toNumber()` with no
 * argument returns the value expressed in whatever compound unit list the
 * value happens to carry internally (e.g. a `sqrt()` of a chain of
 * multiplied/divided unit literals can end up with a unit list like
 * `sqrt(km)`-flavored fractional units) — that is NOT the same as "the
 * value in a standard unit," and silently returning it produces numbers off
 * by an arbitrary, non-obvious factor. `.toSI()` first forces a genuine
 * base-SI representation (kg, m, s, ...) so `.toNumber()` afterward is
 * unambiguous. Confirmed empirically: an orbital-velocity claim (sqrt of
 * G*M/r) was wrongly flagged as a numeric mismatch before this fix, because
 * the un-normalized `.toNumber()` returned a value off by a factor of ~31.6.
 */
function toPlainNumber(value: unknown): number | null {
  if (typeof value === 'number') return isFinite(value) ? value : null
  if (value && typeof (value as { toSI?: unknown }).toSI === 'function') {
    try {
      const si = (value as { toSI: () => { toNumber: () => number } }).toSI()
      const n = si.toNumber()
      return typeof n === 'number' && isFinite(n) ? n : null
    } catch {
      return null
    }
  }
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

const SPEED_OF_LIGHT_M_PER_S = 299_792_458

/**
 * Checks a computed quantity against a small set of real physical
 * constraints — this is what makes physics verification more than relabeled
 * arithmetic: a numerically "correct" equation can still describe something
 * physically impossible (a faster-than-light velocity, a temperature below
 * absolute zero, negative mass), and dimensional analysis alone doesn't
 * catch that. Only checks quantities whose unit is recognizably a velocity,
 * absolute temperature, or mass — anything else is left alone rather than
 * guessed at.
 */
function checkPhysicalPlausibility(value: unknown): string[] {
  if (!value || typeof (value as { equalBase?: unknown }).equalBase !== 'function') return []
  const unit = value as { equalBase: (u: unknown) => boolean; toSI: () => { toNumber: () => number } }
  const flags: string[] = []
  try {
    if (unit.equalBase(math.unit('1 m/s'))) {
      const si = Math.abs(unit.toSI().toNumber())
      if (si > SPEED_OF_LIGHT_M_PER_S) {
        flags.push(`Computed velocity (${si.toExponential(3)} m/s) exceeds the speed of light — physically impossible.`)
      }
    } else if (unit.equalBase(math.unit('1 K'))) {
      const si = unit.toSI().toNumber()
      if (si < 0) {
        flags.push(`Computed temperature (${si} K) is below absolute zero — physically impossible.`)
      }
    } else if (unit.equalBase(math.unit('1 kg'))) {
      const si = unit.toSI().toNumber()
      if (si < 0) {
        flags.push(`Computed mass (${si} kg) is negative — physically impossible.`)
      }
    }
  } catch {
    // Not a unit-bearing value, or units.equalBase threw on an unusual
    // combination — nothing to flag either way.
  }
  return flags
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
export async function verifyPhysicsClaim(claim: string, sessionContext?: string): Promise<PhysicsResult> {
  const extracted = await extractPhysicsClaim(claim, sessionContext)
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
  const plausibilityFlags = checkPhysicalPlausibility(computedValue)

  if (!expected) {
    return {
      expression,
      expected: '',
      computed,
      unitsOk: true,
      numericOk: null,
      ...(plausibilityFlags.length > 0 ? { plausibilityFlags } : {}),
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
  // Unlike the math-domain checker's closeEnough() (unitless, human-scale
  // numbers, where flooring the scale at 1 avoids blowing up near zero),
  // physical SI quantities routinely have magnitude far below 1 — a charge
  // in coulombs, a force in newtons, G itself (~6.674e-11). Flooring at 1
  // there made the tolerance absurdly loose (an expected value of 6.674e-11
  // would accept anything within 1e-6 of it — nine orders of magnitude too
  // permissive). Only fall back to 1 when the expected value is exactly
  // zero, to keep the tolerance from collapsing to zero itself.
  const scale = scaleNumber === 0 ? 1 : Math.abs(scaleNumber)
  const numericOk = Math.abs(diffNumber) <= 1e-6 * scale

  return {
    expression,
    expected,
    computed,
    unitsOk: true,
    numericOk,
    ...(plausibilityFlags.length > 0 ? { plausibilityFlags } : {}),
    note: numericOk
      ? 'Units are dimensionally consistent and the numeric value matches.'
      : 'Units are dimensionally consistent, but the numeric value does not match.',
  }
}
