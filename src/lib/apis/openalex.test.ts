import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { searchOpenAlex, reconstructAbstract } from './openalex'

describe('reconstructAbstract', () => {
  it('returns an empty string when no index is given', () => {
    expect(reconstructAbstract(undefined)).toBe('')
  })

  it('reorders words by their positions', () => {
    const index = { world: [1], hello: [0] }
    expect(reconstructAbstract(index)).toBe('hello world')
  })

  it('handles repeated positions for the same word', () => {
    const index = { a: [0, 2], b: [1] }
    expect(reconstructAbstract(index)).toBe('a b a')
  })

  it('truncates to 500 characters', () => {
    const index = { word: Array.from({ length: 200 }, (_, i) => i) }
    expect(reconstructAbstract(index).length).toBeLessThanOrEqual(500)
  })
})

describe('searchOpenAlex', () => {
  const originalFetch = global.fetch

  beforeEach(() => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
  })

  afterEach(() => {
    global.fetch = originalFetch
    vi.restoreAllMocks()
  })

  it('returns the results array from a successful response', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ results: [{ id: 'w1', title: 'Paper' }] }),
    }) as unknown as typeof fetch

    const results = await searchOpenAlex('crispr', 10)
    expect(results).toEqual([{ id: 'w1', title: 'Paper' }])
    expect(global.fetch).toHaveBeenCalledWith(
      expect.stringContaining('https://api.openalex.org/works?search=crispr'),
      expect.objectContaining({ headers: expect.any(Object) })
    )
  })

  it('returns an empty array when the response is not ok', async () => {
    global.fetch = vi.fn().mockResolvedValue({ ok: false, status: 500 }) as unknown as typeof fetch
    await expect(searchOpenAlex('crispr')).resolves.toEqual([])
  })

  it('returns an empty array when fetch throws', async () => {
    global.fetch = vi.fn().mockRejectedValue(new Error('network error')) as unknown as typeof fetch
    await expect(searchOpenAlex('crispr')).resolves.toEqual([])
  })

  it('defaults to an empty array when results is missing', async () => {
    global.fetch = vi.fn().mockResolvedValue({ ok: true, json: async () => ({}) }) as unknown as typeof fetch
    await expect(searchOpenAlex('crispr')).resolves.toEqual([])
  })
})
