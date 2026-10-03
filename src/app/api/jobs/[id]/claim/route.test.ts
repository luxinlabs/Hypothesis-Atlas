import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

const { prismaMock, getServerSessionMock } = vi.hoisted(() => ({
  prismaMock: { job: { findUnique: vi.fn(), update: vi.fn(), updateMany: vi.fn() } },
  getServerSessionMock: vi.fn(),
}))
vi.mock('@/lib/prisma', () => ({ prisma: prismaMock }))
vi.mock('next-auth', () => ({ getServerSession: getServerSessionMock }))
vi.mock('@/lib/auth', () => ({ authOptions: {} }))

import { POST } from './route'

const req = () => new NextRequest('http://localhost/api/jobs/job-1/claim', { method: 'POST' })

beforeEach(() => {
  vi.clearAllMocks()
})

describe('POST /api/jobs/[id]/claim', () => {
  it('rejects an anonymous request', async () => {
    getServerSessionMock.mockResolvedValue(null)
    const res = await POST(req(), { params: { id: 'job-1' } })
    expect(res.status).toBe(401)
    expect(prismaMock.job.updateMany).not.toHaveBeenCalled()
  })

  it('returns 404 for a missing job', async () => {
    getServerSessionMock.mockResolvedValue({ user: { id: 'user-1' } })
    prismaMock.job.findUnique.mockResolvedValue(null)
    const res = await POST(req(), { params: { id: 'missing' } })
    expect(res.status).toBe(404)
  })

  it('claims an unowned job', async () => {
    getServerSessionMock.mockResolvedValue({ user: { id: 'user-1' } })
    prismaMock.job.findUnique.mockResolvedValue({ userId: null })
    prismaMock.job.updateMany.mockResolvedValue({ count: 1 })

    const res = await POST(req(), { params: { id: 'job-1' } })
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body).toEqual({ ok: true })
    expect(prismaMock.job.updateMany).toHaveBeenCalledWith({ where: { id: 'job-1', userId: null }, data: { userId: 'user-1' } })
  })

  it('is idempotent for the current owner', async () => {
    getServerSessionMock.mockResolvedValue({ user: { id: 'user-1' } })
    prismaMock.job.findUnique.mockResolvedValue({ userId: 'user-1' })

    const res = await POST(req(), { params: { id: 'job-1' } })
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body).toEqual({ ok: true, alreadyOwned: true })
    expect(prismaMock.job.updateMany).not.toHaveBeenCalled()
  })

  it('refuses to claim a job owned by someone else', async () => {
    getServerSessionMock.mockResolvedValue({ user: { id: 'user-2' } })
    prismaMock.job.findUnique.mockResolvedValue({ userId: 'user-1' })

    const res = await POST(req(), { params: { id: 'job-1' } })
    expect(res.status).toBe(409)
    expect(prismaMock.job.updateMany).not.toHaveBeenCalled()
  })

  it('loses a concurrent race cleanly with 409 instead of overwriting the winner', async () => {
    getServerSessionMock.mockResolvedValue({ user: { id: 'user-2' } })
    prismaMock.job.findUnique
      .mockResolvedValueOnce({ userId: null })
      .mockResolvedValueOnce({ userId: 'user-1' })
    prismaMock.job.updateMany.mockResolvedValue({ count: 0 })

    const res = await POST(req(), { params: { id: 'job-1' } })
    expect(res.status).toBe(409)
  })
})
