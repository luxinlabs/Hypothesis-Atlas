import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const pages = await prisma.notebookPage.findMany({
      where: { jobId: params.id },
      orderBy: { createdAt: 'asc' },
    })

    return NextResponse.json(pages)
  } catch (error) {
    console.error('Error fetching notebook pages:', error)
    return NextResponse.json({ error: 'Failed to fetch pages' }, { status: 500 })
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { title, content } = await request.json()

    if (!title || !content) {
      return NextResponse.json({ error: 'Title and content are required' }, { status: 400 })
    }

    const page = await prisma.notebookPage.create({
      data: {
        jobId: params.id,
        title,
        content,
      },
    })

    return NextResponse.json(page)
  } catch (error) {
    console.error('Error creating notebook page:', error)
    return NextResponse.json({ error: 'Failed to create page' }, { status: 500 })
  }
}
