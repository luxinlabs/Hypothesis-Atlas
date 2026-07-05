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

    const job = await prisma.job.findUnique({
      where: { id: params.id },
      select: { rootNodeId: true, topicQuery: true },
    })

    const contentParts: string[] = [
      `TOPIC: ${job?.topicQuery ?? idea.title}`,
      ``,
      `SELECTED IDEA: ${idea.title}`,
      `PROBLEM: ${idea.problem_to_solve}`,
      idea.proposed_method.length > 0
        ? `PROPOSED METHODS:\n${idea.proposed_method.map((m, i) => `  M${i + 1}. ${m}`).join('\n')}`
        : null,
    ].filter(Boolean) as string[]

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
        const rootFindings: string[] = rootNode.findingsJson ? JSON.parse(rootNode.findingsJson) : []
        const rootMethods: string[] = rootNode.methodsJson ? JSON.parse(rootNode.methodsJson) : []
        const rootDisagreements: string[] = rootNode.disagreementsJson ? JSON.parse(rootNode.disagreementsJson) : []
        const rootOpenProblems: string[] = rootNode.openProblemsJson ? JSON.parse(rootNode.openProblemsJson) : []

        contentParts.push(``)
        contentParts.push(`RESEARCH OVERVIEW SUMMARY: ${rootNode.summary}`)

        if (rootFindings.length > 0) {
          contentParts.push(`KEY FINDINGS:\n${rootFindings.map((f, i) => `  F${i + 1}. ${f}`).join('\n')}`)
        }
        if (rootMethods.length > 0) {
          contentParts.push(`METHODS IN USE:\n${rootMethods.map((m, i) => `  RM${i + 1}. ${m}`).join('\n')}`)
        }
        if (rootDisagreements.length > 0) {
          contentParts.push(`CURRENT DISAGREEMENTS:\n${rootDisagreements.map((d, i) => `  D${i + 1}. ${d}`).join('\n')}`)
        }
        if (rootOpenProblems.length > 0) {
          contentParts.push(`OPEN PROBLEMS:\n${rootOpenProblems.map((p, i) => `  O${i + 1}. ${p}`).join('\n')}`)
        }

        if (rootNode.children.length > 0) {
          const subtopics = rootNode.children.map((child: any, i: number) => {
            const childFindings: string[] = child.findingsJson ? JSON.parse(child.findingsJson) : []
            return `  S${i + 1}. ${child.label}: ${child.summary}${childFindings.length > 0 ? ` — Findings: ${childFindings.slice(0, 2).join('; ')}` : ''}`
          })
          contentParts.push(`SUBTOPICS FROM KNOWLEDGE TREE:\n${subtopics.join('\n')}`)
        }

        const peerSources = rootNode.nodeSources
          .filter((ns: any) => ns.source.reliabilityTier === 'peer_reviewed' && ns.source.snippet)
          .slice(0, 5)
          .map((ns: any, i: number) =>
            `  [P${i + 1}] "${ns.source.title}"${ns.source.venue ? ` — ${ns.source.venue}` : ''}: ${ns.source.snippet}`
          )

        if (peerSources.length > 0) {
          contentParts.push(`PAPERS FROM EVIDENCE MAPPING:\n${peerSources.join('\n')}`)
        }
      }
    }

    const contentBlock = contentParts.join('\n')

    const systemPrompt = `You are a quiz generator. Your ONLY job is to write multiple-choice questions whose correct answers can be found verbatim or paraphrased from the CONTENT block the user provides. You must NEVER introduce facts, concepts, or terminology that are not present in the CONTENT block. If a concept is not in the CONTENT block, do not ask about it. Every question must name a specific finding, method, subtopic, paper, or problem from the CONTENT block.`

    const prompt = `Generate exactly 4 multiple-choice questions using ONLY the content below. Every question must reference a specific item labelled F#, M#, D#, O#, S#, or P# from the CONTENT block. Do not use general knowledge.

===CONTENT START===
${contentBlock}
===CONTENT END===

Return JSON only:
{
  "questions": [
    {
      "id": 1,
      "question": "string — must name a specific finding/method/subtopic/paper/problem from the CONTENT",
      "options": ["A) ...", "B) ...", "C) ...", "D) ..."],
      "correctIndex": 0,
      "explanation": "string — quote or cite the exact item (F#/M#/D#/O#/S#/P#) that supports the answer"
    }
  ]
}

Question order: one about a key finding from the evidence → one about a method or subtopic → one about a disagreement or open problem → one about what the selected idea specifically addresses. All four must be uniquely answerable from the CONTENT block above.`

    const result = await generateWithGroq(prompt, undefined, systemPrompt)

    if (!result.questions || !Array.isArray(result.questions)) {
      return NextResponse.json({ error: 'Failed to generate questions' }, { status: 500 })
    }

    return NextResponse.json({ questions: result.questions })
  } catch (error) {
    console.error('Error generating paper questions:', error)
    return NextResponse.json({ error: 'Failed to generate questions' }, { status: 500 })
  }
}
