import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { serializeExperiment } from '@/lib/experiments/store'

/**
 * Links two experiment sessions into one group so they can be browsed
 * together (see the Experiments sidebar). A session can only belong to one
 * group at a time — linking merges groups rather than creating overlapping
 * ones:
 *   - neither has a group  -> mint a new groupId, assign to both
 *   - one has a group      -> the other joins it
 *   - both have (different) groups -> every session in target's group is
 *     moved into source's group (a merge, not a nested structure)
 */
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string; experimentId: string } }
) {
  const { targetId } = (await request.json().catch(() => ({}))) as { targetId?: string }
  if (!targetId) {
    return NextResponse.json({ error: 'No targetId provided' }, { status: 400 })
  }
  if (targetId === params.experimentId) {
    return NextResponse.json({ error: 'Cannot link a session to itself' }, { status: 400 })
  }

  const [source, target] = await Promise.all([
    prisma.experiment.findFirst({ where: { id: params.experimentId, jobId: params.id } }),
    prisma.experiment.findFirst({ where: { id: targetId, jobId: params.id } }),
  ])
  if (!source || !target) {
    return NextResponse.json({ error: 'Experiment not found' }, { status: 404 })
  }

  const groupId = source.groupId ?? target.groupId ?? crypto.randomUUID()

  if (source.groupId && target.groupId && source.groupId !== target.groupId) {
    // Merge: move every member of target's group into source's group.
    await prisma.experiment.updateMany({
      where: { jobId: params.id, groupId: target.groupId },
      data: { groupId: source.groupId },
    })
  } else {
    await prisma.experiment.updateMany({
      where: { id: { in: [source.id, target.id] } },
      data: { groupId },
    })
  }

  const group = await prisma.experiment.findMany({
    where: { jobId: params.id, groupId: source.groupId ?? groupId },
    orderBy: { createdAt: 'asc' },
  })
  return NextResponse.json({ experiments: group.map(serializeExperiment) })
}

/** Unlinks a session from its group, leaving the rest of the group intact. */
export async function DELETE(
  _request: NextRequest,
  { params }: { params: { id: string; experimentId: string } }
) {
  const existing = await prisma.experiment.findFirst({
    where: { id: params.experimentId, jobId: params.id },
  })
  if (!existing) {
    return NextResponse.json({ error: 'Experiment not found' }, { status: 404 })
  }
  const row = await prisma.experiment.update({
    where: { id: params.experimentId },
    data: { groupId: null },
  })

  // A "group" of one leftover session isn't a link anymore — dissolve it too.
  if (existing.groupId) {
    const remaining = await prisma.experiment.findMany({ where: { jobId: params.id, groupId: existing.groupId } })
    if (remaining.length === 1) {
      await prisma.experiment.update({ where: { id: remaining[0].id }, data: { groupId: null } })
    }
  }

  return NextResponse.json({ experiment: serializeExperiment(row) })
}
