import { describe, it, expect } from 'vitest'
import { validateSignupInput } from './authValidation'

describe('validateSignupInput', () => {
  it('accepts a valid signup', () => {
    const result = validateSignupInput({ name: 'Ada Lovelace', email: 'Ada@Example.com', password: 'longenough' })
    expect(result).toEqual({
      ok: true,
      data: { name: 'Ada Lovelace', email: 'ada@example.com', password: 'longenough' },
    })
  })

  it('rejects a missing name', () => {
    const result = validateSignupInput({ name: '  ', email: 'a@b.com', password: 'longenough' })
    expect(result).toEqual({ ok: false, error: 'Name is required.' })
  })

  it('rejects a malformed email', () => {
    const result = validateSignupInput({ name: 'Ada', email: 'not-an-email', password: 'longenough' })
    expect(result).toEqual({ ok: false, error: 'A valid email is required.' })
  })

  it('rejects a missing email', () => {
    const result = validateSignupInput({ name: 'Ada', password: 'longenough' })
    expect(result).toEqual({ ok: false, error: 'A valid email is required.' })
  })

  it('rejects a short password', () => {
    const result = validateSignupInput({ name: 'Ada', email: 'a@b.com', password: 'short' })
    expect(result).toEqual({ ok: false, error: 'Password must be at least 8 characters.' })
  })

  it('rejects non-string fields without throwing', () => {
    const result = validateSignupInput({ name: 123, email: { x: 1 }, password: ['a'] })
    expect(result.ok).toBe(false)
  })
})
