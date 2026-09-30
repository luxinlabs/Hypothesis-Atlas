// SPDX-License-Identifier: AGPL-3.0-only
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { serializeExperiment } from '@/lib/experiments/store'
import type { ExperimentResult } from '@/lib/experiments/types'

/** Updates a session's claim, status, and/or verification result. Partial — omitted fields are left as-is. */
export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string; experimentId: string } }
) {
  const existing = await prisma.experiment.findFirst({
    where: { id: params.experimentId, jobId: params.id },
  })
  if (!existing) {
    return NextResponse.json({ error: 'Experiment not found' }, { status: 404 })
  }

  const body = (await request.json().catch(() => ({}))) as {
    claim?: string
    status?: string
    result?: ExperimentResult | null
  }

  const row = await prisma.experiment.update({
    where: { id: params.experimentId },
    data: {
      ...(body.claim !== undefined ? { claim: body.claim } : {}),
      ...(body.status !== undefined ? { status: body.status } : {}),
      ...(body.result !== undefined ? { resultJson: body.result ? JSON.stringify(body.result) : null } : {}),
    },
  })
  return NextResponse.json({ experiment: serializeExperiment(row) })
}

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
  await prisma.experiment.delete({ where: { id: params.experimentId } })
  return NextResponse.json({ ok: true })
}
