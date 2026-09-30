// Shared plain-arithmetic helpers used by every domain's fast numeric-claim
// path (currently: the original math-domain claim verifier and the
// chemistry/biology/drug_discovery protocol dose-math checker). Physics uses
// mathjs's unit-aware evaluator directly instead (see physics.ts) since
// dimensional analysis needs the units, not just the numbers.

/** mathjs accepts ^ for power; strip LaTeX-isms that slip through. */
export function toAsciiMath(expr: string): string {
  return expr
    .replace(/\\times|\\cdot|\\ast/g, '*')
    .replace(/\\div/g, '/')
    .replace(/\\frac\{([^}]*)\}\{([^}]*)\}/g, '($1)/($2)')
    .replace(/\\sqrt\{([^}]*)\}/g, 'sqrt($1)')
    .replace(/\\sqrt(\d)/g, 'sqrt($1)')
    .replace(/\\left|\\right|\\,/g, '')
    .replace(/\^\{([^}]*)\}/g, '^($1)')
    .trim()
}

export function closeEnough(a: number, b: number): boolean {
  const scale = Math.max(1, Math.abs(a), Math.abs(b))
  return Math.abs(a - b) <= 1e-6 * scale
}
