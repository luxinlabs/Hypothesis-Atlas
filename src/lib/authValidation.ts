// SPDX-License-Identifier: AGPL-3.0-only

/** Pulled out of the signup route as a pure function so it's unit-testable without hitting Prisma/bcrypt. */
export interface SignupInput {
  name?: unknown
  email?: unknown
  password?: unknown
}

export interface ValidatedSignup {
  name: string
  email: string
  password: string
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
export const MIN_PASSWORD_LENGTH = 8

export function validateSignupInput(input: SignupInput): { ok: true; data: ValidatedSignup } | { ok: false; error: string } {
  const name = typeof input.name === 'string' ? input.name.trim() : ''
  const email = typeof input.email === 'string' ? input.email.trim().toLowerCase() : ''
  const password = typeof input.password === 'string' ? input.password : ''

  if (!name) return { ok: false, error: 'Name is required.' }
  if (!email || !EMAIL_RE.test(email)) return { ok: false, error: 'A valid email is required.' }
  if (password.length < MIN_PASSWORD_LENGTH) {
    return { ok: false, error: `Password must be at least ${MIN_PASSWORD_LENGTH} characters.` }
  }

  return { ok: true, data: { name, email, password } }
}
