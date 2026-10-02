// SPDX-License-Identifier: AGPL-3.0-only
import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { prisma } from '@/lib/prisma'
import { authOptions } from '@/lib/auth'
import { canAccessResource } from '@/lib/ownership'
import type { BoldIdeaAgentTrace, ExperimentDesign } from '@/lib/boldIdeaAgents'
import type { Highlight } from '@/lib/boldIdeaKnowledge'

/** Fetches one bold idea with its full multi-agent trace (information-finding phase), its experiment design (second phase) once generated, and any saved knowledge highlights — used once by the session page on load. */
export async function GET(_request: NextRequest, { params }: { params: { id: string } }) {
  const idea = await prisma.boldIdea.findUnique({ where: { id: params.id } })
  if (!idea) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  // #36/V3.6 phase 4 — same rule as jobs/[id]: no-op for unowned ideas.
  const session = await getServerSession(authOptions)
  if (!canAccessResource(idea.userId, session?.user?.id)) {
    return NextResponse.json({ error: 'Not authorized to view this idea' }, { status: 403 })
  }

  return NextResponse.json({
    id: idea.id,
    text: idea.text,
    tags: JSON.parse(idea.tagsJson) as string[],
    createdAt: idea.createdAt,
    trace: idea.agentTraceJson ? (JSON.parse(idea.agentTraceJson) as BoldIdeaAgentTrace) : null,
    experiment: idea.experimentJson ? (JSON.parse(idea.experimentJson) as ExperimentDesign) : null,
    knowledge: idea.knowledgeJson ? (JSON.parse(idea.knowledgeJson) as Highlight[]) : [],
    // #36/V3.6 phase 5: see jobs/[id]/route.ts's canClaim for the reasoning.
    canClaim: !!session?.user?.id && idea.userId === null,
  })
}

/**
 * Deletes a bold idea. Also cleans up its Job if one exists — only
 * relevant for ideas created before this pipeline stopped creating an
 * evidence-mapping Job per idea; new ideas have no jobId.
 */
export async function DELETE(_request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const idea = await prisma.boldIdea.findUnique({ where: { id: params.id }, select: { jobId: true, userId: true } })
    if (!idea) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 })
    }

    const session = await getServerSession(authOptions)
    if (!canAccessResource(idea.userId, session?.user?.id)) {
      return NextResponse.json({ error: 'Not authorized to delete this idea' }, { status: 403 })
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
