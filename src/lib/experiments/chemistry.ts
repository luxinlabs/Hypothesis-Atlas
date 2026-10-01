// SPDX-License-Identifier: AGPL-3.0-only

/**
 * Stoichiometric balance checking — verifying a chemical equation conserves
 * atoms on both sides. This is a deterministic, well-defined chemistry
 * concept with no equivalent in the generic arithmetic checker every other
 * numeric claim in this module goes through (see numeric.ts): "is this
 * equation balanced" is not a question of evaluating an expression, it's a
 * question of counting atoms per element and comparing two multisets.
 */

export interface EquationSide {
  formula: string
  coefficient: number
}

export interface EquationBalanceResult {
  balanced: boolean
  leftCounts: Record<string, number>
  rightCounts: Record<string, number>
  mismatches: string[]
}

/**
 * Parses a simple molecular formula (e.g. "H2O", "C6H12O6", "NaCl") into
 * per-element atom counts. Deliberately limited to flat formulas — no
 * parenthesized groups like "Ca(OH)2" or hydrates like "CuSO4·5H2O" — those
 * are a reasonable future extension, not needed for the common claims this
 * module sees (see V3 issue tracking "genuine domain-specific checks").
 * Returns null if the string isn't a clean sequence of element+count pairs.
 */
export function parseFormula(formula: string): Record<string, number> | null {
  const trimmed = formula.trim()
  if (!trimmed) return null
  const regex = /([A-Z][a-z]?)(\d*)/g
  const counts: Record<string, number> = {}
  let match: RegExpExecArray | null
  let consumed = 0
  while ((match = regex.exec(trimmed)) !== null) {
    if (match.index !== consumed) return null // garbage between recognized element symbols
    const [full, element, countStr] = match
    const count = countStr ? parseInt(countStr, 10) : 1
    counts[element] = (counts[element] ?? 0) + count
    consumed += full.length
  }
  if (consumed !== trimmed.length || Object.keys(counts).length === 0) return null
  return counts
}

function aggregateCounts(sides: EquationSide[]): Record<string, number> | null {
  const totals: Record<string, number> = {}
  for (const side of sides) {
    const counts = parseFormula(side.formula)
    if (!counts) return null
    for (const [element, n] of Object.entries(counts)) {
      totals[element] = (totals[element] ?? 0) + n * side.coefficient
    }
  }
  return totals
}

/**
 * Checks whether a reaction's reactants and products conserve every
 * element's atom count. Returns null (not uncheckable-but-false) if any
 * formula couldn't be parsed, so the caller can distinguish "we checked and
 * it's unbalanced" from "we couldn't check this."
 */
export function checkEquationBalance(
  reactants: EquationSide[],
  products: EquationSide[]
): EquationBalanceResult | null {
  const left = aggregateCounts(reactants)
  const right = aggregateCounts(products)
  if (!left || !right) return null

  const elements = new Set([...Object.keys(left), ...Object.keys(right)])
  const mismatches: string[] = []
  for (const element of elements) {
    const l = left[element] ?? 0
    const r = right[element] ?? 0
    if (l !== r) mismatches.push(`${element}: ${l} on the left, ${r} on the right`)
  }

  return { balanced: mismatches.length === 0, leftCounts: left, rightCounts: right, mismatches }
}
