import { NextRequest, NextResponse } from 'next/server'
import { syncJobGraph, syncAllJobs } from '@/lib/research-graph'

export async function POST(request: NextRequest) {
  try {
    let jobId: string | undefined
    try {
      const body = await request.json()
      jobId = typeof body?.jobId === 'string' && body.jobId ? body.jobId : undefined
    } catch {
      // Empty body is fine — sync everything.
    }

    if (jobId) {
      const result = await syncJobGraph(jobId)
      return NextResponse.json({ jobId, ...result })
    }

    const result = await syncAllJobs()
    return NextResponse.json(result)
  } catch (error) {
    console.error('Error syncing research graph:', error)
    return NextResponse.json({ error: 'Failed to sync research graph' }, { status: 500 })
  }
}
