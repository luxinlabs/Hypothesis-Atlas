// SPDX-License-Identifier: AGPL-3.0-only
import { randomUUID } from 'crypto'
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import type { Highlight } from '@/lib/boldIdeaKnowledge'

function readHighlights(knowledgeJson: string | null): Highlight[] {
  return knowledgeJson ? (JSON.parse(knowledgeJson) as Highlight[]) : []
}

/** Saves a chat snippet the researcher highlighted and chose to keep as knowledge — see Highlight in lib/boldIdeaKnowledge.ts for why this is a flat JSON list rather than the graph-backed notes the regular Job pipeline uses. */
export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  const { text } = (await request.json().catch(() => ({}))) as { text?: string }
  const trimmed = text?.trim()
  if (!trimmed) {
    return NextResponse.json({ error: 'text is required' }, { status: 400 })
  }

  const idea = await prisma.boldIdea.findUnique({ where: { id: params.id }, select: { knowledgeJson: true } })
  if (!idea) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const highlight: Highlight = { id: randomUUID(), text: trimmed.slice(0, 2000), createdAt: new Date().toISOString() }
  const highlights = [...readHighlights(idea.knowledgeJson), highlight]

  await prisma.boldIdea.update({
    where: { id: params.id },
    data: { knowledgeJson: JSON.stringify(highlights) },
  })

  return NextResponse.json({ highlight, highlights }, { status: 201 })
}
