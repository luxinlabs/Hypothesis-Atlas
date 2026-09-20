import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

const { prismaMock, addEvidenceMappingJobMock } = vi.hoisted(() => ({
  prismaMock: {
    job: { findMany: vi.fn(), count: vi.fn(), create: vi.fn() },
  },
  addEvidenceMappingJobMock: vi.fn(),
}))
vi.mock('@/lib/prisma', () => ({ prisma: prismaMock }))
vi.mock('@/lib/queue', () => ({ addEvidenceMappingJob: addEvidenceMappingJobMock }))

import { GET, POST } from './route'

beforeEach(() => {
  vi.clearAllMocks()
  vi.spyOn(console, 'log').mockImplementation(() => {})
  vi.spyOn(console, 'error').mockImplementation(() => {})
})

describe('GET /api/jobs', () => {
  it('returns jobs with pagination defaults', async () => {
    prismaMock.job.findMany.mockResolvedValue([{ id: 'job-1', topicQuery: 'topic', status: 'pending' }])
    prismaMock.job.count.mockResolvedValue(1)

    const res = await GET(new NextRequest('http://localhost/api/jobs'))
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body).toEqual({ jobs: [{ id: 'job-1', topicQuery: 'topic', status: 'pending' }], total: 1, limit: 50, offset: 0 })
    expect(prismaMock.job.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ take: 50, skip: 0 })
    )
  })

  it('honors limit and offset query params', async () => {
    prismaMock.job.findMany.mockResolvedValue([])
    prismaMock.job.count.mockResolvedValue(0)

    await GET(new NextRequest('http://localhost/api/jobs?limit=5&offset=10'))

    expect(prismaMock.job.findMany).toHaveBeenCalledWith(expect.objectContaining({ take: 5, skip: 10 }))
  })

  it('returns 500 when the database call fails', async () => {
    prismaMock.job.findMany.mockRejectedValue(new Error('db down'))
    prismaMock.job.count.mockResolvedValue(0)

    const res = await GET(new NextRequest('http://localhost/api/jobs'))
    expect(res.status).toBe(500)
  })
})

describe('POST /api/jobs', () => {
  function postRequest(body: unknown) {
    return new NextRequest('http://localhost/api/jobs', {
      method: 'POST',
      body: JSON.stringify(body),
      headers: { 'Content-Type': 'application/json' },
    })
  }

  it('creates a job and enqueues evidence mapping', async () => {
    prismaMock.job.create.mockResolvedValue({ id: 'job-1' })
    addEvidenceMappingJobMock.mockResolvedValue(undefined)

    const res = await POST(postRequest({ topicQuery: 'autonomous vehicles' }))
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body).toEqual({ jobId: 'job-1' })
    expect(prismaMock.job.create).toHaveBeenCalledWith({ data: { topicQuery: 'autonomous vehicles', status: 'pending' } })
    expect(addEvidenceMappingJobMock).toHaveBeenCalledWith('job-1', 'autonomous vehicles')
  })

  it('rejects a missing topicQuery', async () => {
    const res = await POST(postRequest({}))
    expect(res.status).toBe(400)
    expect(prismaMock.job.create).not.toHaveBeenCalled()
  })

  it('rejects a non-string topicQuery', async () => {
    const res = await POST(postRequest({ topicQuery: 123 }))
    expect(res.status).toBe(400)
  })

  it('returns 500 when the database (e.g. unreachable Prisma host) throws', async () => {
    prismaMock.job.create.mockRejectedValue(new Error("Can't reach database server"))
    const res = await POST(postRequest({ topicQuery: 'topic' }))
    const body = await res.json()
    expect(res.status).toBe(500)
    expect(body.error).toBe('Failed to create job')
  })
})
