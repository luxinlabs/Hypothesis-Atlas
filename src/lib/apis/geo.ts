export interface GEODataset {
  accession: string
  title: string
  summary: string
  organism: string
  type: string
  pubmedId?: string
  submissionDate: string
}

export async function searchGEO(query: string, limit: number = 15): Promise<GEODataset[]> {
  try {
    const searchUrl = `https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esearch.fcgi?db=gds&term=${encodeURIComponent(query)}&retmax=${limit}&retmode=json`
    
    // Add 10 second timeout to prevent hanging
    const searchResponse = await fetch(searchUrl, { 
      signal: AbortSignal.timeout(10000)
    })
    if (!searchResponse.ok) {
      console.warn(`GEO search failed with status ${searchResponse.status}`)
      return []
    }
    
    const searchData = await searchResponse.json()
    
    const ids = searchData.esearchresult?.idlist || []
    if (ids.length === 0) return []
    
    const summaryUrl = `https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esummary.fcgi?db=gds&id=${ids.join(',')}&retmode=json`
    const summaryResponse = await fetch(summaryUrl, {
      signal: AbortSignal.timeout(10000)
    })
    
    if (!summaryResponse.ok) {
      console.warn(`GEO summary failed with status ${summaryResponse.status}`)
      return []
    }
    
    const summaryData = await summaryResponse.json()
    
    if (!summaryData || !summaryData.result) {
      console.warn('GEO API returned invalid response structure')
      return []
    }
    
    const datasets: GEODataset[] = []
    const result = summaryData.result
    
    for (const id of ids) {
      if (!result[id]) continue
      
      const item = result[id]
      
      if (item && typeof item === 'object' && item.accession) {
        datasets.push({
          accession: item.accession || '',
          title: item.title || '',
          summary: (item.summary || '').slice(0, 300),
          organism: item.taxon || '',
          type: item.entrytype || 'GSE',
          pubmedId: item.pubmedids?.[0] || undefined,
          submissionDate: item.pdat || '',
        })
      }
    }
    
    return datasets
  } catch (error) {
    console.error('GEO search error:', error)
    return []
  }
}
