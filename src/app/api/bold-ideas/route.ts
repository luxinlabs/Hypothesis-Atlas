// SPDX-License-Identifier: AGPL-3.0-only
import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { prisma } from '@/lib/prisma'
import { tagSubjects } from '@/lib/boldIdea'
import { runBoldIdeaAgents } from '@/lib/boldIdeaAgents'
import { authOptions } from '@/lib/auth'
import { isAuthRequired } from '@/lib/authConfig'

// POST chains tag -> explore -> ground -> (critique + analyze) across Groq,
// Anthropic, OpenAlex, and PubMed — longer than the 60s sibling routes
// (jobs/upload, paper-review) use for a single call.
export const maxDuration = 120

/** Lists bold ideas for the "Bold Idea" tab on My Research, newest first. No per-paper detail here — that's fetched per-idea on its session page. */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const limit = parseInt(searchParams.get('limit') || '50')

  const ideas = await prisma.boldIdea.findMany({
    orderBy: { createdAt: 'desc' },
    take: limit,
  })

  return NextResponse.json({
    ideas: ideas.map((idea) => ({
      id: idea.id,
      text: idea.text,
      tags: JSON.parse(idea.tagsJson) as string[],
      createdAt: idea.createdAt,
      hasTrace: !!idea.agentTraceJson,
    })),
  })
}

/**
 * "Try Something Bold": takes unconstrained free text, tags it (see
 * lib/boldIdea.ts), then runs the multi-agent exploration/verification
 * pipeline (lib/boldIdeaAgents.ts) — Explorer, Literature Agent, Critic,
 * Paper Analyzer — synchronously, so the response already carries the full
 * result. No evidence-mapping Job is created: a bold idea is its own
 * lightweight result (candidate directions + papers + a summary/gaps/
 * next-steps synthesis), not a Knowledge Tree pipeline run.
 */
export async function POST(request: NextRequest) {
  const { text } = (await request.json().catch(() => ({}))) as { text?: string }
  if (!text || !text.trim()) {
    return NextResponse.json({ error: 'No idea text provided' }, { status: 400 })
  }

  const trimmed = text.trim()
  try {
    // #36/V3.6 phase 2/3: same treatment as /api/jobs — stamp the owner,
    // require one only when this deployment opts in (REQUIRE_AUTH=true).
    const session = await getServerSession(authOptions)
    if (isAuthRequired() && !session?.user?.id) {
      return NextResponse.json({ error: 'Sign in to explore a bold idea.' }, { status: 401 })
    }
    const tags = await tagSubjects(trimmed)
    const trace = await runBoldIdeaAgents(trimmed, tags)

    const idea = await prisma.boldIdea.create({
      data: {
        text: trimmed,
        tagsJson: JSON.stringify(tags),
        agentTraceJson: JSON.stringify(trace),
        userId: session?.user?.id ?? null,
      },
    })

    return NextResponse.json({ ideaId: idea.id, tags, trace }, { status: 201 })
  } catch (error) {
    console.error('Error creating bold idea:', error)
    return NextResponse.json({ error: 'Failed to explore this idea' }, { status: 500 })
  }
}
