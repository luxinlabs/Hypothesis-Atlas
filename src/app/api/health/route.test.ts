import { describe, it, expect, vi, beforeEach } from 'vitest'

const { prismaMock } = vi.hoisted(() => ({ prismaMock: { $queryRaw: vi.fn() } }))
vi.mock('@/lib/prisma', () => ({ prisma: prismaMock }))

import { GET } from './route'

beforeEach(() => {
  vi.clearAllMocks()
  vi.spyOn(console, 'error').mockImplementation(() => {})
})

describe('GET /api/health', () => {
  it('reports ok when the database responds', async () => {
    prismaMock.$queryRaw.mockResolvedValue([{ '?column?': 1 }])
    const res = await GET()
    const body = await res.json()
    expect(res.status).toBe(200)
    expect(body.status).toBe('ok')
    expect(body.database).toBe('connected')
    expect(body.environment.DATABASE_URL).toBe('SET')
  })

  it('reports 500 when the database is unreachable', async () => {
    prismaMock.$queryRaw.mockRejectedValue(new Error("Can't reach database server"))
    const res = await GET()
    const body = await res.json()
    expect(res.status).toBe(500)
    expect(body.status).toBe('error')
    expect(body.database).toBe('disconnected')
    expect(body.error).toContain("Can't reach database server")
  })
})
