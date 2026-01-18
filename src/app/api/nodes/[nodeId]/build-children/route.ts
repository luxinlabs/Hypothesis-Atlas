import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function POST(
  request: NextRequest,
  { params }: { params: { nodeId: string } }
) {
  try {
    const node = await prisma.node.findUnique({
      where: { id: params.nodeId },
    })

    if (!node) {
      return NextResponse.json({ error: 'Node not found' }, { status: 404 })
    }

    // Check depth limit (max 3 layers: 0, 1, 2)
    if (node.depth >= 2) {
      return NextResponse.json(
        { error: 'Maximum depth reached. Cannot create more children.' },
        { status: 400 }
      )
    }

    // Check if children already exist
    const existingChildren = await prisma.node.count({
      where: { parentId: params.nodeId },
    })

    if (existingChildren > 0) {
      return NextResponse.json(
        { error: 'Children already exist for this node' },
        { status: 400 }
      )
    }

    // Trigger the build process directly
    const { buildChildrenForNode } = await import('@/worker/processor')
    
    // Run async without waiting
    buildChildrenForNode(node.jobId, params.nodeId, node.label, node.depth + 1).catch(console.error)

    return NextResponse.json({ 
      message: 'Building children nodes...',
      nodeId: params.nodeId 
    })
  } catch (error) {
    console.error('Error initiating child node build:', error)
    return NextResponse.json(
      { error: 'Failed to build children' },
      { status: 500 }
    )
  }
}
