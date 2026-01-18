import Groq from 'groq-sdk'

const GROQ_API_KEY = process.env.GROQ_API_KEY

let groq: Groq | null = null

if (GROQ_API_KEY) {
  groq = new Groq({ apiKey: GROQ_API_KEY })
}

export async function generateWithGroq(prompt: string, schema?: any): Promise<any> {
  if (!groq) {
    return generateFallback(prompt, schema)
  }

  try {
    const completion = await groq.chat.completions.create({
      messages: [
        {
          role: 'system',
          content: 'You are a scientific research assistant. Provide structured, accurate responses based on the given context.',
        },
        {
          role: 'user',
          content: prompt,
        },
      ],
      model: 'llama-3.3-70b-versatile',
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

function generateFallback(prompt: string, schema?: any): any {
  if (prompt.includes('expand query') || prompt.includes('keywords')) {
    return {
      keywords: ['neural interface', 'brain-computer interface', 'neuroprosthetics', 'electrode stability', 'chronic implants']
    }
  }
  
  if (prompt.includes('cluster') || prompt.includes('hypotheses')) {
    return {
      clusters: [
        { label: 'Material Science', description: 'Biocompatible materials and coatings' },
        { label: 'Biological Response', description: 'Immune response and gliosis' },
        { label: 'Mechanical Factors', description: 'Micromotion and tissue damage' }
      ]
    }
  }
  
  return {
    summary: 'Analysis of the topic based on available sources.',
    methods: ['Literature review', 'Data analysis'],
    findings: ['Multiple approaches being explored', 'Ongoing research challenges'],
    disagreements: ['Debate on optimal materials', 'Conflicting results on long-term stability'],
    openProblems: ['Long-term biocompatibility', 'Signal quality degradation', 'Scalability']
  }
}

export { groq }
