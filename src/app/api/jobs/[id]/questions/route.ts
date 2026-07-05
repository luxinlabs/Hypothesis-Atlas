import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { generateWithGroq } from '@/lib/groq'

interface IdeaContent {
  title: string
  problem_to_solve: string
  proposed_method: string[]
  next_3_steps: string[]
  field_context: string[]
}

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const body = await request.json()
    const idea: IdeaContent = body.idea

    if (!idea?.title) {
      return NextResponse.json({ error: 'No idea content provided' }, { status: 400 })
    }

    // Fetch the job's root node + child nodes for real synthesized content
    const job = await prisma.job.findUnique({
      where: { id: params.id },
      select: { rootNodeId: true, topicQuery: true },
    })

    let nodesBlock = ''
    let sourcesBlock = ''

    if (job?.rootNodeId) {
      const rootNode = await prisma.node.findUnique({
        where: { id: job.rootNodeId },
        include: {
          children: true,
          nodeSources: {
            include: { source: true },
            orderBy: { createdAt: 'asc' },
          },
        },
      })

      if (rootNode) {
        const rootFindings = rootNode.findingsJson ? JSON.parse(rootNode.findingsJson) : []
        const rootMethods = rootNode.methodsJson ? JSON.parse(rootNode.methodsJson) : []
        const rootDisagreements = rootNode.disagreementsJson ? JSON.parse(rootNode.disagreementsJson) : []
        const rootOpenProblems = rootNode.openProblemsJson ? JSON.parse(rootNode.openProblemsJson) : []

        nodesBlock = `
Synthesized research overview for "${job.topicQuery}":
Summary: ${rootNode.summary}
Key findings: ${rootFindings.join('; ')}
Methods: ${rootMethods.join('; ')}
Disagreements: ${rootDisagreements.join('; ')}
Open problems: ${rootOpenProblems.join('; ')}`

        // Add child node subtopics
        if (rootNode.children.length > 0) {
          const subtopics = rootNode.children.map((child: any) => {
            const childFindings = child.findingsJson ? JSON.parse(child.findingsJson) : []
            return `  - ${child.label}: ${child.summary}${childFindings.length > 0 ? ` Findings: ${childFindings.slice(0, 2).join('; ')}` : ''}`
          })
          nodesBlock += `\n\nSubtopics from the knowledge tree:\n${subtopics.join('\n')}`
        }

        // Top peer-reviewed source snippets
        const peerSources = rootNode.nodeSources
          .filter((ns: any) => ns.source.reliabilityTier === 'peer_reviewed' && ns.source.snippet)
          .slice(0, 5)
          .map((ns: any) => `- "${ns.source.title}"${ns.source.venue ? ` (${ns.source.venue})` : ''}: ${ns.source.snippet}`)

        if (peerSources.length > 0) {
          sourcesBlock = `\nActual papers found during evidence mapping:\n${peerSources.join('\n')}`
        }
      }
    }

    const prompt = `You are a scientific educator. Generate exactly 4 multiple-choice comprehension questions about the specific research topic and evidence below. Questions must be answerable from the provided content — not from general knowledge.

Selected paper idea: ${idea.title}
Problem: ${idea.problem_to_solve}
Proposed methods: ${idea.proposed_method.join('; ')}
${nodesBlock}
${sourcesBlock}

Return a JSON object with this exact structure:
{
  "questions": [
    {
      "id": 1,
      "question": "Question text here?",
      "options": ["A) Option one", "B) Option two", "C) Option three", "D) Option four"],
      "correctIndex": 0,
      "explanation": "Brief explanation citing the specific finding, paper, or subtopic above."
    }
  ]
}

Rules:
- Questions must reference specific findings, paper titles, subtopics, or methods from the content above
- Do NOT ask about generic research concepts — every question must be specific to this topic
- correctIndex is 0-based (0=A, 1=B, 2=C, 3=D)
- Distractors should be plausible alternatives within this specific domain
- Explanation must cite which specific piece of evidence supports the answer
- Question progression: a key finding → a specific method or subtopic → a disagreement or gap → what the selected paper idea addresses`

    const result = await generateWithGroq(prompt)

    if (!result.questions || !Array.isArray(result.questions)) {
      return NextResponse.json({ error: 'Failed to generate questions' }, { status: 500 })
    }

    return NextResponse.json({ questions: result.questions })
  } catch (error) {
    console.error('Error generating paper questions:', error)
    return NextResponse.json({ error: 'Failed to generate questions' }, { status: 500 })
  }
}
