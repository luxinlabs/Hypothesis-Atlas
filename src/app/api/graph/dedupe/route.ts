import { NextResponse } from 'next/server'
import { dedupeGraph } from '@/lib/research-graph'

export async function POST() {
  try {
    const result = await dedupeGraph()
    return NextResponse.json(result)
  } catch (error) {
    console.error('Error deduplicating research graph:', error)
    return NextResponse.json({ error: 'Failed to deduplicate research graph' }, { status: 500 })
  }
}
