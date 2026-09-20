import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('./redis', () => ({ redis: null }))

const processEvidenceMappingMock = vi.fn().mockResolvedValue(undefined)
vi.mock('../worker/processor', () => ({ processEvidenceMapping: processEvidenceMappingMock }))

import { addEvidenceMappingJob } from './queue'

beforeEach(() => {
  vi.clearAllMocks()
  vi.spyOn(console, 'log').mockImplementation(() => {})
  vi.spyOn(console, 'error').mockImplementation(() => {})
})

describe('addEvidenceMappingJob', () => {
  it('schedules fallback processing via setTimeout', async () => {
    vi.useFakeTimers()
    await addEvidenceMappingJob('job-1', 'autonomous vehicles')
    await vi.advanceTimersByTimeAsync(150)
    expect(processEvidenceMappingMock).toHaveBeenCalledWith({ jobId: 'job-1', topicQuery: 'autonomous vehicles' })
    vi.useRealTimers()
  })

  it('logs but does not throw when the fallback processor rejects', async () => {
    vi.useFakeTimers()
    processEvidenceMappingMock.mockRejectedValueOnce(new Error('processing failed'))
    await addEvidenceMappingJob('job-2', 'topic')
    await vi.advanceTimersByTimeAsync(150)
    expect(console.error).toHaveBeenCalled()
    vi.useRealTimers()
  })
})
