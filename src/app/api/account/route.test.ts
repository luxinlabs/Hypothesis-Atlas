import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

const { prismaMock, getServerSessionMock } = vi.hoisted(() => ({
  prismaMock: {
    user: { findUnique: vi.fn(), update: vi.fn() },
    job: { count: vi.fn() },
    boldIdea: { count: vi.fn() },
  },
  getServerSessionMock: vi.fn(),
}))
vi.mock('@/lib/prisma', () => ({ prisma: prismaMock }))
vi.mock('next-auth', () => ({ getServerSession: getServerSessionMock }))
vi.mock('@/lib/auth', () => ({ authOptions: {} }))

import { GET, PATCH } from './route'

beforeEach(() => {
  vi.clearAllMocks()
})

describe('GET /api/account', () => {
  it('rejects an anonymous request', async () => {
    getServerSessionMock.mockResolvedValue(null)
    const res = await GET()
    expect(res.status).toBe(401)
  })

  it('returns the profile with real usage counts', async () => {
    getServerSessionMock.mockResolvedValue({ user: { id: 'user-1' } })
    prismaMock.user.findUnique.mockResolvedValue({
      id: 'user-1', name: 'Ada', email: 'ada@example.com', image: null, planTier: 'free', createdAt: new Date('2026-01-01'),
    })
    prismaMock.job.count.mockResolvedValue(3)
    prismaMock.boldIdea.count.mockResolvedValue(5)

    const res = await GET()
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.usage).toEqual({ jobs: 3, boldIdeas: 5 })
    expect(prismaMock.job.count).toHaveBeenCalledWith({ where: { userId: 'user-1' } })
    expect(prismaMock.boldIdea.count).toHaveBeenCalledWith({ where: { userId: 'user-1' } })
  })

  it('returns 404 if the session user no longer exists', async () => {
    getServerSessionMock.mockResolvedValue({ user: { id: 'gone' } })
    prismaMock.user.findUnique.mockResolvedValue(null)
    prismaMock.job.count.mockResolvedValue(0)
    prismaMock.boldIdea.count.mockResolvedValue(0)

    const res = await GET()
    expect(res.status).toBe(404)
  })
})

describe('PATCH /api/account', () => {
  const req = (body: unknown) =>
    new NextRequest('http://localhost/api/account', {
      method: 'PATCH',
      body: JSON.stringify(body),
      headers: { 'Content-Type': 'application/json' },
    })

  it('rejects an anonymous request', async () => {
    getServerSessionMock.mockResolvedValue(null)
    const res = await PATCH(req({ name: 'New Name' }))
    expect(res.status).toBe(401)
  })

  it('rejects an empty name', async () => {
    getServerSessionMock.mockResolvedValue({ user: { id: 'user-1' } })
    const res = await PATCH(req({ name: '   ' }))
    expect(res.status).toBe(400)
    expect(prismaMock.user.update).not.toHaveBeenCalled()
  })

  it('updates the name', async () => {
    getServerSessionMock.mockResolvedValue({ user: { id: 'user-1' } })
    prismaMock.user.update.mockResolvedValue({ id: 'user-1', name: 'New Name', email: 'a@b.com', image: null, planTier: 'free', createdAt: new Date() })

    const res = await PATCH(req({ name: 'New Name' }))

    expect(res.status).toBe(200)
    expect(prismaMock.user.update).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 'user-1' }, data: { name: 'New Name' } })
    )
  })
})
