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

    const methods: string[] = node.methodsJson ? JSON.parse(node.methodsJson) : []
    const findings: string[] = node.findingsJson ? JSON.parse(node.findingsJson) : []
    const disagreements: string[] = node.disagreementsJson ? JSON.parse(node.disagreementsJson) : []
    const openProblems: string[] = node.openProblemsJson ? JSON.parse(node.openProblemsJson) : []

    const peerSources = node.nodeSources
      .filter((ns: any) => ns.source.reliabilityTier === 'peer_reviewed' && ns.source.snippet)
      .slice(0, 6)
      .map((ns: any, i: number) =>
        `[P${i + 1}] "${ns.source.title}"${ns.source.venue ? ` — ${ns.source.venue}` : ''}\n    Abstract: ${ns.source.snippet}`
      )

    const contentBlock = [
      `TOPIC: ${node.label}`,
      ``,
      `SUMMARY: ${node.summary}`,
      ``,
      findings.length > 0 ? `KEY FINDINGS:\n${findings.map((f, i) => `  F${i + 1}. ${f}`).join('\n')}` : null,
      methods.length > 0 ? `METHODS:\n${methods.map((m, i) => `  M${i + 1}. ${m}`).join('\n')}` : null,
      disagreements.length > 0 ? `DISAGREEMENTS:\n${disagreements.map((d, i) => `  D${i + 1}. ${d}`).join('\n')}` : null,
      openProblems.length > 0 ? `OPEN PROBLEMS:\n${openProblems.map((p, i) => `  O${i + 1}. ${p}`).join('\n')}` : null,
      peerSources.length > 0 ? `PAPERS:\n${peerSources.join('\n')}` : null,
    ].filter(Boolean).join('\n')

    const systemPrompt = `You are a quiz generator. Your ONLY job is to write multiple-choice questions whose correct answers can be found verbatim or paraphrased from the CONTENT block the user provides. You must NEVER introduce facts, concepts, or terminology that are not present in the CONTENT block. If a concept is not in the CONTENT block, do not ask about it. Every question must name a specific finding, method, paper, or problem from the CONTENT block.`

    const prompt = `Generate exactly 4 multiple-choice questions using ONLY the content below. Every question must reference a specific item labelled F#, M#, D#, O#, or P# from the CONTENT block. Do not use general knowledge.

===CONTENT START===
${contentBlock}
===CONTENT END===

Return JSON only:
{
  "questions": [
    {
      "id": 1,
      "question": "string — must name a specific finding/method/paper/problem from the CONTENT",
      "options": ["A) ...", "B) ...", "C) ...", "D) ..."],
      "correctIndex": 0,
      "explanation": "string — quote or cite the exact item (F#/M#/D#/O#/P#) that supports the answer"
    }
  ]
}

Question order: one about a key finding → one about a method → one about a disagreement or open problem → one about a specific paper or its finding. All four must be uniquely answerable from the CONTENT block above.`

    const result = await generateWithGroq(prompt, undefined, systemPrompt)

    if (!result.questions || !Array.isArray(result.questions)) {
      return NextResponse.json({ error: 'Failed to generate questions' }, { status: 500 })
    }

    return NextResponse.json({ questions: result.questions })
  } catch (error) {
    console.error('Error generating questions:', error)
    return NextResponse.json({ error: 'Failed to generate questions' }, { status: 500 })
  }
}
