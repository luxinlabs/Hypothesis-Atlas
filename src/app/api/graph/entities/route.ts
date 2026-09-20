import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { isEntityType, isEdgeType } from '@/lib/research-graph'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { type, label, content, jobId, connectTo, edgeType } = body ?? {}

    if (!isEntityType(type)) {
      return NextResponse.json({ error: 'Invalid entity type' }, { status: 400 })
    }

    const trimmedLabel = typeof label === 'string' ? label.trim().slice(0, 200) : ''
    if (!trimmedLabel) {
      return NextResponse.json({ error: 'Label is required' }, { status: 400 })
    }

    const trimmedContent =
      typeof content === 'string' && content.trim() ? content.trim().slice(0, 4000) : null

    const entity = await prisma.graphEntity.create({
      data: {
        type,
        label: trimmedLabel,
        content: trimmedContent,
        jobId: typeof jobId === 'string' && jobId ? jobId : null,
        origin: 'user',
      },
    })

    if (connectTo && isEdgeType(edgeType)) {
      const target = await prisma.graphEntity.findUnique({ where: { id: connectTo } })
      if (target && target.id !== entity.id) {
        try {
          await prisma.graphEdge.create({
            data: {
              fromId: entity.id,
              toId: target.id,
              type: edgeType,
              origin: 'user',
            },
          })
        } catch (err) {
          if ((err as { code?: string }).code !== 'P2002') throw err
        }
      }
    }

    return NextResponse.json({ entity }, { status: 201 })
  } catch (error) {
    console.error('Error creating graph entity:', error)
    return NextResponse.json({ error: 'Failed to create entity' }, { status: 500 })
  }
}
