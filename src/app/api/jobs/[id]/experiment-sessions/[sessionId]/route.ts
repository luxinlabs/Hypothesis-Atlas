import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { serializeSession } from '@/lib/experiments/store'

/** Renames a session. Domain is immutable — a session can't change what it's checking mid-conversation. */
export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string; sessionId: string } }
) {
  const existing = await prisma.experimentSession.findFirst({
    where: { id: params.sessionId, jobId: params.id },
  })
  if (!existing) {
    return NextResponse.json({ error: 'Session not found' }, { status: 404 })
  }

  const { title } = (await request.json().catch(() => ({}))) as { title?: string }
  const row = await prisma.experimentSession.update({
    where: { id: params.sessionId },
    data: { title: title?.trim() || null },
  })
  return NextResponse.json({ session: serializeSession(row) })
}

/** Deletes a session and every claim in it. */
export async function DELETE(
  _request: NextRequest,
  { params }: { params: { id: string; sessionId: string } }
) {
  const existing = await prisma.experimentSession.findFirst({
    where: { id: params.sessionId, jobId: params.id },
  })
  if (!existing) {
    return NextResponse.json({ error: 'Session not found' }, { status: 404 })
  }

  // Not an enforced Prisma relation (sessionId is provenance-style, like
  // jobId elsewhere in this module — see the schema comment), so the
  // cascade is done explicitly here rather than left to the database.
  await prisma.experiment.deleteMany({ where: { sessionId: params.sessionId, jobId: params.id } })
  await prisma.experimentSession.delete({ where: { id: params.sessionId } })
  return NextResponse.json({ ok: true })
}
