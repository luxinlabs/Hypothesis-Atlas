import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { toNoteEntry, noteLabel, noteMetadata } from '@/lib/notes-server'

interface IncomingNote {
  id?: unknown
  type?: unknown
  title?: unknown
  content?: unknown
}

function isValidNote(n: IncomingNote): n is { id: string; type: string; title?: string; content: string } {
  return (
    typeof n.id === 'string' &&
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

    const existing = await prisma.graphEntity.findMany({
      where: { jobId: params.id, type: 'note' },
      orderBy: { createdAt: 'asc' },
    })
    const keepIds = new Set(valid.filter((n) => typeof n.id === 'string').map((n) => n.id as string))

    for (const e of existing) {
      if (!keepIds.has(e.id)) {
        await prisma.graphEntity.delete({ where: { id: e.id } })
      }
    }

    const topic = await prisma.graphEntity.findFirst({
      where: { jobId: params.id, type: 'topic' },
      orderBy: { createdAt: 'asc' },
    })

    const result: ReturnType<typeof toNoteEntry>[] = []
    for (const note of valid) {
      const content = note.content.slice(0, 4000)
      const title = note.title?.trim().slice(0, 200) || undefined
      const label = noteLabel(title, content)
      const metadataJson = noteMetadata(note.type, title)

      const entity = await prisma.graphEntity.upsert({
        where: { id: note.id },
        update: { label, content, metadataJson },
        create: {
          id: note.id,
          type: 'note',
          label,
          content,
          jobId: params.id,
          origin: 'user',
          metadataJson,
        },
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

      result.push(toNoteEntry(entity))
    }

    return NextResponse.json({ notes: result })
  } catch (error) {
    console.error('Error replacing notes:', error)
    return NextResponse.json({ error: 'Failed to replace notes' }, { status: 500 })
  }
}
