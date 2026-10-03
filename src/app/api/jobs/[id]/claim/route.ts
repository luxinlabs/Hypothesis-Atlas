// SPDX-License-Identifier: AGPL-3.0-only
import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { prisma } from '@/lib/prisma'
import { authOptions } from '@/lib/auth'

/**
 * #36/V3.6 phase 5: claims an anonymous (unowned) job for the signed-in
 * user. This is the "one-time claim flow keyed by something the original
 * creator still has" the issue describes — the thing they still have is
 * simply the job's id/URL, which (per the existing self-hosted/anonymous
 * model) is already the only credential this app has ever used to access a
 * job. Idempotent for the current owner; refuses to steal a job someone
 * else's account already owns.
 */
export async function POST(_request: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Sign in to claim this research.' }, { status: 401 })
  }

  const job = await prisma.job.findUnique({ where: { id: params.id }, select: { userId: true } })
  if (!job) {
    return NextResponse.json({ error: 'Job not found' }, { status: 404 })
  }

  if (job.userId === session.user.id) {
    return NextResponse.json({ ok: true, alreadyOwned: true })
  }
  if (job.userId) {
    return NextResponse.json({ error: 'This research is already owned by another account.' }, { status: 409 })
  }

  // Conditional write: only claims if it's still unowned. Two concurrent
  // claims can both pass the findUnique check above; without this guard the
  // second write silently overwrites the first and both report success.
  const result = await prisma.job.updateMany({
    where: { id: params.id, userId: null },
    data: { userId: session.user.id },
  })
  if (result.count === 0) {
    const now = await prisma.job.findUnique({ where: { id: params.id }, select: { userId: true } })
    if (now?.userId === session.user.id) return NextResponse.json({ ok: true, alreadyOwned: true })
    return NextResponse.json({ error: 'This research was just claimed by another account.' }, { status: 409 })
  }
  return NextResponse.json({ ok: true })
}
