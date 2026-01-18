import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET(
  request: NextRequest,
  { params }: { params: { pageId: string } }
) {
  try {
    const page = await prisma.notebookPage.findUnique({
      where: { id: params.pageId },
      include: {
        messages: {
          orderBy: { createdAt: 'asc' },
        },
      },
    })

    if (!page) {
      return NextResponse.json({ error: 'Page not found' }, { status: 404 })
    }

    return NextResponse.json(page)
  } catch (error) {
    console.error('Error fetching notebook page:', error)
    return NextResponse.json({ error: 'Failed to fetch page' }, { status: 500 })
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: { pageId: string } }
) {
  try {
    const { title, content } = await request.json()

    const page = await prisma.notebookPage.update({
      where: { id: params.pageId },
      data: {
        ...(title && { title }),
        ...(content !== undefined && { content }),
      },
    })

    return NextResponse.json(page)
  } catch (error) {
    console.error('Error updating notebook page:', error)
    return NextResponse.json({ error: 'Failed to update page' }, { status: 500 })
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { pageId: string } }
) {
  try {
    await prisma.notebookPage.delete({
      where: { id: params.pageId },
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error deleting notebook page:', error)
    return NextResponse.json({ error: 'Failed to delete page' }, { status: 500 })
  }
}
