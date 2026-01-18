export interface OpenAlexWork {
  id: string
  title: string
  publication_date: string
  authorships: Array<{
    author: {
      display_name: string
    }
  }>
  primary_location?: {
    source?: {
      display_name: string
    }
  }
  abstract_inverted_index?: Record<string, number[]>
  doi?: string
}

export async function searchOpenAlex(query: string, limit: number = 30): Promise<OpenAlexWork[]> {
  try {
    const url = `https://api.openalex.org/works?search=${encodeURIComponent(query)}&per-page=${limit}&sort=publication_date:desc&filter=publication_year:2018-2024`
    
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'HypothesisAtlas/1.0 (mailto:research@example.com)',
      },
    })

    if (!response.ok) {
      throw new Error(`OpenAlex API error: ${response.status}`)
    }

    const data = await response.json()
    return data.results || []
  } catch (error) {
    console.error('OpenAlex search error:', error)
    return []
  }
}

export function reconstructAbstract(invertedIndex?: Record<string, number[]>): string {
  if (!invertedIndex) return ''
  
  const words: Array<[string, number]> = []
  for (const [word, positions] of Object.entries(invertedIndex)) {
    for (const pos of positions) {
      words.push([word, pos])
    }
  }
  
  words.sort((a, b) => a[1] - b[1])
  return words.map(w => w[0]).join(' ').slice(0, 500)
}
