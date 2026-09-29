import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { serializeExperiment } from '@/lib/experiments/store'
import { EXPERIMENT_DOMAINS, type ExperimentDomain, type ExperimentResult } from '@/lib/experiments/types'

const VALID_DOMAINS = new Set(EXPERIMENT_DOMAINS.map((d) => d.id))

/** Lists all Experiment sessions for a job, optionally scoped to one domain. */
export async function GET(request: NextRequest, { params }: { params: { id: string } }) {
  const domain = request.nextUrl.searchParams.get('domain')
  if (domain && !VALID_DOMAINS.has(domain as ExperimentDomain)) {
    return NextResponse.json({ error: `Unknown domain: ${domain}` }, { status: 400 })
  }

  const rows = await prisma.experiment.findMany({
    where: { jobId: params.id, ...(domain ? { domain } : {}) },
    orderBy: { createdAt: 'desc' },
  })
  return NextResponse.json({ experiments: rows.map(serializeExperiment) })
}

/**
 * Creates a new Experiment session. Sessions start unlinked (groupId: null).
 * jobId is not validated against the Job table — see the schema comment on
 * Experiment.jobId — the standalone /experiments page uses a fixed
 * pseudo-session id with no backing Job row.
 */
export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  const body = (await request.json().catch(() => ({}))) as {
    domain?: string
    claim?: string
    status?: string
    result?: ExperimentResult
  }
  const { domain, claim, status, result } = body
  if (!domain || !VALID_DOMAINS.has(domain as ExperimentDomain)) {
    return NextResponse.json({ error: `Unknown or missing domain: ${domain}` }, { status: 400 })
  }
  if (!claim || !claim.trim()) {
    return NextResponse.json({ error: 'No claim provided' }, { status: 400 })
  }

  const row = await prisma.experiment.create({
    data: {
      jobId: params.id,
      domain,
      claim: claim.trim(),
      status: status ?? 'draft',
      resultJson: result ? JSON.stringify(result) : null,
    },
  })
  return NextResponse.json({ experiment: serializeExperiment(row) }, { status: 201 })
}
