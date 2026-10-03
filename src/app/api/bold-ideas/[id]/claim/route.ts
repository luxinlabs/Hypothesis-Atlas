// SPDX-License-Identifier: AGPL-3.0-only
import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { prisma } from '@/lib/prisma'
import { authOptions } from '@/lib/auth'

/** Same claim flow as /api/jobs/[id]/claim, for a Bold Idea — see that route for the reasoning (#36/V3.6 phase 5). */
export async function POST(_request: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Sign in to claim this idea.' }, { status: 401 })
  }

  const idea = await prisma.boldIdea.findUnique({ where: { id: params.id }, select: { userId: true } })
  if (!idea) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  if (idea.userId === session.user.id) {
    return NextResponse.json({ ok: true, alreadyOwned: true })
  }
  if (idea.userId) {
    return NextResponse.json({ error: 'This idea is already owned by another account.' }, { status: 409 })
  }

  // Conditional write: only claims if it's still unowned. Two concurrent
  // claims can both pass the findUnique check above; without this guard the
  // second write silently overwrites the first and both report success.
  const result = await prisma.boldIdea.updateMany({
    where: { id: params.id, userId: null },
    data: { userId: session.user.id },
  })
  if (result.count === 0) {
    const now = await prisma.boldIdea.findUnique({ where: { id: params.id }, select: { userId: true } })
    if (now?.userId === session.user.id) return NextResponse.json({ ok: true, alreadyOwned: true })
    return NextResponse.json({ error: 'This idea was just claimed by another account.' }, { status: 409 })
  }
  return NextResponse.json({ ok: true })
}
