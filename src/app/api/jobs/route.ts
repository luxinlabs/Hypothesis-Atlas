import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { prisma } from '@/lib/prisma'
import { addEvidenceMappingJob } from '@/lib/queue'
import { authOptions } from '@/lib/auth'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const limit = parseInt(searchParams.get('limit') || '50')
    const offset = parseInt(searchParams.get('offset') || '0')

    const [jobs, total] = await Promise.all([
      prisma.job.findMany({
        orderBy: { createdAt: 'desc' },
        take: limit,
        skip: offset,
        select: {
          id: true,
          topicQuery: true,
          status: true,
          rootNodeId: true,
          createdAt: true,
          updatedAt: true,
          _count: {
            select: {
              sources: true,
              nodes: true,
            },
          },
        },
      }),
      prisma.job.count(),
    ])

    return NextResponse.json({
      jobs,
      total,
      limit,
      offset,
    })
  } catch (error) {
    console.error('Error fetching jobs:', error)
    return NextResponse.json(
      { error: 'Failed to fetch jobs' },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { topicQuery } = body

    if (!topicQuery || typeof topicQuery !== 'string') {
      return NextResponse.json(
        { error: 'topicQuery is required' },
        { status: 400 }
      )
    }

    // #36/V3.6 phase 2: stamp the owner when a session exists. Still fully
    // anonymous-creatable — no auth-required gate (phase 3) and nothing
    // reads this for access control yet (phase 4) — this just records who
    // made it, for whenever ownership enforcement lands.
    const session = await getServerSession(authOptions)

    console.log('Creating job for topic:', topicQuery)
    const job = await prisma.job.create({
      data: {
        topicQuery,
        status: 'pending',
        userId: session?.user?.id ?? null,
      },
    })
    console.log('Job created:', job.id)

    console.log('Adding job to queue...')
    await addEvidenceMappingJob(job.id, topicQuery)
    console.log('Job added to queue')

    return NextResponse.json({ jobId: job.id })
  } catch (error) {
    console.error('Error creating job:', error)
    console.error('Stack:', error instanceof Error ? error.stack : 'No stack')
    return NextResponse.json(
      { error: 'Failed to create job' },
      { status: 500 }
    )
  }
}
