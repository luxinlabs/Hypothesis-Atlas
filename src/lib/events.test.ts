import { describe, it, expect, vi, beforeEach } from 'vitest'

const { prismaMock } = vi.hoisted(() => ({
  prismaMock: {
    progressEvent: {
      create: vi.fn(),
      findMany: vi.fn(),
      deleteMany: vi.fn(),
    },
  },
}))

vi.mock('./prisma', () => ({ prisma: prismaMock }))

import { emitProgressEvent, getProgressEvents, clearProgressEvents } from './events'

beforeEach(() => {
  vi.clearAllMocks()
  vi.spyOn(console, 'log').mockImplementation(() => {})
  vi.spyOn(console, 'error').mockImplementation(() => {})
})

describe('emitProgressEvent', () => {
  it('writes the event with timestamp coerced to BigInt', async () => {
    prismaMock.progressEvent.create.mockResolvedValue({})
    await emitProgressEvent({
      jobId: 'job-1',
      stage: 'search',
      status: 'progress',
      message: 'working',
      count: 3,
      timestamp: 1700000000000,
    })
    expect(prismaMock.progressEvent.create).toHaveBeenCalledWith({
      data: {
        jobId: 'job-1',
        stage: 'search',
        status: 'progress',
        message: 'working',
        count: 3,
        timestamp: 1700000000000n,
      },
    })
  })

  it('swallows errors instead of throwing', async () => {
    prismaMock.progressEvent.create.mockRejectedValue(new Error('db down'))
    await expect(
      emitProgressEvent({ jobId: 'job-1', stage: 's', status: 'error', message: 'm', timestamp: 1 })
    ).resolves.toBeUndefined()
  })
})

describe('getProgressEvents', () => {
  it('maps rows and converts BigInt timestamps to numbers', async () => {
    prismaMock.progressEvent.findMany.mockResolvedValue([
      { jobId: 'job-1', stage: 'search', status: 'completed', message: 'done', count: null, timestamp: 1700000000000n },
    ])
    const events = await getProgressEvents('job-1')
    expect(events).toEqual([
      { jobId: 'job-1', stage: 'search', status: 'completed', message: 'done', count: undefined, timestamp: 1700000000000 },
    ])
  })

  it('returns an empty array on failure', async () => {
    prismaMock.progressEvent.findMany.mockRejectedValue(new Error('db down'))
    await expect(getProgressEvents('job-1')).resolves.toEqual([])
  })
})

describe('clearProgressEvents', () => {
  it('deletes events scoped to the job', async () => {
    prismaMock.progressEvent.deleteMany.mockResolvedValue({ count: 2 })
    await clearProgressEvents('job-1')
    expect(prismaMock.progressEvent.deleteMany).toHaveBeenCalledWith({ where: { jobId: 'job-1' } })
  })

  it('swallows errors instead of throwing', async () => {
    prismaMock.progressEvent.deleteMany.mockRejectedValue(new Error('db down'))
    await expect(clearProgressEvents('job-1')).resolves.toBeUndefined()
  })
})
