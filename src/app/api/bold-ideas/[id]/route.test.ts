import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

const { prismaMock, getServerSessionMock } = vi.hoisted(() => ({
  prismaMock: { boldIdea: { findUnique: vi.fn(), delete: vi.fn() }, job: { delete: vi.fn() } },
  getServerSessionMock: vi.fn(),
}))
vi.mock('@/lib/prisma', () => ({ prisma: prismaMock }))
vi.mock('next-auth', () => ({ getServerSession: getServerSessionMock }))
vi.mock('@/lib/auth', () => ({ authOptions: {} }))

import { GET, DELETE } from './route'

const baseIdea = {
  id: 'idea-1',
  text: 'an idea',
  tagsJson: '[]',
  agentTraceJson: null,
  experimentJson: null,
  knowledgeJson: null,
  jobId: null,
  userId: null,
  createdAt: new Date(),
}

beforeEach(() => {
  vi.clearAllMocks()
  vi.spyOn(console, 'error').mockImplementation(() => {})
  getServerSessionMock.mockResolvedValue(null)
})

describe('GET /api/bold-ideas/[id]', () => {
  it('returns 404 when the idea does not exist', async () => {
    prismaMock.boldIdea.findUnique.mockResolvedValue(null)
    const res = await GET(new NextRequest('http://localhost/api/bold-ideas/missing'), { params: { id: 'missing' } })
    expect(res.status).toBe(404)
  })

  it('allows anyone to read an unowned idea', async () => {
    prismaMock.boldIdea.findUnique.mockResolvedValue(baseIdea)
    const res = await GET(new NextRequest('http://localhost/api/bold-ideas/idea-1'), { params: { id: 'idea-1' } })
    expect(res.status).toBe(200)
  })

  it('denies a different signed-in user', async () => {
    prismaMock.boldIdea.findUnique.mockResolvedValue({ ...baseIdea, userId: 'user-1' })
    getServerSessionMock.mockResolvedValue({ user: { id: 'user-2' } })
    const res = await GET(new NextRequest('http://localhost/api/bold-ideas/idea-1'), { params: { id: 'idea-1' } })
    expect(res.status).toBe(403)
  })

  it('allows the owner', async () => {
    prismaMock.boldIdea.findUnique.mockResolvedValue({ ...baseIdea, userId: 'user-1' })
    getServerSessionMock.mockResolvedValue({ user: { id: 'user-1' } })
    const res = await GET(new NextRequest('http://localhost/api/bold-ideas/idea-1'), { params: { id: 'idea-1' } })
    expect(res.status).toBe(200)
  })
})

describe('DELETE /api/bold-ideas/[id]', () => {
  it('deletes an unowned idea', async () => {
    prismaMock.boldIdea.findUnique.mockResolvedValue({ jobId: null, userId: null })
    prismaMock.boldIdea.delete.mockResolvedValue({})
    const res = await DELETE(new NextRequest('http://localhost/api/bold-ideas/idea-1'), { params: { id: 'idea-1' } })
    expect(res.status).toBe(200)
  })

  it('denies deleting an idea owned by someone else', async () => {
    prismaMock.boldIdea.findUnique.mockResolvedValue({ jobId: null, userId: 'user-1' })
    getServerSessionMock.mockResolvedValue({ user: { id: 'user-2' } })
    const res = await DELETE(new NextRequest('http://localhost/api/bold-ideas/idea-1'), { params: { id: 'idea-1' } })
    expect(res.status).toBe(403)
    expect(prismaMock.boldIdea.delete).not.toHaveBeenCalled()
  })
})
