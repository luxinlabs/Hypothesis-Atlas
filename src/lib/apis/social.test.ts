import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { searchSocialSignals } from './social'

describe('searchSocialSignals', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('returns matching mock signals for a known topic', async () => {
    const promise = searchSocialSignals('gliosis around implants')
    await vi.advanceTimersByTimeAsync(500)
    const results = await promise
    expect(results).toHaveLength(1)
    expect(results[0].id).toBe('gh-2')
  })

  it('respects the limit parameter', async () => {
    const promise = searchSocialSignals('neural implant stability', 1)
    await vi.advanceTimersByTimeAsync(500)
    const results = await promise
    expect(results).toHaveLength(1)
  })

  it('falls back to a generic signal for unknown topics', async () => {
    const promise = searchSocialSignals('quantum gravity')
    await vi.advanceTimersByTimeAsync(500)
    const results = await promise
    expect(results).toHaveLength(1)
    expect(results[0].title).toContain('quantum-gravity')
  })

  it('is case-insensitive when matching topics', async () => {
    const promise = searchSocialSignals('CRISPR gene editing')
    await vi.advanceTimersByTimeAsync(500)
    const results = await promise
    expect(results[0].id).toBe('gh-3')
  })
})
