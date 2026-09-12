import { prisma } from './prisma'
import { runCypher, neo4j } from './neo4j'
import { generateWithGroq } from './groq'
import { emitProgressEvent } from './events'

export async function populateNeo4jGraph(jobId: string) {
  await emitProgressEvent({
    jobId,
    stage: 'neo4j_graph',
    status: 'started',
    message: 'Building Neo4j paper relationship graph',
    timestamp: Date.now(),
  })

  const sources = await prisma.source.findMany({
    where: { jobId },
    include: {
      nodeSources: {
        include: { node: { select: { id: true, label: true } } },
      },
    },
  })

  if (sources.length === 0) return

  // 1. Create Paper nodes in Neo4j
  for (const s of sources) {
    await runCypher(
      `MERGE (p:Paper {sourceId: $sourceId})
       SET p.title = $title, p.url = $url, p.type = $type,
           p.venue = $venue, p.publishedAt = $publishedAt,
           p.authorsJson = $authorsJson, p.jobId = $jobId`,
      {
        sourceId: s.id,
        title: s.title,
        url: s.url,
        type: s.type,
        venue: s.venue,
        publishedAt: s.publishedAt?.toISOString() ?? null,
        authorsJson: s.authorsJson ?? '[]',
        jobId,
      }
    )
  }

  // 2. Create Knowledge nodes and BELONGS_TO relationships
  const knowledgeNodes = new Map<string, string>()
  for (const s of sources) {
    for (const ns of s.nodeSources) {
      if (!knowledgeNodes.has(ns.node.id)) {
        knowledgeNodes.set(ns.node.id, ns.node.label)
      }
      await runCypher(
        `MATCH (p:Paper {sourceId: $sourceId})
         MERGE (k:KnowledgeNode {nodeId: $nodeId})
         SET k.label = $label
         MERGE (p)-[:BELONGS_TO]->(k)`,
        { sourceId: s.id, nodeId: ns.node.id, label: ns.node.label }
      )
    }
  }

  // 3. SHARES_AUTHOR — compare author lists
  let sharedAuthorCount = 0
  for (let i = 0; i < sources.length; i++) {
    const authorsA = safeParseAuthors(sources[i].authorsJson)
    if (authorsA.length === 0) continue
    for (let j = i + 1; j < sources.length; j++) {
      const authorsB = safeParseAuthors(sources[j].authorsJson)
      if (authorsB.length === 0) continue
      const shared = authorsA.filter(a =>
        authorsB.some(b => namesMatch(a, b))
      )
      if (shared.length > 0) {
        await runCypher(
          `MATCH (a:Paper {sourceId: $a}), (b:Paper {sourceId: $b})
           MERGE (a)-[r:SHARES_AUTHOR]->(b)
           SET r.sharedAuthors = $shared, r.count = $count`,
          {
            a: sources[i].id,
            b: sources[j].id,
            shared: JSON.stringify(shared),
            count: shared.length,
          }
        )
        sharedAuthorCount++
      }
    }
  }

  // 4. Relationship classification: heuristics first, then LLM for remaining
  const nodeToSourceIds: Record<string, string[]> = {}
  for (const s of sources) {
    for (const ns of s.nodeSources) {
      if (!nodeToSourceIds[ns.nodeId]) nodeToSourceIds[ns.nodeId] = []
      nodeToSourceIds[ns.nodeId].push(s.id)
    }
  }

  const candidatePairs = new Set<string>()
  const pairs: [string, string][] = []
  for (const ids of Object.values(nodeToSourceIds)) {
    for (let i = 0; i < ids.length; i++) {
      for (let j = i + 1; j < ids.length; j++) {
        const key = [ids[i], ids[j]].sort().join('|')
        if (!candidatePairs.has(key)) {
          candidatePairs.add(key)
          pairs.push([ids[i], ids[j]])
        }
      }
    }
  }

  let classifiedCount = 0
  let heuristicCount = 0

  // Sort pairs: prioritize pairs with shared authors (more likely to have meaningful relationships)
  const sourceMap = new Map(sources.map(s => [s.id, s]))
  pairs.sort(([a1, b1], [a2, b2]) => {
    const shared1 = countSharedAuthors(sourceMap.get(a1), sourceMap.get(b1))
    const shared2 = countSharedAuthors(sourceMap.get(a2), sourceMap.get(b2))
    return shared2 - shared1
  })

  const limitedPairs = pairs.slice(0, 50)

  for (const [idA, idB] of limitedPairs) {
    const paperA = sourceMap.get(idA)
    const paperB = sourceMap.get(idB)
    if (!paperA || !paperB) continue

    // Try heuristic rules first
    const heuristicRels = classifyByHeuristics(paperA, paperB)

    if (heuristicRels.length > 0) {
      for (const rel of heuristicRels) {
        await runCypher(
          `MATCH (a:Paper {sourceId: $a}), (b:Paper {sourceId: $b})
           MERGE (a)-[r:${rel}]->(b)
           SET r.classifiedAt = $now, r.method = 'heuristic'`,
          { a: idA, b: idB, now: new Date().toISOString() }
        )
        heuristicCount++
      }
      classifiedCount++
      continue
    }

    // Fall back to LLM classification with richer context
    const rel = await classifyRelationship(paperA, paperB)
    if (rel && rel !== 'NONE') {
      await runCypher(
        `MATCH (a:Paper {sourceId: $a}), (b:Paper {sourceId: $b})
         MERGE (a)-[r:${rel}]->(b)
         SET r.classifiedAt = $now, r.method = 'llm'`,
        { a: idA, b: idB, now: new Date().toISOString() }
      )
      classifiedCount++
    }
  }

  await emitProgressEvent({
    jobId,
    stage: 'neo4j_graph',
    status: 'completed',
    message: `Neo4j graph: ${sources.length} papers, ${sharedAuthorCount} shared-author links, ${classifiedCount} classified (${heuristicCount} heuristic), 0 LLM-only`,
    count: sources.length,
    timestamp: Date.now(),
  })
}

function classifyByHeuristics(paperA: any, paperB: any): string[] {
  const rels: string[] = []
  const yearA = paperA.publishedAt ? new Date(paperA.publishedAt).getFullYear() : null
  const yearB = paperB.publishedAt ? new Date(paperB.publishedAt).getFullYear() : null
  const venueA = (paperA.venue || '').toLowerCase().trim()
  const venueB = (paperB.venue || '').toLowerCase().trim()
  const sameVenue = venueA && venueB && venueA === venueB
  const sharedAuthors = countSharedAuthors(paperA, paperB)

  // Determine which paper is older for directional relationships
  const [older, newer] = yearA && yearB && yearA <= yearB
    ? [paperA, paperB]
    : [paperB, paperA]
  const olderYear = older.publishedAt ? new Date(older.publishedAt).getFullYear() : null
  const newerYear = newer.publishedAt ? new Date(newer.publishedAt).getFullYear() : null
  const yearGap = olderYear && newerYear ? newerYear - olderYear : null

  // Same venue + sequential years (within 2 years) → CITES
  if (sameVenue && yearGap !== null && yearGap > 0 && yearGap <= 2) {
    rels.push('CITES')
  }

  // Shared authors + newer paper → EXTENDS
  if (sharedAuthors > 0 && yearGap !== null && yearGap > 0 && yearGap <= 5) {
    rels.push('EXTENDS')
  }

  // Same venue + same year → SUPPORTS (likely same workshop/conference track)
  if (sameVenue && yearGap === 0) {
    rels.push('SUPPORTS')
  }

  return rels
}

function countSharedAuthors(paperA: any, paperB: any): number {
  const authorsA = safeParseAuthors(paperA?.authorsJson)
  const authorsB = safeParseAuthors(paperB?.authorsJson)
  if (authorsA.length === 0 || authorsB.length === 0) return 0
  return authorsA.filter(a => authorsB.some(b => namesMatch(a, b))).length
}

async function classifyRelationship(paperA: any, paperB: any): Promise<string | null> {
  const yearA = paperA.publishedAt ? new Date(paperA.publishedAt).getFullYear() : 'unknown'
  const yearB = paperB.publishedAt ? new Date(paperB.publishedAt).getFullYear() : 'unknown'

  const prompt = `Compare these two research papers and classify their relationship.

Paper A (${yearA}, ${paperA.venue || 'unknown venue'}):
Title: "${paperA.title}"
${paperA.snippet ? `Abstract: ${paperA.snippet.slice(0, 500)}` : 'No abstract available.'}

Paper B (${yearB}, ${paperB.venue || 'unknown venue'}):
Title: "${paperB.title}"
${paperB.snippet ? `Abstract: ${paperB.snippet.slice(0, 500)}` : 'No abstract available.'}

Classify as exactly one of:
- CITES: Paper A explicitly references or cites Paper B
- SUPPORTS: Their findings align or reinforce each other
- CONTRADICTS: Their findings conflict or disagree
- EXTENDS: One paper clearly builds on the other's methodology or results
- NONE: No meaningful relationship beyond sharing a research area

Be decisive. If the abstracts discuss similar methods with comparable results, choose SUPPORTS. If one clearly builds on the other, choose EXTENDS. Only choose NONE if the papers are truly unrelated beyond topic overlap.

Return ONLY a JSON object: {"relationship": "ONE_OF_THE_TYPES_ABOVE"}`

  try {
    const result = await generateWithGroq(prompt)
    const rel = (result.relationship || 'NONE').toUpperCase()
    if (['CITES', 'SUPPORTS', 'CONTRADICTS', 'EXTENDS', 'NONE'].includes(rel)) {
      return rel
    }
    return 'NONE'
  } catch {
    return 'NONE'
  }
}

function safeParseAuthors(json: string | null): string[] {
  if (!json) return []
  try {
    const arr = JSON.parse(json)
    return Array.isArray(arr) ? arr.map((a: any) => String(a).toLowerCase()) : []
  } catch {
    return []
  }
}

function namesMatch(a: string, b: string): boolean {
  const norm = (s: string) => s.replace(/[^a-z\s]/g, '').trim().split(/\s+/)
  const partsA = norm(a)
  const partsB = norm(b)
  if (partsA.length === 0 || partsB.length === 0) return false
  // Match if last names are the same and first initial matches
  const lastA = partsA[partsA.length - 1]
  const lastB = partsB[partsB.length - 1]
  if (lastA !== lastB) return false
  if (partsA[0] && partsB[0] && partsA[0][0] === partsB[0][0]) return true
  return lastA === lastB
}

export async function getNeo4jPaperGraph(jobId: string) {
  const records = await runCypher(
    `MATCH (p:Paper {jobId: $jobId})
     OPTIONAL MATCH (p)-[r]-(other:Paper)
     RETURN p.sourceId AS sourceId, p.title AS title,
            type(r) AS relType,
            other.sourceId AS otherId, r.sharedAuthors AS sharedAuthors, r.count AS count`,
    { jobId }
  )

  if (!records) return null

  const nodes = new Map<string, any>()
  const links: any[] = []
  const linkSet = new Set<string>()

  for (const rec of records) {
    const sourceId = rec.get('sourceId')
    if (!nodes.has(sourceId)) {
      nodes.set(sourceId, { sourceId, title: rec.get('title') })
    }
    const relType = rec.get('relType')
    const otherId = rec.get('otherId')
    if (relType && otherId) {
      const key = [sourceId, otherId].sort().join('|') + '|' + relType
      if (!linkSet.has(key)) {
        linkSet.add(key)
        links.push({
          source: sourceId,
          target: otherId,
          type: relType,
          sharedAuthors: rec.get('sharedAuthors') ? JSON.parse(rec.get('sharedAuthors')) : [],
          count: rec.get('count') || 0,
        })
      }
    }
  }

  return { nodes: Array.from(nodes.values()), links }
}

export async function clearJobFromNeo4j(jobId: string) {
  await runCypher(
    `MATCH (p:Paper {jobId: $jobId}) DETACH DELETE p`,
    { jobId }
  )
}
