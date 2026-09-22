import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { syncJobGraph } from '@/lib/research-graph'

// Source rows are per-job (papers get re-fetched per run), so the same paper
// can be linked several times via different rows — collapse them by title.
function dedupeSources<T extends { source: { title: string } }>(links: T[]): T[] {
  const seen = new Set<string>()
  return links.filter((es) => {
    const key = es.source.title.toLowerCase().replace(/\s+/g, ' ').trim()
    if (!key || seen.has(key)) return false
    seen.add(key)
    return true
  })
}

export async function GET() {
  try {
    // Backfill any completed job whose knowledge tree hasn't reached the graph yet
    // (a pre-existing 'note' entity used to make this look already-synced and skip
    // every job forever — checking entityCount === 0 isn't a valid "synced" signal).
    // Sync completion is tracked via the 'research_graph' progress event syncJobGraph
    // emits per job, rather than entity ownership — topic entities converge across
    // jobs that share a label, so a later job's id may never own one.
    const completedJobs = await prisma.job.findMany({
      where: { status: 'completed' },
      select: { id: true },
    })
    if (completedJobs.length > 0) {
      const syncedJobIds = new Set(
        (
          await prisma.progressEvent.findMany({
            where: { stage: 'research_graph', status: 'completed', jobId: { in: completedJobs.map((j) => j.id) } },
            select: { jobId: true },
          })
        ).map((e) => e.jobId)
      )
      const unsyncedJobs = completedJobs.filter((job) => !syncedJobIds.has(job.id))
      for (const job of unsyncedJobs) {
        await syncJobGraph(job.id)
      }
    }

    const entities = await prisma.graphEntity.findMany({
      include: {
        entitySources: {
          include: {
            source: {
              select: { id: true, title: true, url: true, type: true, venue: true, publishedAt: true },
            },
          },
        },
      },
      orderBy: { createdAt: 'asc' },
    })

    const edges = await prisma.graphEdge.findMany({ orderBy: { createdAt: 'asc' } })

    const byType: Record<string, number> = {}
    for (const e of entities) {
      byType[e.type] = (byType[e.type] ?? 0) + 1
    }

    return NextResponse.json({
      entities: entities.map((e) => ({
        id: e.id,
        type: e.type,
        label: e.label,
        content: e.content,
        jobId: e.jobId,
        origin: e.origin,
        pinned: e.pinned,
        metadata: e.metadataJson ? JSON.parse(e.metadataJson) : null,
        createdAt: e.createdAt,
        updatedAt: e.updatedAt,
        sources: dedupeSources(e.entitySources).map((es) => ({ ...es.source, role: es.role })),
      })),
      edges: edges.map((e) => ({
        id: e.id,
        fromId: e.fromId,
        toId: e.toId,
        type: e.type,
        jobId: e.jobId,
        origin: e.origin,
      })),
      stats: {
        entities: entities.length,
        edges: edges.length,
        byType,
      },
    })
  } catch (error) {
    console.error('Error fetching research graph:', error)
    return NextResponse.json({ error: 'Failed to fetch research graph' }, { status: 500 })
  }
}
