export interface PubMedArticle {
  id: string
  title: string
  abstract: string
  authors: string[]
  journal: string
  pubDate: string
  pmid: string
}

export async function searchPubMed(query: string, limit: number = 20): Promise<PubMedArticle[]> {
  try {
    const searchUrl = `https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esearch.fcgi?db=pubmed&term=${encodeURIComponent(query)}&retmax=${limit}&retmode=json&sort=relevance`
    
    const searchResponse = await fetch(searchUrl)
    const searchData = await searchResponse.json()
    
    const ids = searchData.esearchresult?.idlist || []
    if (ids.length === 0) return []
    
    const fetchUrl = `https://eutils.ncbi.nlm.nih.gov/entrez/eutils/efetch.fcgi?db=pubmed&id=${ids.join(',')}&retmode=xml`
    const fetchResponse = await fetch(fetchUrl)
    const xmlText = await fetchResponse.text()
    
    return parsePubMedXML(xmlText)
  } catch (error) {
    console.error('PubMed search error:', error)
    return []
  }
}

function parsePubMedXML(xml: string): PubMedArticle[] {
  const articles: PubMedArticle[] = []
  
  const articleMatches = xml.matchAll(/<PubmedArticle>(.*?)<\/PubmedArticle>/gs)
  
  for (const match of articleMatches) {
    const articleXml = match[1]
    
    const pmidMatch = articleXml.match(/<PMID.*?>(.*?)<\/PMID>/)
    const titleMatch = articleXml.match(/<ArticleTitle>(.*?)<\/ArticleTitle>/)
    const abstractMatch = articleXml.match(/<AbstractText.*?>(.*?)<\/AbstractText>/)
    const journalMatch = articleXml.match(/<Title>(.*?)<\/Title>/)
    const yearMatch = articleXml.match(/<PubDate>.*?<Year>(.*?)<\/Year>/)
    
    const authorMatches = [...articleXml.matchAll(/<LastName>(.*?)<\/LastName>/g)]
    const authors = authorMatches.map(m => m[1]).slice(0, 5)
    
    if (pmidMatch && titleMatch) {
      articles.push({
        id: pmidMatch[1],
        pmid: pmidMatch[1],
        title: titleMatch[1].replace(/<[^>]*>/g, ''),
        abstract: abstractMatch ? abstractMatch[1].replace(/<[^>]*>/g, '').slice(0, 500) : '',
        authors,
        journal: journalMatch ? journalMatch[1] : '',
        pubDate: yearMatch ? yearMatch[1] : '',
      })
    }
  }
  
  return articles
}
