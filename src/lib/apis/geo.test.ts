import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest'
import { searchGEO } from './geo'

describe('searchGEO', () => {
  const originalFetch = global.fetch

  beforeEach(() => {
    vi.spyOn(console, 'warn').mockImplementation(() => {})
    vi.spyOn(console, 'error').mockImplementation(() => {})
  })

  afterEach(() => {
    global.fetch = originalFetch
    vi.restoreAllMocks()
  })

  it('returns an empty array when the search request is not ok', async () => {
    global.fetch = vi.fn().mockResolvedValue({ ok: false, status: 500 }) as unknown as typeof fetch
    await expect(searchGEO('cancer')).resolves.toEqual([])
  })

  it('returns an empty array when no ids are found', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ esearchresult: { idlist: [] } }),
    }) as unknown as typeof fetch
    await expect(searchGEO('cancer')).resolves.toEqual([])
  })

  it('maps summary results into GEODataset objects', async () => {
    global.fetch = vi
      .fn()
      .mockResolvedValueOnce({ ok: true, json: async () => ({ esearchresult: { idlist: ['200123'] } }) })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          result: {
            '200123': {
              accession: 'GSE200123',
              title: 'A dataset',
              summary: 'A'.repeat(400),
              taxon: 'Homo sapiens',
              entrytype: 'GSE',
              pubmedids: ['12345'],
              pdat: '2024/01/01',
            },
          },
        }),
      }) as unknown as typeof fetch

    const results = await searchGEO('cancer')
    expect(results).toHaveLength(1)
    expect(results[0]).toMatchObject({
      accession: 'GSE200123',
      title: 'A dataset',
      organism: 'Homo sapiens',
      type: 'GSE',
      pubmedId: '12345',
      submissionDate: '2024/01/01',
    })
    expect(results[0].summary).toHaveLength(300)
  })

  it('skips ids missing from the summary result', async () => {
    global.fetch = vi
      .fn()
      .mockResolvedValueOnce({ ok: true, json: async () => ({ esearchresult: { idlist: ['1', '2'] } }) })
      .mockResolvedValueOnce({ ok: true, json: async () => ({ result: { '1': { accession: 'GSE1' } } }) }) as unknown as typeof fetch

    const results = await searchGEO('cancer')
    expect(results).toHaveLength(1)
    expect(results[0].accession).toBe('GSE1')
  })

  it('returns an empty array on malformed summary response', async () => {
    global.fetch = vi
      .fn()
      .mockResolvedValueOnce({ ok: true, json: async () => ({ esearchresult: { idlist: ['1'] } }) })
      .mockResolvedValueOnce({ ok: true, json: async () => ({}) }) as unknown as typeof fetch

    await expect(searchGEO('cancer')).resolves.toEqual([])
  })

  it('returns an empty array when fetch throws', async () => {
    global.fetch = vi.fn().mockRejectedValue(new Error('boom')) as unknown as typeof fetch
    await expect(searchGEO('cancer')).resolves.toEqual([])
  })
})
