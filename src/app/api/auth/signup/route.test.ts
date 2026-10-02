import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'
import { Prisma } from '@prisma/client'

const { prismaMock } = vi.hoisted(() => ({
  prismaMock: { user: { findUnique: vi.fn(), create: vi.fn() } },
}))
vi.mock('@/lib/prisma', () => ({ prisma: prismaMock }))

import { POST } from './route'

const req = (body: unknown) =>
  new NextRequest('http://localhost/api/auth/signup', {
    method: 'POST',
    body: JSON.stringify(body),
    headers: { 'Content-Type': 'application/json' },
  })

beforeEach(() => {
  vi.clearAllMocks()
  vi.spyOn(console, 'error').mockImplementation(() => {})
})

describe('POST /api/auth/signup', () => {
  it('rejects invalid input before touching the database', async () => {
    const res = await req({ name: '', email: 'a@b.com', password: 'longenough' })
    const result = await POST(res)
    expect(result.status).toBe(400)
    expect(prismaMock.user.findUnique).not.toHaveBeenCalled()
  })

  it('rejects a duplicate email found by the pre-check', async () => {
    prismaMock.user.findUnique.mockResolvedValue({ id: 'existing' })
    const res = await POST(req({ name: 'Ada', email: 'ada@example.com', password: 'longenough' }))
    expect(res.status).toBe(409)
    expect(prismaMock.user.create).not.toHaveBeenCalled()
  })

  it('creates the user on success', async () => {
    prismaMock.user.findUnique.mockResolvedValue(null)
    prismaMock.user.create.mockResolvedValue({ id: 'user-1', name: 'Ada', email: 'ada@example.com' })

    const res = await POST(req({ name: 'Ada', email: 'ada@example.com', password: 'longenough' }))
    const body = await res.json()

    expect(res.status).toBe(201)
    expect(body.user).toEqual({ id: 'user-1', name: 'Ada', email: 'ada@example.com' })
  })

  it('returns 409 (not 500) when a concurrent signup wins the race on the unique constraint', async () => {
    prismaMock.user.findUnique.mockResolvedValue(null)
    prismaMock.user.create.mockRejectedValue(
      new Prisma.PrismaClientKnownRequestError('Unique constraint failed', { code: 'P2002', clientVersion: '5.22.0' })
    )

    const res = await POST(req({ name: 'Ada', email: 'ada@example.com', password: 'longenough' }))
    const body = await res.json()

    expect(res.status).toBe(409)
    expect(body.error).toBe('An account with this email already exists.')
  })

  it('returns 500 for an unrelated database error', async () => {
    prismaMock.user.findUnique.mockResolvedValue(null)
    prismaMock.user.create.mockRejectedValue(new Error('connection refused'))

    const res = await POST(req({ name: 'Ada', email: 'ada@example.com', password: 'longenough' }))
    expect(res.status).toBe(500)
  })
})
