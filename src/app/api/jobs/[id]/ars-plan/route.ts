import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { anthropic, ANTHROPIC_MODEL } from '@/lib/anthropic'

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  if (!anthropic) {
    return NextResponse.json(
      { error: 'ANTHROPIC_API_KEY is not configured. Add it to your .env.local file.' },
      { status: 503 }
    )
  }

  const { messages, init, selectedIdea, referenceDoc } = await request.json()

  // Fetch job context
  const job = await prisma.job.findUnique({ where: { id: params.id } })
  if (!job) return NextResponse.json({ error: 'Job not found' }, { status: 404 })

  const sources = await prisma.source.findMany({
    where: { jobId: params.id, reliabilityTier: 'peer_reviewed' },
    take: 12,
    orderBy: { createdAt: 'asc' },
  })

  const top3 = await prisma.top3Ideas.findUnique({ where: { jobId: params.id } })
  const ideas = top3 ? JSON.parse(top3.ideasJson) : []
  const primaryIdea = selectedIdea ?? ideas[0]

  const litContext = sources
    .map((s) => `• ${s.title}${s.venue ? ` (${s.venue})` : ''}`)
    .join('\n')

  const systemPrompt = `You are an expert academic writing mentor running the /ars-plan Socratic planning mode from the Academic Research Skills (ARS) pipeline.

## Research Context from Hypothesis Atlas
**Topic:** ${job.topicQuery}
${primaryIdea ? `**Primary Research Idea:** ${primaryIdea.title}
**Problem:** ${primaryIdea.problem_to_solve}
**Proposed Methods:** ${primaryIdea.proposed_method?.join('; ')}` : ''}

**Key Literature (peer-reviewed):**
${litContext || 'None available yet.'}
${referenceDoc ? `
## Reference Document: "${referenceDoc.name}"
The researcher has attached a reference document for this session. Use it as context when relevant — they may ask you to discuss, critique, or build on it.

\`\`\`
${referenceDoc.content.slice(0, 6000)}${referenceDoc.content.length > 6000 ? '\n… [truncated]' : ''}
\`\`\`
` : ''}
## Your Role
Guide the researcher through planning their paper using Socratic dialogue. Go chapter by chapter:
1. Clarify the core research question and contribution
2. Discuss the Introduction (motivation, gap, preview)
3. Plan the Methods (design, data, analysis)
4. Anticipate Results/Findings structure
5. Frame the Discussion (interpretation, limitations, implications)
6. Draft a thesis statement and working title

## Rules
- Ask ONE focused question at a time — never a list of questions
- Challenge vague answers: "What specifically do you mean by...?"
- When the researcher is uncertain, offer 2–3 concrete options to choose from
- After each chapter is confirmed, summarize what was decided before moving on
- At the end, produce a structured paper plan as a clean Markdown outline
- Be direct and specific, not motivational — this is a planning workshop

${init ? 'Start by asking about the researcher\'s core claim: what is the one sentence that captures what this paper will argue or demonstrate?' : ''}`

  const encoder = new TextEncoder()

  const stream = new ReadableStream({
    async start(controller) {
      try {
        const effectiveMessages = (messages && messages.length > 0)
          ? messages
          : [{ role: 'user' as const, content: 'Please begin.' }]

        const stream = anthropic!.messages.stream({
          model: ANTHROPIC_MODEL,
          max_tokens: 1024,
          system: systemPrompt,
          messages: effectiveMessages,
        })

        for await (const chunk of stream) {
          if (
            chunk.type === 'content_block_delta' &&
            chunk.delta.type === 'text_delta'
          ) {
            controller.enqueue(encoder.encode(chunk.delta.text))
          }
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Stream error'
        controller.enqueue(encoder.encode(`\n\n[Error: ${msg}]`))
      } finally {
        controller.close()
      }
    },
  })

  return new NextResponse(stream, {
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
      'Transfer-Encoding': 'chunked',
      'Cache-Control': 'no-cache',
    },
  })
}
