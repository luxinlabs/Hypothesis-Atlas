import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { generateWithGroq } from '@/lib/groq'

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { pageId, message } = await request.json()

    if (!message) {
      return NextResponse.json({ error: 'Message is required' }, { status: 400 })
    }

    // Save user message
    const userMessage = await prisma.notebookMessage.create({
      data: {
        jobId: params.id,
        pageId,
        role: 'user',
        content: message,
      },
    })

    // Get job sources for context
    const sources = await prisma.source.findMany({
      where: { jobId: params.id },
      orderBy: { reliabilityTier: 'asc' },
      take: 20, // Limit to top sources
    })

    // Get existing candidate topics
    const candidates = await prisma.candidateTopic.findMany({
      where: { jobId: params.id, status: 'active' },
    })

    // Prepare context for LLM
    const sourcesContext = sources.map(s => 
      `[${s.type.toUpperCase()}] ${s.title} (${s.url}) - Reliability: ${s.reliabilityTier}\n${s.snippet || ''}`
    ).join('\n\n')

    const candidatesContext = candidates.map(c => c.label).join(', ')

    const prompt = `You are a scientific research assistant helping a researcher converge on top biotech research ideas. 

CONTEXT:
Research Topic: (from job sources)
Available Sources:
${sourcesContext}

Current Candidate Topics: ${candidatesContext || 'None yet'}

USER MESSAGE: ${message}

RESPONSE REQUIREMENTS:
1. Provide a helpful, grounded response about research topic selection
2. Every scientific claim MUST cite at least one source from the available sources
3. Social signals are "speculative" and cannot be used alone for scientific claims
4. If insufficient evidence exists in current sources, say so explicitly
5. Suggest 3-5 new candidate topics based on the sources and conversation

RESPONSE FORMAT (JSON):
{
  "response": "Your helpful response with citations like [Source X]",
  "citations": ["sourceId1", "sourceId2"],
  "suggestedTopics": [
    {"label": "Topic 1", "evidence": "Brief evidence from sources"},
    {"label": "Topic 2", "evidence": "Brief evidence from sources"},
    {"label": "Topic 3", "evidence": "Brief evidence from sources"}
  ]
}`

    const llmResponse = await generateWithGroq(prompt)

    // Save assistant message
    const assistantMessage = await prisma.notebookMessage.create({
      data: {
        jobId: params.id,
        pageId,
        role: 'assistant',
        content: llmResponse.response || 'Sorry, I encountered an error processing your request.',
        citationsJson: JSON.stringify(llmResponse.citations || []),
      },
    })

    // Create suggested candidate topics
    if (llmResponse.suggestedTopics && Array.isArray(llmResponse.suggestedTopics)) {
      for (const topic of llmResponse.suggestedTopics) {
        await prisma.candidateTopic.create({
          data: {
            jobId: params.id,
            label: topic.label,
            evidenceJson: JSON.stringify(topic.evidence || ''),
            score: Math.random() * 0.5 + 0.5, // Random score between 0.5-1.0
          },
        })
      }
    }

    return NextResponse.json({
      userMessage,
      assistantMessage,
      suggestedTopics: llmResponse.suggestedTopics || [],
    })
  } catch (error) {
    console.error('Error in notebook chat:', error)
    return NextResponse.json({ error: 'Failed to process chat message' }, { status: 500 })
  }
}
