import { describe, it, expect } from 'vitest'
import { canAccessResource } from './ownership'

describe('canAccessResource', () => {
  it('allows anyone when the resource has no owner', () => {
    expect(canAccessResource(null, null)).toBe(true)
    expect(canAccessResource(null, undefined)).toBe(true)
    expect(canAccessResource(null, 'user-1')).toBe(true)
  })

  it('allows the owner', () => {
    expect(canAccessResource('user-1', 'user-1')).toBe(true)
  })

  it('denies a different signed-in user', () => {
    expect(canAccessResource('user-1', 'user-2')).toBe(false)
  })

  it('denies an anonymous request for an owned resource', () => {
    expect(canAccessResource('user-1', null)).toBe(false)
    expect(canAccessResource('user-1', undefined)).toBe(false)
  })
})
