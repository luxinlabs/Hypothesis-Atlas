import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { isAuthRequired } from './authConfig'

describe('isAuthRequired', () => {
  const original = process.env.REQUIRE_AUTH

  afterEach(() => {
    process.env.REQUIRE_AUTH = original
  })

  it('defaults to false when unset (self-hosted)', () => {
    delete process.env.REQUIRE_AUTH
    expect(isAuthRequired()).toBe(false)
  })

  it('is true only for the exact string "true" (the hosted deployment opts in)', () => {
    process.env.REQUIRE_AUTH = 'true'
    expect(isAuthRequired()).toBe(true)
  })

  it('treats any other value as false', () => {
    process.env.REQUIRE_AUTH = '1'
    expect(isAuthRequired()).toBe(false)
    process.env.REQUIRE_AUTH = 'false'
    expect(isAuthRequired()).toBe(false)
  })
})
