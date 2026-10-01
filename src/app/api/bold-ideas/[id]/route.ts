// SPDX-License-Identifier: AGPL-3.0-only
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

/** Deletes a bold idea and its underlying Job (same cleanup the regular My Research tab's delete button does for a job). */
export async function DELETE(_request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const idea = await prisma.boldIdea.findUnique({ where: { id: params.id }, select: { jobId: true } })
    if (!idea) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 })
    }
    await prisma.boldIdea.delete({ where: { id: params.id } })
    if (idea.jobId) {
      await prisma.job.delete({ where: { id: idea.jobId } }).catch(() => {
        // Job may already be gone (e.g. deleted separately) — not an error for this request.
      })
    }
    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error('Error deleting bold idea:', error)
    return NextResponse.json({ error: 'Failed to delete' }, { status: 500 })
  }
}
