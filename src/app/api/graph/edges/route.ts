import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { isEdgeType } from '@/lib/research-graph'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { fromId, toId, type, jobId } = body ?? {}

    if (!isEdgeType(type)) {
      return NextResponse.json({ error: 'Invalid edge type' }, { status: 400 })
    }
    if (typeof fromId !== 'string' || typeof toId !== 'string' || fromId === toId) {
      return NextResponse.json(
        { error: 'fromId and toId must be different entity ids' },
        { status: 400 }
      )
    }

    const [from, to] = await Promise.all([
      prisma.graphEntity.findUnique({ where: { id: fromId } }),
      prisma.graphEntity.findUnique({ where: { id: toId } }),
    ])
    if (!from || !to) {
      return NextResponse.json({ error: 'One or both entities not found' }, { status: 404 })
    }

    try {
      const edge = await prisma.graphEdge.create({
        data: {
          fromId,
          toId,
          type,
          jobId: typeof jobId === 'string' && jobId ? jobId : null,
          origin: 'user',
        },
      })
      return NextResponse.json({ edge }, { status: 201 })
    } catch (err) {
      if ((err as { code?: string }).code === 'P2002') {
        return NextResponse.json({ error: 'Edge already exists' }, { status: 409 })
      }
      throw err
    }
  } catch (error) {
    console.error('Error creating graph edge:', error)
    return NextResponse.json({ error: 'Failed to create edge' }, { status: 500 })
  }
}
