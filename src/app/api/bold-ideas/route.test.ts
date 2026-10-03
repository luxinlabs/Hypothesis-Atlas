import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { NextRequest } from 'next/server'

const { prismaMock, getServerSessionMock, tagSubjectsMock, runBoldIdeaAgentsMock } = vi.hoisted(() => ({
  prismaMock: { boldIdea: { findMany: vi.fn(), create: vi.fn() } },
  getServerSessionMock: vi.fn(),
  tagSubjectsMock: vi.fn(),
  runBoldIdeaAgentsMock: vi.fn(),
}))
vi.mock('@/lib/prisma', () => ({ prisma: prismaMock }))
vi.mock('next-auth', () => ({ getServerSession: getServerSessionMock }))
vi.mock('@/lib/auth', () => ({ authOptions: {} }))
vi.mock('@/lib/boldIdea', () => ({ tagSubjects: tagSubjectsMock }))
vi.mock('@/lib/boldIdeaAgents', () => ({ runBoldIdeaAgents: runBoldIdeaAgentsMock }))

import { GET, POST } from './route'

const postRequest = (body: unknown) =>
  new NextRequest('http://localhost/api/bold-ideas', {
    method: 'POST',
    body: JSON.stringify(body),
    headers: { 'Content-Type': 'application/json' },
  })

beforeEach(() => {
  vi.clearAllMocks()
  vi.spyOn(console, 'error').mockImplementation(() => {})
  getServerSessionMock.mockResolvedValue(null)
})

describe('GET /api/bold-ideas', () => {
  it('only shows unowned ideas to an anonymous request', async () => {
    prismaMock.boldIdea.findMany.mockResolvedValue([])
    await GET(new NextRequest('http://localhost/api/bold-ideas'))
    expect(prismaMock.boldIdea.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: { userId: null } }))
  })

  it('shows unowned ideas plus the signed-in user\'s own', async () => {
    getServerSessionMock.mockResolvedValue({ user: { id: 'user-1' } })
    prismaMock.boldIdea.findMany.mockResolvedValue([])
    await GET(new NextRequest('http://localhost/api/bold-ideas'))
    expect(prismaMock.boldIdea.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { OR: [{ userId: null }, { userId: 'user-1' }] } })
    )
  })
})

describe('POST /api/bold-ideas', () => {
  it('rejects empty text', async () => {
    const res = await POST(postRequest({ text: '  ' }))
    expect(res.status).toBe(400)
  })

  it('creates an idea with userId null when anonymous', async () => {
    tagSubjectsMock.mockResolvedValue(['Tag'])
    runBoldIdeaAgentsMock.mockResolvedValue({ candidates: [] })
    prismaMock.boldIdea.create.mockResolvedValue({ id: 'idea-1' })

    const res = await POST(postRequest({ text: 'an idea' }))

    expect(res.status).toBe(201)
    expect(prismaMock.boldIdea.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ userId: null }) })
    )
  })

  describe('REQUIRE_AUTH=true (hosted deployment)', () => {
    const original = process.env.REQUIRE_AUTH
    beforeEach(() => { process.env.REQUIRE_AUTH = 'true' })
    afterEach(() => { process.env.REQUIRE_AUTH = original })

    it('rejects an anonymous request', async () => {
      const res = await POST(postRequest({ text: 'an idea' }))
      expect(res.status).toBe(401)
      expect(prismaMock.boldIdea.create).not.toHaveBeenCalled()
    })
  })
})
