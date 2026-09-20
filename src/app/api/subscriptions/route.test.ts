import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

const { prismaMock, fetchTopicPapersMock, sendMock } = vi.hoisted(() => ({
  prismaMock: {
    paperSubscription: { findFirst: vi.fn(), update: vi.fn(), create: vi.fn(), findMany: vi.fn() },
  },
  fetchTopicPapersMock: vi.fn(),
  sendMock: vi.fn(),
}))
vi.mock('@/lib/prisma', () => ({ prisma: prismaMock }))
vi.mock('@/lib/fetchTopicPapers', () => ({ fetchTopicPapers: fetchTopicPapersMock }))
vi.mock('resend', () => ({
  Resend: vi.fn().mockImplementation(() => ({ emails: { send: sendMock } })),
}))

import { GET, POST } from './route'

function postRequest(body: unknown) {
  return new NextRequest('http://localhost/api/subscriptions', {
    method: 'POST',
    body: JSON.stringify(body),
    headers: { 'Content-Type': 'application/json' },
  })
}

beforeEach(() => {
  vi.clearAllMocks()
  vi.spyOn(console, 'log').mockImplementation(() => {})
  vi.spyOn(console, 'warn').mockImplementation(() => {})
  vi.spyOn(console, 'error').mockImplementation(() => {})
  delete process.env.RESEND_API_KEY
})

describe('POST /api/subscriptions', () => {
  const validBody = { email: 'Person@Example.com', topic: 'autonomous vehicles', frequency: 10, deliveryTime: '09:00' }

  it('rejects an invalid email', async () => {
    const res = await POST(postRequest({ ...validBody, email: 'not-an-email' }))
    expect(res.status).toBe(400)
  })

  it('rejects a missing topic', async () => {
    const res = await POST(postRequest({ ...validBody, topic: '' }))
    expect(res.status).toBe(400)
  })

  it('rejects an invalid frequency', async () => {
    const res = await POST(postRequest({ ...validBody, frequency: 7 }))
    expect(res.status).toBe(400)
  })

  it('defaults deliveryTime to 09:00 when malformed', async () => {
    prismaMock.paperSubscription.findFirst.mockResolvedValue(null)
    prismaMock.paperSubscription.create.mockResolvedValue({ id: 'sub-1', unsubToken: 'tok', createdAt: new Date() })

    await POST(postRequest({ ...validBody, deliveryTime: 'not-a-time' }))

    expect(prismaMock.paperSubscription.create).toHaveBeenCalledWith({
      data: { email: 'person@example.com', topic: 'autonomous vehicles', frequency: 10, deliveryTime: '09:00' },
    })
  })

  it('creates a new subscription and skips email when RESEND_API_KEY is unset', async () => {
    prismaMock.paperSubscription.findFirst.mockResolvedValue(null)
    prismaMock.paperSubscription.create.mockResolvedValue({ id: 'sub-1', unsubToken: 'tok', createdAt: new Date() })

    const res = await POST(postRequest(validBody))
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.updated).toBe(false)
    expect(body.emailSent).toBe(false)
    expect(body.emailError).toBe('RESEND_API_KEY not configured')
    expect(fetchTopicPapersMock).not.toHaveBeenCalled()
  })

  it('updates an existing subscription for the same email/topic', async () => {
    prismaMock.paperSubscription.findFirst.mockResolvedValue({ id: 'existing-1' })
    prismaMock.paperSubscription.update.mockResolvedValue({ id: 'existing-1', unsubToken: 'tok', createdAt: new Date() })

    const res = await POST(postRequest(validBody))
    const body = await res.json()

    expect(body.updated).toBe(true)
    expect(prismaMock.paperSubscription.update).toHaveBeenCalledWith({
      where: { id: 'existing-1' },
      data: { frequency: 10, deliveryTime: '09:00' },
    })
  })

  it('fetches papers and sends the digest email when RESEND_API_KEY is set', async () => {
    process.env.RESEND_API_KEY = 'test-resend-key'
    prismaMock.paperSubscription.findFirst.mockResolvedValue(null)
    prismaMock.paperSubscription.create.mockResolvedValue({ id: 'sub-1', unsubToken: 'tok', createdAt: new Date() })
    fetchTopicPapersMock.mockResolvedValue([])
    sendMock.mockResolvedValue({ data: { id: 'email-1' }, error: null })

    const res = await POST(postRequest(validBody))
    const body = await res.json()

    expect(fetchTopicPapersMock).toHaveBeenCalledWith('autonomous vehicles', 10)
    expect(sendMock).toHaveBeenCalled()
    expect(body.emailSent).toBe(true)
  })

  it('surfaces a Resend error without failing the request', async () => {
    process.env.RESEND_API_KEY = 'test-resend-key'
    prismaMock.paperSubscription.findFirst.mockResolvedValue(null)
    prismaMock.paperSubscription.create.mockResolvedValue({ id: 'sub-1', unsubToken: 'tok', createdAt: new Date() })
    fetchTopicPapersMock.mockResolvedValue([])
    sendMock.mockResolvedValue({ data: null, error: { message: 'send failed' } })

    const res = await POST(postRequest(validBody))
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.emailSent).toBe(false)
    expect(body.emailError).toBe('send failed')
  })

  it('returns 500 on unexpected errors', async () => {
    prismaMock.paperSubscription.findFirst.mockRejectedValue(new Error('db down'))
    const res = await POST(postRequest(validBody))
    expect(res.status).toBe(500)
  })
})

describe('GET /api/subscriptions', () => {
  it('returns an empty list when no email is provided', async () => {
    const res = await GET(new NextRequest('http://localhost/api/subscriptions'))
    const body = await res.json()
    expect(body).toEqual({ subscriptions: [] })
    expect(prismaMock.paperSubscription.findMany).not.toHaveBeenCalled()
  })

  it('looks up subscriptions by lowercased email', async () => {
    prismaMock.paperSubscription.findMany.mockResolvedValue([{ id: 'sub-1' }])
    const res = await GET(new NextRequest('http://localhost/api/subscriptions?email=Person@Example.com'))
    const body = await res.json()
    expect(body.subscriptions).toEqual([{ id: 'sub-1' }])
    expect(prismaMock.paperSubscription.findMany).toHaveBeenCalledWith({
      where: { email: 'person@example.com' },
      orderBy: { createdAt: 'desc' },
    })
  })
})
