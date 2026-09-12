import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getNeo4jPaperGraph } from '@/lib/neo4j-paper-graph'

export async function GET(
  _request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const sources = await prisma.source.findMany({
      where: { jobId: params.id },
      include: {
        nodeSources: {
          include: { node: { select: { id: true, label: true, depth: true } } },
        },
      },
      orderBy: { createdAt: 'asc' },
    })

    if (sources.length === 0) {
      return NextResponse.json({ nodes: [], links: [] })
    }

    // Build node list with metadata
    const nodes = sources.map((s) => ({
      id: s.id,
      title: s.title,
      url: s.url,
      reliabilityTier: s.reliabilityTier,
      type: s.type,
      venue: s.venue,
      authors: s.authorsJson ? JSON.parse(s.authorsJson) : [],
      snippet: s.snippet,
      publishedAt: s.publishedAt,
      knowledgeNodes: s.nodeSources.map((ns) => ({
        nodeId: ns.nodeId,
        nodeLabel: ns.node.label,
        depth: ns.node.depth,
        role: ns.role,
      })),
    }))

    // Build links from shared knowledge nodes (always available)
    const nodeToSources: Record<string, string[]> = {}
    for (const s of sources) {
      for (const ns of s.nodeSources) {
        if (!nodeToSources[ns.nodeId]) nodeToSources[ns.nodeId] = []
        nodeToSources[ns.nodeId].push(s.id)
      }
    }

    const linkSet = new Set<string>()
    const links: Record<string, any> = {}
    for (const [nodeId, sourceIds] of Object.entries(nodeToSources)) {
      for (let i = 0; i < sourceIds.length; i++) {
        for (let j = i + 1; j < sourceIds.length; j++) {
          const key = [sourceIds[i], sourceIds[j]].sort().join('|')
          if (!linkSet.has(key)) {
            linkSet.add(key)
            links[key] = {
              source: sourceIds[i],
              target: sourceIds[j],
              sharedNode: nodeId,
              relationships: [],
            }
          }
        }
      }
    }

    // Merge Neo4j typed relationships into links
    try {
      const neo4jGraph = await getNeo4jPaperGraph(params.id)
      if (neo4jGraph) {
        for (const rel of neo4jGraph.links) {
          const key = [rel.source, rel.target].sort().join('|')
          if (links[key]) {
            links[key].relationships.push({
              type: rel.type,
              sharedAuthors: rel.sharedAuthors || [],
              count: rel.count || 0,
            })
          } else {
            // Neo4j-only link (e.g. SHARES_AUTHOR without shared knowledge node)
            links[key] = {
              source: rel.source,
              target: rel.target,
              sharedNode: null,
              relationships: [{
                type: rel.type,
                sharedAuthors: rel.sharedAuthors || [],
                count: rel.count || 0,
              }],
            }
          }
        }
      }
    } catch (err) {
      console.warn('Neo4j query failed, returning links without relationship types:', err)
    }

    return NextResponse.json({ nodes, links: Object.values(links) })
  } catch (error) {
    console.error('Error fetching paper map:', error)
    return NextResponse.json({ error: 'Failed to fetch paper map' }, { status: 500 })
  }
}
