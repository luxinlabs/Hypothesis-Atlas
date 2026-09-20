import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

const { prismaMock } = vi.hoisted(() => ({ prismaMock: { job: { findUnique: vi.fn(), delete: vi.fn() } } }))
vi.mock('@/lib/prisma', () => ({ prisma: prismaMock }))

import { GET, DELETE } from './route'

beforeEach(() => {
  vi.clearAllMocks()
  vi.spyOn(console, 'error').mockImplementation(() => {})
})

describe('GET /api/jobs/[id]', () => {
  it('returns the job with the root node id derived from the parentless node', async () => {
    prismaMock.job.findUnique.mockResolvedValue({
      id: 'job-1',
      topicQuery: 'topic',
      status: 'completed',
      createdAt: new Date('2024-01-01'),
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
})

describe('DELETE /api/jobs/[id]', () => {
  it('deletes the job', async () => {
    prismaMock.job.delete.mockResolvedValue({})
    const res = await DELETE(new NextRequest('http://localhost/api/jobs/job-1'), { params: { id: 'job-1' } })
    const body = await res.json()
    expect(res.status).toBe(200)
    expect(body).toEqual({ ok: true })
    expect(prismaMock.job.delete).toHaveBeenCalledWith({ where: { id: 'job-1' } })
  })

  it('returns 500 when the delete fails', async () => {
    prismaMock.job.delete.mockRejectedValue(new Error('not found'))
    const res = await DELETE(new NextRequest('http://localhost/api/jobs/missing'), { params: { id: 'missing' } })
    expect(res.status).toBe(500)
  })
})
