export interface CompoundLookup {
  compound: string
  molecularWeightGMol: number | null
  source: string
}

const PUBCHEM_TIMEOUT_MS = 5000

/**
 * Looks up a compound's molecular weight via PubChem's free PUG REST API
 * (no key required). Grounds chemistry protocol review against a real
 * reference instead of trusting the LLM's own recollection of a compound's
 * properties — the LLM can be both generating and checking a claim's
 * numbers from the same (possibly wrong) knowledge, which arithmetic
 * checking alone can't catch. Returns null on any failure (not found,
 * timeout, network error) — the caller falls back to LLM-only review rather
 * than blocking, per the V3 follow-up that introduced this.
 */
export async function lookupCompound(name: string): Promise<CompoundLookup | null> {
  const url = `https://pubchem.ncbi.nlm.nih.gov/rest/pug/compound/name/${encodeURIComponent(name)}/property/MolecularWeight/JSON`
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), PUBCHEM_TIMEOUT_MS)
  try {
    const res = await fetch(url, { signal: controller.signal })
    if (!res.ok) return null
    const data = (await res.json()) as {
      PropertyTable?: { Properties?: { MolecularWeight?: string | number }[] }
    }
    const raw = data.PropertyTable?.Properties?.[0]?.MolecularWeight
    const weight = raw !== undefined ? Number(raw) : null
    return {
      compound: name,
      molecularWeightGMol: typeof weight === 'number' && isFinite(weight) ? weight : null,
      source: 'PubChem',
    }
  } catch {
    return null
  } finally {
    clearTimeout(timeout)
  }
}

/** Looks up several compounds concurrently, dropping any that fail or aren't found. */
export async function lookupCompounds(names: string[]): Promise<CompoundLookup[]> {
  const results = await Promise.all(names.slice(0, 3).map((name) => lookupCompound(name)))
  return results.filter((r): r is CompoundLookup => r !== null)
}

export interface DrugLikenessResult {
  compound: string
  molecularWeightGMol: number | null
  xLogP: number | null
  hBondDonorCount: number | null
  hBondAcceptorCount: number | null
  violations: string[]
  passesRuleOfFive: boolean
  source: string
}

/**
 * Evaluates Lipinski's Rule of Five — the standard oral-bioavailability
 * heuristic in drug discovery (Lipinski et al., 1997): a compound is
 * unlikely to be orally bioavailable if it violates more than one of
 * molecular weight ≤ 500, calculated LogP ≤ 5, H-bond donors ≤ 5, H-bond
 * acceptors ≤ 10. This is a genuinely domain-specific check — unlike the
 * generic dose/reagent arithmetic in protocol.ts, it doesn't reduce to
 * "evaluate an expression"; it's a real pharmacology rule, evaluated
 * against real PubChem descriptor data rather than an LLM's recollection.
 */
export async function lookupDrugLikeness(name: string): Promise<DrugLikenessResult | null> {
  const url = `https://pubchem.ncbi.nlm.nih.gov/rest/pug/compound/name/${encodeURIComponent(
    name
  )}/property/MolecularWeight,XLogP,HBondDonorCount,HBondAcceptorCount/JSON`
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), PUBCHEM_TIMEOUT_MS)
  try {
    const res = await fetch(url, { signal: controller.signal })
    if (!res.ok) return null
    const data = (await res.json()) as {
      PropertyTable?: {
        Properties?: {
          MolecularWeight?: string | number
          XLogP?: number
          HBondDonorCount?: number
          HBondAcceptorCount?: number
        }[]
      }
    }
    const props = data.PropertyTable?.Properties?.[0]
    if (!props) return null

    const mw = props.MolecularWeight !== undefined ? Number(props.MolecularWeight) : null
    const logP = typeof props.XLogP === 'number' ? props.XLogP : null
    const hbd = typeof props.HBondDonorCount === 'number' ? props.HBondDonorCount : null
    const hba = typeof props.HBondAcceptorCount === 'number' ? props.HBondAcceptorCount : null

    const violations: string[] = []
    if (mw !== null && mw > 500) violations.push(`molecular weight ${mw.toFixed(1)} > 500`)
    if (logP !== null && logP > 5) violations.push(`LogP ${logP} > 5`)
    if (hbd !== null && hbd > 5) violations.push(`H-bond donors ${hbd} > 5`)
    if (hba !== null && hba > 10) violations.push(`H-bond acceptors ${hba} > 10`)

    return {
      compound: name,
      molecularWeightGMol: mw,
      xLogP: logP,
      hBondDonorCount: hbd,
      hBondAcceptorCount: hba,
      violations,
      // The rule's own threshold: more than one violation predicts poor
      // oral bioavailability, not zero violations — one alone is tolerated.
      passesRuleOfFive: violations.length <= 1,
      source: 'PubChem + Lipinski Rule of Five',
    }
  } catch {
    return null
  } finally {
    clearTimeout(timeout)
  }
}

/** Evaluates drug-likeness for several compounds concurrently, dropping any that fail or aren't found. */
export async function lookupDrugLikenessMany(names: string[]): Promise<DrugLikenessResult[]> {
  const results = await Promise.all(names.slice(0, 3).map((name) => lookupDrugLikeness(name)))
  return results.filter((r): r is DrugLikenessResult => r !== null)
}
