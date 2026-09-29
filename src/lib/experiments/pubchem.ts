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
