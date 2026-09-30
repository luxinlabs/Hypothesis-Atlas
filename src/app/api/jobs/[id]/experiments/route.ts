import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { serializeExperiment } from '@/lib/experiments/store'
import { EXPERIMENT_DOMAINS, type ExperimentDomain, type ExperimentResult } from '@/lib/experiments/types'

const VALID_DOMAINS = new Set(EXPERIMENT_DOMAINS.map((d) => d.id))

/** Lists claims for a job, optionally scoped to a domain and/or a single session. */
export async function GET(request: NextRequest, { params }: { params: { id: string } }) {
  const domain = request.nextUrl.searchParams.get('domain')
  const sessionId = request.nextUrl.searchParams.get('sessionId')
  if (domain && !VALID_DOMAINS.has(domain as ExperimentDomain)) {
    return NextResponse.json({ error: `Unknown domain: ${domain}` }, { status: 400 })
  }

  const rows = await prisma.experiment.findMany({
    where: { jobId: params.id, ...(domain ? { domain } : {}), ...(sessionId ? { sessionId } : {}) },
    orderBy: { createdAt: 'desc' },
  })
  return NextResponse.json({ experiments: rows.map(serializeExperiment) })
}

/**
 * Creates a new claim inside an existing session. The claim's domain is
 * always derived from its session, never taken from the request body — this
 * is what makes cross-domain mixing structurally impossible rather than
 * merely discouraged (see the schema comment on ExperimentSession).
 *
 * jobId is not validated against the Job table — see the schema comment on
 * Experiment.jobId — the standalone /experiments page uses a fixed
 * pseudo-session id with no backing Job row.
 */
export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  const body = (await request.json().catch(() => ({}))) as {
    sessionId?: string
    claim?: string
    status?: string
    result?: ExperimentResult
  }
  const { sessionId, claim, status, result } = body
  if (!sessionId) {
    return NextResponse.json({ error: 'No sessionId provided' }, { status: 400 })
  }
  if (!claim || !claim.trim()) {
    return NextResponse.json({ error: 'No claim provided' }, { status: 400 })
  }

  const session = await prisma.experimentSession.findFirst({
    where: { id: sessionId, jobId: params.id },
  })
  if (!session) {
    return NextResponse.json({ error: 'Session not found' }, { status: 404 })
  }

  const row = await prisma.experiment.create({
    data: {
      jobId: params.id,
      sessionId,
      domain: session.domain,
      claim: claim.trim(),
      status: status ?? 'draft',
      resultJson: result ? JSON.stringify(result) : null,
    },
  })
  return NextResponse.json({ experiment: serializeExperiment(row) }, { status: 201 })
}
