// SPDX-License-Identifier: AGPL-3.0-only
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { serializeSession } from '@/lib/experiments/store'
import { EXPERIMENT_DOMAINS, type ExperimentDomain } from '@/lib/experiments/types'

const VALID_DOMAINS = new Set(EXPERIMENT_DOMAINS.map((d) => d.id))

/** Lists sessions for a job, optionally scoped to one domain — the session picker's data source. */
export async function GET(request: NextRequest, { params }: { params: { id: string } }) {
  const domain = request.nextUrl.searchParams.get('domain')
  if (domain && !VALID_DOMAINS.has(domain as ExperimentDomain)) {
    return NextResponse.json({ error: `Unknown domain: ${domain}` }, { status: 400 })
  }

  const rows = await prisma.experimentSession.findMany({
    where: { jobId: params.id, ...(domain ? { domain } : {}) },
    orderBy: { updatedAt: 'desc' },
  })
  return NextResponse.json({ sessions: rows.map(serializeSession) })
}

/**
 * Creates a new session, scoped to one domain for its whole lifetime — see
 * the schema comment on ExperimentSession for why this replaced the earlier
 * groupId-based cross-domain linking.
 */
export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  const body = (await request.json().catch(() => ({}))) as { domain?: string; title?: string }
  const { domain, title } = body
  if (!domain || !VALID_DOMAINS.has(domain as ExperimentDomain)) {
    return NextResponse.json({ error: `Unknown or missing domain: ${domain}` }, { status: 400 })
  }

  const row = await prisma.experimentSession.create({
    data: { jobId: params.id, domain, title: title?.trim() || null },
  })
  return NextResponse.json({ session: serializeSession(row) }, { status: 201 })
}
