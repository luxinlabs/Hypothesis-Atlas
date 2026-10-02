// SPDX-License-Identifier: AGPL-3.0-only
import { NextRequest, NextResponse } from 'next/server'
import { Prisma } from '@prisma/client'
import bcrypt from 'bcryptjs'
import { prisma } from '@/lib/prisma'
import { validateSignupInput } from '@/lib/authValidation'

const BCRYPT_ROUNDS = 12

/**
 * Creates a real User row with a bcrypt-hashed password — the actual
 * replacement for AuthModal.tsx's fake `setTimeout` signup. Separate from
 * NextAuth's own route: NextAuth's Credentials provider only authenticates
 * existing users (its `authorize()` is a login check, not an account
 * creation path), so account creation needs its own endpoint regardless of
 * which auth library is used.
 */
export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => ({}))
  const result = validateSignupInput(body)
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: 400 })
  }
  const { name, email, password } = result.data

  // This existence check is an early-exit for the common case, not the real
  // guard — two concurrent signups for the same email can both pass it
  // before either creates a row (TOCTOU). The unique constraint on
  // User.email is the actual guard; the catch below turns its violation
  // into the same 409 instead of a confusing generic 500.
  const existing = await prisma.user.findUnique({ where: { email } })
  if (existing) {
    return NextResponse.json({ error: 'An account with this email already exists.' }, { status: 409 })
  }

  try {
    const passwordHash = await bcrypt.hash(password, BCRYPT_ROUNDS)
    const user = await prisma.user.create({
      data: { name, email, passwordHash },
      select: { id: true, name: true, email: true },
    })
    return NextResponse.json({ user }, { status: 201 })
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
      return NextResponse.json({ error: 'An account with this email already exists.' }, { status: 409 })
    }
    console.error('Error creating user:', error)
    return NextResponse.json({ error: 'Failed to create account' }, { status: 500 })
  }
}
