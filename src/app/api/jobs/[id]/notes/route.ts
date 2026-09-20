import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { toNoteEntry, noteLabel, noteMetadata } from '@/lib/notes-server'

export async function GET(
  _request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const entities = await prisma.graphEntity.findMany({
      where: { jobId: params.id, type: 'note' },
      orderBy: { createdAt: 'asc' },
    })
    return NextResponse.json({ notes: entities.map(toNoteEntry) })
  } catch (error) {
    console.error('Error fetching notes:', error)
    return NextResponse.json({ error: 'Failed to fetch notes' }, { status: 500 })
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const body = await request.json()
    const content = typeof body?.content === 'string' ? body.content.trim() : ''
    if (!content) {
      return NextResponse.json({ error: 'Content is required' }, { status: 400 })
    }
    const type =
      body?.type === 'comparison' || body?.type === 'session' || body?.type === 'insight'
        ? body.type
        : 'manual'
    const title =
      typeof body?.title === 'string' && body.title.trim() ? body.title.trim().slice(0, 200) : undefined

    const trimmed = content.slice(0, 4000)
    const entity = await prisma.graphEntity.create({
      data: {
        type: 'note',
        label: noteLabel(title, trimmed),
        content: trimmed,
        jobId: params.id,
        origin: 'user',
        metadataJson: noteMetadata(type, title),
      },
    })

    // Link note to the job's topic entity so it joins the research graph
    const topic = await prisma.graphEntity.findFirst({
      where: { jobId: params.id, type: 'topic' },
      orderBy: { createdAt: 'asc' },
    })
    if (topic) {
      try {
        await prisma.graphEdge.create({
          data: { fromId: entity.id, toId: topic.id, type: 'notes_on', jobId: params.id, origin: 'user' },
        })
      } catch (err) {
        if ((err as { code?: string }).code !== 'P2002') throw err
      }
    }

    return NextResponse.json({ note: toNoteEntry(entity) }, { status: 201 })
  } catch (error) {
    console.error('Error creating note:', error)
    return NextResponse.json({ error: 'Failed to create note' }, { status: 500 })
  }
}
