import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const candidates = await prisma.candidateTopic.findMany({
      where: { jobId: params.id },
      orderBy: { createdAt: 'desc' },
    })

    return NextResponse.json(candidates)
  } catch (error) {
    console.error('Error fetching candidate topics:', error)
    return NextResponse.json({ error: 'Failed to fetch candidates' }, { status: 500 })
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { label, evidence } = await request.json()

    if (!label) {
      return NextResponse.json({ error: 'Label is required' }, { status: 400 })
    }

    const candidate = await prisma.candidateTopic.create({
      data: {
        jobId: params.id,
        label,
        evidenceJson: JSON.stringify(evidence || ''),
        score: Math.random() * 0.5 + 0.5, // Random score between 0.5-1.0
      },
    })

    return NextResponse.json(candidate)
  } catch (error) {
    console.error('Error creating candidate topic:', error)
    return NextResponse.json({ error: 'Failed to create candidate' }, { status: 500 })
  }
}
