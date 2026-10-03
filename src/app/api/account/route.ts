// SPDX-License-Identifier: AGPL-3.0-only
import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { prisma } from '@/lib/prisma'
import { authOptions } from '@/lib/auth'

/**
 * #43/V3.2: what a real account holds and shows about its user — profile
 * fields, plan tier, and real (not fabricated) usage counts derived from
 * the Job/BoldIdea rows #36 already gave a userId. No billing integration
 * exists, so `planTier` is read verbatim from the User row rather than
 * computed from anything — see the schema comment on User.planTier.
 */
export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Sign in to view your account.' }, { status: 401 })
  }

  const [user, jobCount, boldIdeaCount] = await Promise.all([
    prisma.user.findUnique({
      where: { id: session.user.id },
      select: { id: true, name: true, email: true, image: true, planTier: true, createdAt: true },
    }),
    prisma.job.count({ where: { userId: session.user.id } }),
    prisma.boldIdea.count({ where: { userId: session.user.id } }),
  ])

  if (!user) {
    return NextResponse.json({ error: 'Account not found.' }, { status: 404 })
  }

  return NextResponse.json({
    ...user,
    usage: { jobs: jobCount, boldIdeas: boldIdeaCount },
  })
}

/** Updates the signed-in user's display name — the only editable profile field for now (email changes aren't supported, since it's also the Credentials-provider login identifier). */
export async function PATCH(request: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Sign in to update your account.' }, { status: 401 })
  }

  const body = await request.json().catch(() => ({}))
  const name = typeof body.name === 'string' ? body.name.trim() : ''
  if (!name) {
    return NextResponse.json({ error: 'Name is required.' }, { status: 400 })
  }

  const user = await prisma.user.update({
    where: { id: session.user.id },
    data: { name },
    select: { id: true, name: true, email: true, image: true, planTier: true, createdAt: true },
  })

  return NextResponse.json(user)
}
