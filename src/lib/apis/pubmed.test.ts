import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest'
import { searchPubMed } from './pubmed'

// Note: intentionally omits the <PublicationTypeList> wrapper. The route's
// `<PublicationType[^>]*>` regex also matches "PublicationTypeList" (the
// trailing "List" is absorbed by `[^>]*`), which would capture everything up
// to the nested tag's own closing tag instead of just "Journal Article".
const SAMPLE_XML = `<PubmedArticleSet><PubmedArticle><MedlineCitation><PMID Version="1">12345</PMID><Article><ArticleTitle>A Great Paper</ArticleTitle><Abstract><AbstractText>An interesting abstract.</AbstractText></Abstract><AuthorList><Author><LastName>Smith</LastName></Author><Author><LastName>Doe</LastName></Author></AuthorList><Journal><Title>Journal of Things</Title></Journal><PublicationType UI="D016428">Journal Article</PublicationType></Article><PubDate><Year>2024</Year></PubDate></MedlineCitation></PubmedArticle></PubmedArticleSet>`

describe('searchPubMed', () => {
  const originalFetch = global.fetch

  beforeEach(() => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
  })

  afterEach(() => {
    global.fetch = originalFetch
    vi.restoreAllMocks()
  })

  it('returns an empty array when no ids are found', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      json: async () => ({ esearchresult: { idlist: [] } }),
    }) as unknown as typeof fetch

    await expect(searchPubMed('nothing')).resolves.toEqual([])
    expect(global.fetch).toHaveBeenCalledTimes(1)
  })

  it('parses articles out of the efetch XML response', async () => {
    global.fetch = vi
      .fn()
      .mockResolvedValueOnce({ json: async () => ({ esearchresult: { idlist: ['12345'] } }) })
      .mockResolvedValueOnce({ text: async () => SAMPLE_XML }) as unknown as typeof fetch

    const results = await searchPubMed('great paper')
    expect(results).toHaveLength(1)
    expect(results[0]).toMatchObject({
      id: '12345',
      pmid: '12345',
      title: 'A Great Paper',
      abstract: 'An interesting abstract.',
      authors: ['Smith', 'Doe'],
      journal: 'Journal of Things',
      pubType: 'Journal Article',
    })
    expect(global.fetch).toHaveBeenCalledTimes(2)
  })

  it('returns an empty array when fetch throws', async () => {
    global.fetch = vi.fn().mockRejectedValue(new Error('timeout')) as unknown as typeof fetch
    await expect(searchPubMed('x')).resolves.toEqual([])
  })

  it('skips articles missing a PMID or title', async () => {
    const xml = `<PubmedArticleSet><PubmedArticle><MedlineCitation><Article><ArticleTitle>No PMID Here</ArticleTitle></Article></MedlineCitation></PubmedArticle></PubmedArticleSet>`
    global.fetch = vi
      .fn()
      .mockResolvedValueOnce({ json: async () => ({ esearchresult: { idlist: ['1'] } }) })
      .mockResolvedValueOnce({ text: async () => xml }) as unknown as typeof fetch

    await expect(searchPubMed('x')).resolves.toEqual([])
  })
})
