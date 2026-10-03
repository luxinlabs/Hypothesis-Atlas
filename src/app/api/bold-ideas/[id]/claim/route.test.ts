import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

const { prismaMock, getServerSessionMock } = vi.hoisted(() => ({
  prismaMock: { boldIdea: { findUnique: vi.fn(), update: vi.fn() } },
  getServerSessionMock: vi.fn(),
}))
vi.mock('@/lib/prisma', () => ({ prisma: prismaMock }))
vi.mock('next-auth', () => ({ getServerSession: getServerSessionMock }))
vi.mock('@/lib/auth', () => ({ authOptions: {} }))

import { POST } from './route'

const req = () => new NextRequest('http://localhost/api/bold-ideas/idea-1/claim', { method: 'POST' })

beforeEach(() => {
  vi.clearAllMocks()
})

describe('POST /api/bold-ideas/[id]/claim', () => {
  it('rejects an anonymous request', async () => {
    getServerSessionMock.mockResolvedValue(null)
    const res = await POST(req(), { params: { id: 'idea-1' } })
    expect(res.status).toBe(401)
  })

  it('claims an unowned idea', async () => {
    getServerSessionMock.mockResolvedValue({ user: { id: 'user-1' } })
    prismaMock.boldIdea.findUnique.mockResolvedValue({ userId: null })
    prismaMock.boldIdea.update.mockResolvedValue({})

    const res = await POST(req(), { params: { id: 'idea-1' } })

    expect(res.status).toBe(200)
    expect(prismaMock.boldIdea.update).toHaveBeenCalledWith({ where: { id: 'idea-1' }, data: { userId: 'user-1' } })
  })

  it('refuses to claim an idea owned by someone else', async () => {
    getServerSessionMock.mockResolvedValue({ user: { id: 'user-2' } })
    prismaMock.boldIdea.findUnique.mockResolvedValue({ userId: 'user-1' })

    const res = await POST(req(), { params: { id: 'idea-1' } })
    expect(res.status).toBe(409)
  })
})
