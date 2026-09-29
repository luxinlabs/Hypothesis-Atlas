import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { serializeExperiment } from '@/lib/experiments/store'

/** Fetches every session in a linked group, in one call, for the sidebar. */
export async function GET(
  _request: NextRequest,
  { params }: { params: { id: string; groupId: string } }
) {
  const rows = await prisma.experiment.findMany({
    where: { jobId: params.id, groupId: params.groupId },
    orderBy: { createdAt: 'asc' },
  })
  return NextResponse.json({ experiments: rows.map(serializeExperiment) })
}
