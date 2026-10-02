// SPDX-License-Identifier: AGPL-3.0-only
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { generateExperiment, type BoldIdeaAgentTrace } from '@/lib/boldIdeaAgents'

/**
 * Second-phase generation for a Bold Idea: designs a concrete experiment
 * for one candidate direction chosen out of the information-finding phase.
 * Persists the result on the idea (one experiment at a time, keyed by
 * which candidate it's for) so the session page's "Experiment" card
 * survives a reload instead of needing to regenerate on every visit.
 */
export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  const { candidateTitle } = (await request.json().catch(() => ({}))) as { candidateTitle?: string }
  if (!candidateTitle) {
    return NextResponse.json({ error: 'candidateTitle is required' }, { status: 400 })
  }

  const idea = await prisma.boldIdea.findUnique({ where: { id: params.id } })
  if (!idea) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const trace: BoldIdeaAgentTrace | null = idea.agentTraceJson ? JSON.parse(idea.agentTraceJson) : null
  const candidate = trace?.candidates.find((c) => c.title === candidateTitle)
  if (!candidate) {
    return NextResponse.json({ error: 'That candidate direction was not found on this idea' }, { status: 404 })
  }

  const experiment = await generateExperiment(idea.text, candidate)

  await prisma.boldIdea.update({
    where: { id: params.id },
    data: { experimentJson: JSON.stringify(experiment) },
  })

  return NextResponse.json({ experiment })
}
