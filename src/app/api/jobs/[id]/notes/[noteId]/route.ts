import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { toNoteEntry, parseNoteMetadata, noteLabel } from '@/lib/notes-server'

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string; noteId: string } }
) {
  try {
    const body = await request.json()
    const existing = await prisma.graphEntity.findFirst({
      where: { id: params.noteId, jobId: params.id, type: 'note' },
    })
    if (!existing) {
      return NextResponse.json({ error: 'Note not found' }, { status: 404 })
    }

    const meta = parseNoteMetadata(existing.metadataJson)

    if (body?.type !== undefined) {
      if (
        body.type !== 'manual' &&
        body.type !== 'comparison' &&
        body.type !== 'session' &&
        body.type !== 'insight'
      ) {
        return NextResponse.json({ error: 'Invalid note type' }, { status: 400 })
      }
      meta.noteType = body.type
    }
    if (body?.title !== undefined) {
      meta.title =
        typeof body.title === 'string' && body.title.trim() ? body.title.trim().slice(0, 200) : undefined
    }

    const content =
      body?.content !== undefined
        ? typeof body.content === 'string' && body.content.trim()
          ? body.content.trim().slice(0, 4000)
          : existing.content ?? existing.label
        : existing.content ?? existing.label

    const title = meta.title
    const entity = await prisma.graphEntity.update({
      where: { id: existing.id },
      data: {
        label: noteLabel(title, content),
        content,
        metadataJson: JSON.stringify(meta),
      },
    })
    return NextResponse.json({ note: toNoteEntry(entity) })
  } catch (error) {
    console.error('Error updating note:', error)
    return NextResponse.json({ error: 'Failed to update note' }, { status: 500 })
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: { id: string; noteId: string } }
) {
  try {
    const existing = await prisma.graphEntity.findFirst({
      where: { id: params.noteId, jobId: params.id, type: 'note' },
    })
    if (!existing) {
      return NextResponse.json({ error: 'Note not found' }, { status: 404 })
    }

    await prisma.graphEntity.delete({ where: { id: existing.id } })
    return NextResponse.json({ deleted: true })
  } catch (error) {
    console.error('Error deleting note:', error)
    return NextResponse.json({ error: 'Failed to delete note' }, { status: 500 })
  }
}
