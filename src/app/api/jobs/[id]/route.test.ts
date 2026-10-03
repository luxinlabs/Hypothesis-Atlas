import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

const { prismaMock, getServerSessionMock } = vi.hoisted(() => ({
  prismaMock: { job: { findUnique: vi.fn(), delete: vi.fn() } },
  getServerSessionMock: vi.fn(),
}))
vi.mock('@/lib/prisma', () => ({ prisma: prismaMock }))
vi.mock('next-auth', () => ({ getServerSession: getServerSessionMock }))
vi.mock('@/lib/auth', () => ({ authOptions: {} }))

import { GET, DELETE } from './route'

beforeEach(() => {
  vi.clearAllMocks()
  vi.spyOn(console, 'error').mockImplementation(() => {})
  getServerSessionMock.mockResolvedValue(null)
})

describe('GET /api/jobs/[id]', () => {
  it('returns the job with the root node id derived from the parentless node', async () => {
    prismaMock.job.findUnique.mockResolvedValue({
      id: 'job-1',
      topicQuery: 'topic',
      status: 'completed',
      createdAt: new Date('2024-01-01'),
      userId: null,
      nodes: [{ id: 'node-root' }],
    })

    const res = await GET(new NextRequest('http://localhost/api/jobs/job-1'), { params: { id: 'job-1' } })
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.rootNodeId).toBe('node-root')
    expect(prismaMock.job.findUnique).toHaveBeenCalledWith({
      where: { id: 'job-1' },
      include: { nodes: { where: { parentId: null }, take: 1 } },
    })
  })

  it('returns null rootNodeId when there is no root node yet', async () => {
    prismaMock.job.findUnique.mockResolvedValue({
      id: 'job-1',
      topicQuery: 'topic',
      status: 'pending',
      createdAt: new Date(),
      userId: null,
      nodes: [],
    })
    const res = await GET(new NextRequest('http://localhost/api/jobs/job-1'), { params: { id: 'job-1' } })
    const body = await res.json()
    expect(body.rootNodeId).toBeNull()
  })

  it('returns 404 when the job does not exist', async () => {
    prismaMock.job.findUnique.mockResolvedValue(null)
    const res = await GET(new NextRequest('http://localhost/api/jobs/missing'), { params: { id: 'missing' } })
    expect(res.status).toBe(404)
  })

  it('returns 500 on a database error', async () => {
    prismaMock.job.findUnique.mockRejectedValue(new Error('db down'))
    const res = await GET(new NextRequest('http://localhost/api/jobs/job-1'), { params: { id: 'job-1' } })
    expect(res.status).toBe(500)
  })

  it('allows anyone to read an unowned (anonymous) job', async () => {
    prismaMock.job.findUnique.mockResolvedValue({
      id: 'job-1', topicQuery: 't', status: 'pending', createdAt: new Date(), userId: null, nodes: [],
    })
    getServerSessionMock.mockResolvedValue(null)
    const res = await GET(new NextRequest('http://localhost/api/jobs/job-1'), { params: { id: 'job-1' } })
    expect(res.status).toBe(200)
  })

  it('allows the owner to read their own job', async () => {
    prismaMock.job.findUnique.mockResolvedValue({
      id: 'job-1', topicQuery: 't', status: 'pending', createdAt: new Date(), userId: 'user-1', nodes: [],
    })
    getServerSessionMock.mockResolvedValue({ user: { id: 'user-1' } })
    const res = await GET(new NextRequest('http://localhost/api/jobs/job-1'), { params: { id: 'job-1' } })
    expect(res.status).toBe(200)
  })

  it('denies a different signed-in user reading someone else\'s job', async () => {
    prismaMock.job.findUnique.mockResolvedValue({
      id: 'job-1', topicQuery: 't', status: 'pending', createdAt: new Date(), userId: 'user-1', nodes: [],
    })
    getServerSessionMock.mockResolvedValue({ user: { id: 'user-2' } })
    const res = await GET(new NextRequest('http://localhost/api/jobs/job-1'), { params: { id: 'job-1' } })
    expect(res.status).toBe(403)
  })

  it('denies an anonymous request reading an owned job', async () => {
    prismaMock.job.findUnique.mockResolvedValue({
      id: 'job-1', topicQuery: 't', status: 'pending', createdAt: new Date(), userId: 'user-1', nodes: [],
    })
    getServerSessionMock.mockResolvedValue(null)
    const res = await GET(new NextRequest('http://localhost/api/jobs/job-1'), { params: { id: 'job-1' } })
    expect(res.status).toBe(403)
  })
})

describe('DELETE /api/jobs/[id]', () => {
  it('deletes an unowned job', async () => {
    prismaMock.job.findUnique.mockResolvedValue({ userId: null })
    prismaMock.job.delete.mockResolvedValue({})
    const res = await DELETE(new NextRequest('http://localhost/api/jobs/job-1'), { params: { id: 'job-1' } })
    const body = await res.json()
    expect(res.status).toBe(200)
    expect(body).toEqual({ ok: true })
    expect(prismaMock.job.delete).toHaveBeenCalledWith({ where: { id: 'job-1' } })
  })

  it('returns 404 when the job does not exist', async () => {
    prismaMock.job.findUnique.mockResolvedValue(null)
    const res = await DELETE(new NextRequest('http://localhost/api/jobs/missing'), { params: { id: 'missing' } })
    expect(res.status).toBe(404)
    expect(prismaMock.job.delete).not.toHaveBeenCalled()
  })

  it('denies deleting a job owned by someone else', async () => {
    prismaMock.job.findUnique.mockResolvedValue({ userId: 'user-1' })
    getServerSessionMock.mockResolvedValue({ user: { id: 'user-2' } })
    const res = await DELETE(new NextRequest('http://localhost/api/jobs/job-1'), { params: { id: 'job-1' } })
    expect(res.status).toBe(403)
    expect(prismaMock.job.delete).not.toHaveBeenCalled()
  })

  it('allows the owner to delete their own job', async () => {
    prismaMock.job.findUnique.mockResolvedValue({ userId: 'user-1' })
    getServerSessionMock.mockResolvedValue({ user: { id: 'user-1' } })
    prismaMock.job.delete.mockResolvedValue({})
    const res = await DELETE(new NextRequest('http://localhost/api/jobs/job-1'), { params: { id: 'job-1' } })
    expect(res.status).toBe(200)
  })

  it('returns 500 when the delete fails', async () => {
    prismaMock.job.findUnique.mockResolvedValue({ userId: null })
    prismaMock.job.delete.mockRejectedValue(new Error('not found'))
    const res = await DELETE(new NextRequest('http://localhost/api/jobs/missing'), { params: { id: 'missing' } })
    expect(res.status).toBe(500)
  })
})
