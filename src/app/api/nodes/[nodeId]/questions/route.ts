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
    })

    if (!node) {
      return NextResponse.json({ error: 'Node not found' }, { status: 404 })
    }

    const methods = node.methodsJson ? JSON.parse(node.methodsJson) : []
    const findings = node.findingsJson ? JSON.parse(node.findingsJson) : []
    const disagreements = node.disagreementsJson ? JSON.parse(node.disagreementsJson) : []
    const openProblems = node.openProblemsJson ? JSON.parse(node.openProblemsJson) : []

    const prompt = `You are a scientific educator. Based on the following research node content, generate exactly 4 multiple-choice comprehension questions to help readers verify their understanding. Each question should test a different aspect of the content (summary, methods, findings, or open problems).

Node Topic: ${node.label}

Summary: ${node.summary}

Methods: ${methods.join('; ')}

Key Findings: ${findings.join('; ')}

Disagreements: ${disagreements.join('; ')}

Open Problems: ${openProblems.join('; ')}

Return a JSON object with this exact structure:
{
  "questions": [
    {
      "id": 1,
      "question": "Question text here?",
      "options": ["A) Option one", "B) Option two", "C) Option three", "D) Option four"],
      "correctIndex": 0,
      "explanation": "Brief explanation of why the correct answer is right."
    }
  ]
}

Rules:
- correctIndex is 0-based (0=A, 1=B, 2=C, 3=D)
- Make one option clearly correct based on the content above
- Make distractors plausible but wrong
- Explanation should reference the content above
- Questions should progress from basic (summary) to nuanced (open problems)`

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
