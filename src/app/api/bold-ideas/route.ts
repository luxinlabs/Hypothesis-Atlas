// SPDX-License-Identifier: AGPL-3.0-only
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { addEvidenceMappingJob } from '@/lib/queue'
import { analyzeBoldIdea } from '@/lib/boldIdea'

/** Lists bold ideas for the "Bold Idea" tab on My Research, newest first, joined with their Job's current status/counts. */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const limit = parseInt(searchParams.get('limit') || '50')

  const ideas = await prisma.boldIdea.findMany({
    orderBy: { createdAt: 'desc' },
    take: limit,
  })

  const jobIds = ideas.map((i) => i.jobId).filter((id): id is string => !!id)
  const jobs = jobIds.length
    ? await prisma.job.findMany({
        where: { id: { in: jobIds } },
        select: { id: true, status: true, _count: { select: { sources: true, nodes: true } } },
      })
    : []
  const jobById = new Map(jobs.map((j) => [j.id, j]))

  return NextResponse.json({
    ideas: ideas.map((idea) => ({
      id: idea.id,
      text: idea.text,
      tags: JSON.parse(idea.tagsJson) as string[],
      jobId: idea.jobId,
      createdAt: idea.createdAt,
      job: idea.jobId ? jobById.get(idea.jobId) ?? null : null,
    })),
  })
}

/**
 * "Try Something Bold": takes unconstrained free text, tags it and refines
 * it into a topicQuery (see lib/boldIdea.ts), then feeds that straight into
 * the *same* evidence-mapping pipeline the word-cloud flow uses
 * (addEvidenceMappingJob) — this route adds a categorization step on top,
 * it does not duplicate the pipeline itself.
 */
export async function POST(request: NextRequest) {
  const { text } = (await request.json().catch(() => ({}))) as { text?: string }
  if (!text || !text.trim()) {
    return NextResponse.json({ error: 'No idea text provided' }, { status: 400 })
  }

  const trimmed = text.trim()
  const { tags, topicQuery } = await analyzeBoldIdea(trimmed)

  const job = await prisma.job.create({
    data: { topicQuery, status: 'pending' },
  })
  await addEvidenceMappingJob(job.id, topicQuery)

  const idea = await prisma.boldIdea.create({
    data: { text: trimmed, tagsJson: JSON.stringify(tags), jobId: job.id },
  })

  return NextResponse.json({ ideaId: idea.id, jobId: job.id, tags, topicQuery }, { status: 201 })
}
