import Groq from 'groq-sdk'

const GROQ_API_KEY = process.env.GROQ_API_KEY

let groq: Groq | null = null

if (GROQ_API_KEY) {
  groq = new Groq({ apiKey: GROQ_API_KEY })
}

export async function generateWithGroq(prompt: string, schema?: any, systemPrompt?: string): Promise<any> {
  if (!groq) {
    return generateFallback(prompt, schema)
  }

  try {
    const completion = await groq.chat.completions.create({
      messages: [
        {
          role: 'system',
          content: systemPrompt ?? 'You are a scientific research assistant. Provide structured, accurate responses based on the given context.',
        },
        {
          role: 'user',
          content: prompt,
        },
      ],
      model: 'openai/gpt-oss-120b',
      temperature: 0.3,
      max_tokens: 2000,
    })

    const content = completion.choices[0]?.message?.content || '{}'
    
    try {
      // Try to extract JSON from markdown code blocks
      const jsonMatch = content.match(/```(?:json)?\s*(\{[\s\S]*\})\s*```/)
      const jsonString = jsonMatch ? jsonMatch[1] : content
      
      const parsed = JSON.parse(jsonString.trim())
      console.log('Groq response parsed successfully:', Object.keys(parsed))
      return parsed
    } catch (error) {
      console.warn('Failed to parse Groq response as JSON:', content.substring(0, 200))
      return generateFallback(prompt, schema)
    }
  } catch (error) {
    console.error('Groq API error:', error)
    return generateFallback(prompt, schema)
  }
}

export interface ChatMessage {
  role: 'user' | 'assistant'
  content: string
}

export async function streamGroqChat(
  messages: ChatMessage[],
  systemPrompt: string
): Promise<ReadableStream<Uint8Array> | null> {
  if (!groq || messages.length === 0) return null

  const client = groq
  const encoder = new TextEncoder()

  return new ReadableStream({
    async start(controller) {
      try {
        const completion = await client.chat.completions.create({
          messages: [
            { role: 'system', content: systemPrompt },
            ...messages,
          ],
          model: 'openai/gpt-oss-120b',
          temperature: 0.4,
          max_tokens: 3000,
          stream: true,
        })

        for await (const chunk of completion) {
          const delta = chunk.choices[0]?.delta?.content
          if (delta) controller.enqueue(encoder.encode(delta))
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Stream error'
        controller.enqueue(encoder.encode(`\n\n[Error: ${msg}]`))
      } finally {
        controller.close()
      }
    },
  })
}

function generateFallback(prompt: string, schema?: any): any {
  console.warn('Using generic fallback for prompt — Groq may be unavailable')
  return {
    summary: 'Analysis unavailable — LLM service temporarily unreachable.',
    methods: [],
    findings: [],
    disagreements: [],
    openProblems: [],
    keywords: [],
    subtopics: [],
  }
}

export { groq }
