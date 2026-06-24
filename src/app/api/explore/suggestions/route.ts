import { NextRequest, NextResponse } from 'next/server'
import { groq } from '@/lib/groq'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json() as { topic?: string; domain?: string }
    const topic = (body.topic ?? '').trim()
    const domain = (body.domain ?? 'general').trim()

    if (!topic) {
      return NextResponse.json({ words: [] }, { status: 400 })
    }

    const domainHint: Record<string, string> = {
      bio: 'biology, genomics, and biomedical research',
      chemistry: 'chemistry, materials science, and molecular science',
      tech: 'technology, computer science, and engineering',
      finance: 'finance, economics, and quantitative methods',
      general: 'cross-disciplinary research',
    }
    const domainContext = domainHint[domain] ?? 'cross-disciplinary research'

    if (!groq) {
      return NextResponse.json({
        words: [
          { text: topic, value: 100 },
          { text: `${topic} methods`, value: 85 },
          { text: `${topic} applications`, value: 80 },
        ],
      })
    }

    const completion = await groq.chat.completions.create({
      model: 'llama-3.3-70b-versatile',
      temperature: 0.5,
      max_tokens: 400,
      messages: [
        {
          role: 'system',
          content:
            'You are a research topic generator. Output ONLY a JSON array — no markdown, no explanation. Each element has "text" (a 2-5 word research phrase) and "value" (importance 60-100).',
        },
        {
          role: 'user',
          content: `Generate 16 diverse research keywords and sub-topics closely related to: "${topic}" within the field of ${domainContext}. Mix methods, applications, challenges, and adjacent concepts. Return ONLY a JSON array like: [{"text":"...","value":95},...]`,
        },
      ],
    })

    const raw = completion.choices[0]?.message?.content ?? '[]'
    const cleaned = raw
      .replace(/^```json\s*/i, '')
      .replace(/^```\s*/i, '')
      .replace(/\s*```$/, '')
      .trim()

    const parsed = JSON.parse(cleaned) as Array<{ text: string; value: number }>
    // Ensure value is a number in 60-100 range
    const words = parsed
      .filter((w) => w.text && typeof w.value === 'number')
      .map((w) => ({ text: w.text, value: Math.min(100, Math.max(60, w.value)) }))
      .slice(0, 20)

    return NextResponse.json({ words })
  } catch (error) {
    console.error('Suggestions error:', error)
    return NextResponse.json({ words: [] }, { status: 500 })
  }
}
