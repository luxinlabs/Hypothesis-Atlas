import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { noteLabel, noteMetadata } from '@/lib/notes-server'

interface IncomingNote {
  id?: unknown
  type?: unknown
  title?: unknown
  content?: unknown
}

function isValidNote(n: IncomingNote): n is { id: string; type: string; title?: string; content: string } {
  return (
    typeof n.id === 'string' &&
    n.id.length > 0 &&
    typeof n.content === 'string' &&
    (n.type === 'manual' || n.type === 'comparison' || n.type === 'session' || n.type === 'insight') &&
    (n.title === undefined || typeof n.title === 'string')
  )
}

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const body = await request.json()
    const notes = Array.isArray(body?.notes) ? (body.notes as IncomingNote[]) : []
    const valid = notes.filter(isValidNote)
    if (valid.length === 0) {
      return NextResponse.json({ migrated: 0 })
    }

    const existingIds = new Set(
      (
        await prisma.graphEntity.findMany({
          where: { jobId: params.id, type: 'note' },
          select: { id: true },
        })
      ).map((e) => e.id)
    )

    const topic = await prisma.graphEntity.findFirst({
      where: { jobId: params.id, type: 'topic' },
      orderBy: { createdAt: 'asc' },
    })

    let migrated = 0
    for (const note of valid) {
      if (existingIds.has(note.id)) continue
      const content = note.content.slice(0, 4000)
      const title = note.title?.trim().slice(0, 200) || undefined

      let entity
      try {
        entity = await prisma.graphEntity.create({
          data: {
            id: note.id,
            type: 'note',
            label: noteLabel(title, content),
            content,
            jobId: params.id,
            origin: 'user',
            metadataJson: noteMetadata(note.type, title),
          },
        })
      } catch (err) {
        // Concurrent migration (multiple components/tabs) can race past the existingIds check
        if ((err as { code?: string }).code === 'P2002') continue
        throw err
      }
      if (topic) {
        try {
          await prisma.graphEdge.create({
            data: { fromId: entity.id, toId: topic.id, type: 'notes_on', jobId: params.id, origin: 'user' },
          })
        } catch (err) {
          if ((err as { code?: string }).code !== 'P2002') throw err
        }
      }
      migrated++
    }

    return NextResponse.json({ migrated })
  } catch (error) {
    console.error('Error migrating notes:', error)
    return NextResponse.json({ error: 'Failed to migrate notes' }, { status: 500 })
  }
}
