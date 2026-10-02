// SPDX-License-Identifier: AGPL-3.0-only
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import type { Highlight } from '@/lib/boldIdeaKnowledge'

/** Removes one saved highlight from a bold idea's knowledge list. */
export async function DELETE(_request: NextRequest, { params }: { params: { id: string; highlightId: string } }) {
  const idea = await prisma.boldIdea.findUnique({ where: { id: params.id }, select: { knowledgeJson: true } })
  if (!idea) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const highlights: Highlight[] = idea.knowledgeJson ? JSON.parse(idea.knowledgeJson) : []
  const filtered = highlights.filter((h) => h.id !== params.highlightId)

  await prisma.boldIdea.update({
    where: { id: params.id },
    data: { knowledgeJson: JSON.stringify(filtered) },
  })

  return NextResponse.json({ highlights: filtered })
}
