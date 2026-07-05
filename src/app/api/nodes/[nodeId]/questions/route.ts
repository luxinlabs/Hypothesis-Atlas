import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { generateWithGroq } from '@/lib/groq'

export async function GET(
  request: NextRequest,
  { params }: { params: { nodeId: string } }
) {
  try {
    const node = await prisma.node.findUnique({
      where: { id: params.nodeId },
      include: {
        nodeSources: {
          include: { source: true },
          orderBy: { createdAt: 'asc' },
        },
      },
    })

    if (!node) {
      return NextResponse.json({ error: 'Node not found' }, { status: 404 })
    }

    const methods = node.methodsJson ? JSON.parse(node.methodsJson) : []
    const findings = node.findingsJson ? JSON.parse(node.findingsJson) : []
    const disagreements = node.disagreementsJson ? JSON.parse(node.disagreementsJson) : []
    const openProblems = node.openProblemsJson ? JSON.parse(node.openProblemsJson) : []

    // Pull top peer-reviewed sources with snippets/abstracts for grounding
    const peerSources = node.nodeSources
      .filter((ns: any) => ns.source.reliabilityTier === 'peer_reviewed' && ns.source.snippet)
      .slice(0, 5)
      .map((ns: any) => `- "${ns.source.title}"${ns.source.venue ? ` (${ns.source.venue})` : ''}: ${ns.source.snippet}`)

    const sourcesBlock = peerSources.length > 0
      ? `\nActual papers linked to this node:\n${peerSources.join('\n')}`
      : ''

    const prompt = `You are a scientific educator. Based ONLY on the specific research content below, generate exactly 4 multiple-choice comprehension questions. The questions must be directly answerable from the provided content — do not ask about general research concepts.

Node Topic: ${node.label}

Summary: ${node.summary}

Methods used in this research: ${methods.join('; ')}

Key findings from this research: ${findings.join('; ')}

Current disagreements in the field: ${disagreements.join('; ')}

Open problems identified: ${openProblems.join('; ')}
${sourcesBlock}

Return a JSON object with this exact structure:
{
  "questions": [
    {
      "id": 1,
      "question": "Question text here?",
      "options": ["A) Option one", "B) Option two", "C) Option three", "D) Option four"],
      "correctIndex": 0,
      "explanation": "Brief explanation citing the specific finding/method/paper above."
    }
  ]
}

Rules:
- Every question must be answerable from the content above — not from general knowledge
- Reference specific findings, methods, or paper titles in the questions where possible
- correctIndex is 0-based (0=A, 1=B, 2=C, 3=D)
- Distractors should be plausible alternatives within this specific topic area
- Explanation must cite the specific part of the content that supports the answer
- Questions should progress: key finding → specific method → a disagreement/debate → an open problem`

    const result = await generateWithGroq(prompt)

    if (!result.questions || !Array.isArray(result.questions)) {
      return NextResponse.json({ error: 'Failed to generate questions' }, { status: 500 })
    }

    return NextResponse.json({ questions: result.questions })
  } catch (error) {
    console.error('Error generating questions:', error)
    return NextResponse.json({ error: 'Failed to generate questions' }, { status: 500 })
  }
}
