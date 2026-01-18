import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET(
  request: NextRequest,
  { params }: { params: { nodeId: string } }
) {
  try {
    const node = await prisma.node.findUnique({
      where: { id: params.nodeId },
      include: {
        children: {
          include: {
            children: {
              orderBy: { createdAt: 'asc' },
            },
          },
          orderBy: { createdAt: 'asc' },
        },
        nodeSources: {
          include: {
            source: true,
          },
          orderBy: { createdAt: 'asc' },
        },
      },
    })

    if (!node) {
      return NextResponse.json({ error: 'Node not found' }, { status: 404 })
    }

    const methods = node.methodsJson ? JSON.parse(node.methodsJson) : []
    const findings = node.findingsJson ? JSON.parse(node.findingsJson) : []
    const disagreements = node.disagreementsJson ? JSON.parse(node.disagreementsJson) : []
    const openProblems = node.openProblemsJson ? JSON.parse(node.openProblemsJson) : []

    const sources = node.nodeSources.map((ns: any) => ({
      ...ns.source,
      role: ns.role,
      authors: ns.source.authorsJson ? JSON.parse(ns.source.authorsJson) : [],
    }))

    return NextResponse.json({
      id: node.id,
      label: node.label,
      summary: node.summary,
      methods,
      findings,
      disagreements,
      openProblems,
      depth: node.depth,
      children: node.children,
      sources,
    })
  } catch (error) {
    console.error('Error fetching node:', error)
    return NextResponse.json(
      { error: 'Failed to fetch node' },
      { status: 500 }
    )
  }
}
