import { NextRequest, NextResponse } from 'next/server'
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

    const prompt = `You are a scientific educator. Based on the following research paper idea, generate exactly 4 multiple-choice comprehension questions to help the researcher verify their understanding of the idea before writing. Cover different aspects: the core problem, the method, the next steps, and broader context.

Paper Title: ${idea.title}

Problem to Solve: ${idea.problem_to_solve}

Proposed Methods: ${idea.proposed_method.join('; ')}

Next 3 Steps: ${idea.next_3_steps.join('; ')}

Field Context: ${idea.field_context.join('; ') || 'General research'}

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
- Questions should progress: core problem → method → next steps → strategic context`

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
