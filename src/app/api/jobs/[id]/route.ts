import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { prisma } from '@/lib/prisma'
import { authOptions } from '@/lib/auth'
import { canAccessResource } from '@/lib/ownership'

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    // Independent of each other — run together rather than paying both
    // latencies sequentially on every job fetch.
    const [job, session] = await Promise.all([
      prisma.job.findUnique({
        where: { id: params.id },
        include: {
          nodes: {
            where: { parentId: null },
            take: 1,
          },
        },
      }),
      getServerSession(authOptions),
    ])

    if (!job) {
      return NextResponse.json({ error: 'Job not found' }, { status: 404 })
    }

    // #36/V3.6 phase 4: a no-op for unowned jobs (anonymous/self-hosted
    // usage, unchanged) — only denies access to a job someone else's
    // account actually owns. See lib/ownership.ts.
    if (!canAccessResource(job.userId, session?.user?.id)) {
      return NextResponse.json({ error: 'Not authorized to view this job' }, { status: 403 })
    }

    return NextResponse.json({
      id: job.id,
      topicQuery: job.topicQuery,
      status: job.status,
      createdAt: job.createdAt,
      rootNodeId: job.nodes[0]?.id || null,
      // #36/V3.6 phase 5: lets the UI show a "Claim this research" action
      // only when it's actually meaningful (signed in + currently unowned).
      canClaim: !!session?.user?.id && job.userId === null,
    })
  } catch (error) {
    console.error('Error fetching job:', error)
    return NextResponse.json(
      { error: 'Failed to fetch job' },
      { status: 500 }
    )
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const [job, session] = await Promise.all([
      prisma.job.findUnique({ where: { id: params.id }, select: { userId: true } }),
      getServerSession(authOptions),
    ])
    if (!job) {
      return NextResponse.json({ error: 'Job not found' }, { status: 404 })
    }

    if (!canAccessResource(job.userId, session?.user?.id)) {
      return NextResponse.json({ error: 'Not authorized to delete this job' }, { status: 403 })
    }

    await prisma.job.delete({ where: { id: params.id } })
    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error('Error deleting job:', error)
    return NextResponse.json({ error: 'Failed to delete job' }, { status: 500 })
  }
}
