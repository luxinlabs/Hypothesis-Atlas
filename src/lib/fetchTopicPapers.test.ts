import { describe, it, expect, vi, beforeEach } from 'vitest'

const { searchOpenAlexMock, searchPubMedMock } = vi.hoisted(() => ({
  searchOpenAlexMock: vi.fn(),
  searchPubMedMock: vi.fn(),
}))

vi.mock('@/lib/apis/openalex', () => ({
  searchOpenAlex: searchOpenAlexMock,
  reconstructAbstract: (index?: Record<string, number[]>) => (index ? Object.keys(index).join(' ') : ''),
}))
vi.mock('@/lib/apis/pubmed', () => ({ searchPubMed: searchPubMedMock }))

import { fetchTopicPapers } from './fetchTopicPapers'

const currentYear = new Date().getFullYear()

beforeEach(() => {
  vi.clearAllMocks()
})

describe('fetchTopicPapers', () => {
  it('merges and ranks results from OpenAlex and PubMed', async () => {
    searchOpenAlexMock.mockResolvedValue([
      {
        id: 'oa-1',
        title: 'Autonomous Vehicles and Safety',
        authorships: [{ author: { display_name: 'A. Researcher' } }],
        primary_location: { source: { display_name: 'Journal of Driving' } },
        publication_date: `${currentYear}-01-01`,
        abstract_inverted_index: { safety: [0] },
        doi: 'https://doi.org/10.1/xyz',
      },
    ])
    searchPubMedMock.mockResolvedValue([
      {
        id: 'pm-1',
        pmid: 'pm-1',
        title: 'Old Unrelated Study',
        abstract: '',
        authors: ['B. Author'],
        journal: 'Journal of Something',
        pubDate: String(currentYear - 5),
        pubType: 'Journal Article',
      },
    ])

    const papers = await fetchTopicPapers('autonomous vehicles', 10)
    expect(papers).toHaveLength(2)
    expect(papers[0].id).toBe('oa-1')
    expect(papers[0].url).toBe('https://doi.org/10.1/xyz')
    expect(papers[0].source).toBe('openalex')
  })

  it('dedupes results sharing a title prefix', async () => {
    searchOpenAlexMock.mockResolvedValue([
      { id: 'oa-1', title: 'Duplicate Title Of A Paper Here', authorships: [], publication_date: `${currentYear}-01-01` },
    ])
    searchPubMedMock.mockResolvedValue([
      { id: 'pm-1', pmid: 'pm-1', title: 'Duplicate Title Of A Paper Here', abstract: '', authors: [], journal: '', pubDate: String(currentYear) },
    ])

    const papers = await fetchTopicPapers('duplicate', 10)
    expect(papers).toHaveLength(1)
    expect(papers[0].source).toBe('openalex')
  })

  it('skips entries without a title', async () => {
    searchOpenAlexMock.mockResolvedValue([{ id: 'oa-1', title: '', authorships: [], publication_date: '' }])
    searchPubMedMock.mockResolvedValue([])
    await expect(fetchTopicPapers('x', 10)).resolves.toEqual([])
  })

  it('respects the limit after ranking', async () => {
    searchOpenAlexMock.mockResolvedValue(
      Array.from({ length: 5 }, (_, i) => ({
        id: `oa-${i}`,
        title: `Paper Number ${i} About Autonomous Vehicles`,
        authorships: [],
        publication_date: `${currentYear}-01-01`,
      }))
    )
    searchPubMedMock.mockResolvedValue([])

    const papers = await fetchTopicPapers('autonomous vehicles', 2)
    expect(papers).toHaveLength(2)
  })

  it('degrades gracefully when one source rejects', async () => {
    searchOpenAlexMock.mockRejectedValue(new Error('down'))
    searchPubMedMock.mockResolvedValue([
      { id: 'pm-1', pmid: 'pm-1', title: 'Still Works', abstract: '', authors: [], journal: '', pubDate: String(currentYear) },
    ])

    const papers = await fetchTopicPapers('topic', 10)
    expect(papers).toHaveLength(1)
    expect(papers[0].source).toBe('pubmed')
  })
})
