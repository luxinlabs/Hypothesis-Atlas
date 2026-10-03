import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { NextRequest } from 'next/server'

const { prismaMock, addEvidenceMappingJobMock, getServerSessionMock } = vi.hoisted(() => ({
  prismaMock: {
    job: { findMany: vi.fn(), count: vi.fn(), create: vi.fn() },
  },
  addEvidenceMappingJobMock: vi.fn(),
  getServerSessionMock: vi.fn(),
}))
vi.mock('@/lib/prisma', () => ({ prisma: prismaMock }))
vi.mock('@/lib/queue', () => ({ addEvidenceMappingJob: addEvidenceMappingJobMock }))
vi.mock('next-auth', () => ({ getServerSession: getServerSessionMock }))
vi.mock('@/lib/auth', () => ({ authOptions: {} }))

import { GET, POST } from './route'

beforeEach(() => {
  vi.clearAllMocks()
  vi.spyOn(console, 'log').mockImplementation(() => {})
  vi.spyOn(console, 'error').mockImplementation(() => {})
  getServerSessionMock.mockResolvedValue(null)
})

describe('GET /api/jobs', () => {
  it('returns jobs with pagination defaults', async () => {
    prismaMock.job.findMany.mockResolvedValue([{ id: 'job-1', topicQuery: 'topic', status: 'pending' }])
    prismaMock.job.count.mockResolvedValue(1)

    const res = await GET(new NextRequest('http://localhost/api/jobs'))
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body).toEqual({ jobs: [{ id: 'job-1', topicQuery: 'topic', status: 'pending', isMine: false, isUnclaimed: false }], total: 1, limit: 50, offset: 0 })
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

  it('flags the viewer\'s own and unclaimed jobs, without exposing other ids', async () => {
    getServerSessionMock.mockResolvedValue({ user: { id: 'user-1' } })
    prismaMock.job.findMany.mockResolvedValue([
      { id: 'mine', topicQuery: 'a', status: 'pending', createdAt: new Date(), updatedAt: new Date(), userId: 'user-1', _count: { sources: 0, nodes: 0 } },
      { id: 'anon', topicQuery: 'b', status: 'pending', createdAt: new Date(), updatedAt: new Date(), userId: null, _count: { sources: 0, nodes: 0 } },
    ])
    prismaMock.job.count.mockResolvedValue(2)

    const body = await (await GET(new NextRequest('http://localhost/api/jobs'))).json()

    expect(body.jobs[0]).toMatchObject({ id: 'mine', isMine: true, isUnclaimed: false })
    expect(body.jobs[1]).toMatchObject({ id: 'anon', isMine: false, isUnclaimed: true })
    expect(JSON.stringify(body)).not.toContain('user-1')
  })

  it('only shows unowned jobs to an anonymous request', async () => {
    prismaMock.job.findMany.mockResolvedValue([])
    prismaMock.job.count.mockResolvedValue(0)

    await GET(new NextRequest('http://localhost/api/jobs'))

    expect(prismaMock.job.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: { userId: null } }))
    expect(prismaMock.job.count).toHaveBeenCalledWith({ where: { userId: null } })
  })

  it('shows unowned jobs plus the signed-in user\'s own', async () => {
    getServerSessionMock.mockResolvedValue({ user: { id: 'user-1' } })
    prismaMock.job.findMany.mockResolvedValue([])
    prismaMock.job.count.mockResolvedValue(0)

    await GET(new NextRequest('http://localhost/api/jobs'))

    expect(prismaMock.job.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { OR: [{ userId: null }, { userId: 'user-1' }] } })
    )
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
    expect(prismaMock.job.create).toHaveBeenCalledWith({
      data: { topicQuery: 'autonomous vehicles', status: 'pending', userId: null },
    })
    expect(addEvidenceMappingJobMock).toHaveBeenCalledWith('job-1', 'autonomous vehicles')
  })

  it('stamps userId from the session when the user is signed in', async () => {
    getServerSessionMock.mockResolvedValue({ user: { id: 'user-42' } })
    prismaMock.job.create.mockResolvedValue({ id: 'job-1' })
    addEvidenceMappingJobMock.mockResolvedValue(undefined)

    await POST(postRequest({ topicQuery: 'autonomous vehicles' }))

    expect(prismaMock.job.create).toHaveBeenCalledWith({
      data: { topicQuery: 'autonomous vehicles', status: 'pending', userId: 'user-42' },
    })
  })

  describe('REQUIRE_AUTH=true (hosted deployment)', () => {
    const original = process.env.REQUIRE_AUTH
    beforeEach(() => { process.env.REQUIRE_AUTH = 'true' })
    afterEach(() => { process.env.REQUIRE_AUTH = original })

    it('rejects an anonymous request', async () => {
      const res = await POST(postRequest({ topicQuery: 'autonomous vehicles' }))
      expect(res.status).toBe(401)
      expect(prismaMock.job.create).not.toHaveBeenCalled()
    })

    it('allows a signed-in request', async () => {
      getServerSessionMock.mockResolvedValue({ user: { id: 'user-42' } })
      prismaMock.job.create.mockResolvedValue({ id: 'job-1' })
      addEvidenceMappingJobMock.mockResolvedValue(undefined)

      const res = await POST(postRequest({ topicQuery: 'autonomous vehicles' }))
      expect(res.status).toBe(200)
    })
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
