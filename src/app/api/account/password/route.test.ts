import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'
import bcrypt from 'bcryptjs'

const { prismaMock, getServerSessionMock } = vi.hoisted(() => ({
  prismaMock: { user: { findUnique: vi.fn(), update: vi.fn() } },
  getServerSessionMock: vi.fn(),
}))
vi.mock('@/lib/prisma', () => ({ prisma: prismaMock }))
vi.mock('next-auth', () => ({ getServerSession: getServerSessionMock }))
vi.mock('@/lib/auth', () => ({ authOptions: {} }))

import { POST } from './route'

const req = (body: unknown) =>
  new NextRequest('http://localhost/api/account/password', {
    method: 'POST',
    body: JSON.stringify(body),
    headers: { 'Content-Type': 'application/json' },
  })

beforeEach(() => {
  vi.clearAllMocks()
})

describe('POST /api/account/password', () => {
  it('rejects an anonymous request', async () => {
    getServerSessionMock.mockResolvedValue(null)
    const res = await POST(req({ currentPassword: 'a', newPassword: 'longenough' }))
    expect(res.status).toBe(401)
  })

  it('rejects a too-short new password', async () => {
    getServerSessionMock.mockResolvedValue({ user: { id: 'user-1' } })
    const res = await POST(req({ currentPassword: 'a', newPassword: 'short' }))
    expect(res.status).toBe(400)
  })

  it('rejects an account with no password (OAuth-only)', async () => {
    getServerSessionMock.mockResolvedValue({ user: { id: 'user-1' } })
    prismaMock.user.findUnique.mockResolvedValue({ passwordHash: null })
    const res = await POST(req({ currentPassword: 'a', newPassword: 'longenough' }))
    expect(res.status).toBe(400)
  })

  it('rejects an incorrect current password', async () => {
    getServerSessionMock.mockResolvedValue({ user: { id: 'user-1' } })
    const hash = await bcrypt.hash('correctpassword', 4)
    prismaMock.user.findUnique.mockResolvedValue({ passwordHash: hash })

    const res = await POST(req({ currentPassword: 'wrongpassword', newPassword: 'longenough' }))

    expect(res.status).toBe(403)
    expect(prismaMock.user.update).not.toHaveBeenCalled()
  })

  it('updates the password when the current one is correct', async () => {
    getServerSessionMock.mockResolvedValue({ user: { id: 'user-1' } })
    const hash = await bcrypt.hash('correctpassword', 4)
    prismaMock.user.findUnique.mockResolvedValue({ passwordHash: hash })
    prismaMock.user.update.mockResolvedValue({})

    const res = await POST(req({ currentPassword: 'correctpassword', newPassword: 'newlongenough' }))
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body).toEqual({ ok: true })
    expect(prismaMock.user.update).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 'user-1' } })
    )
  })
})
