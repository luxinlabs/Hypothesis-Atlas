import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { generateWithGroq } from '@/lib/groq'

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { selectedTopics } = await request.json()

    if (!selectedTopics || !Array.isArray(selectedTopics) || selectedTopics.length === 0) {
      return NextResponse.json({ error: 'Selected topics are required' }, { status: 400 })
    }

    // Get job sources for context
    const sources = await prisma.source.findMany({
      where: { jobId: params.id },
      orderBy: { reliabilityTier: 'asc' },
    })

    // Prepare sources context
    const sourcesContext = sources.map(s => 
      `[${s.type.toUpperCase()}] ${s.title} (${s.url || 'No URL'}) - Reliability: ${s.reliabilityTier}\n${s.snippet || ''}`
    ).join('\n\n')

    const prompt = `You are a scientific research strategist. Based on the available sources and selected topics, generate exactly 3 structured research ideas for biotech investigations.

SELECTED TOPICS: ${selectedTopics.join(', ')}

AVAILABLE SOURCES:
${sourcesContext}

REQUIREMENTS:
1. Generate exactly 3 distinct research ideas
2. Each idea must be grounded in the available sources
3. Every scientific claim must cite specific sources
4. Include concrete next steps and required data
5. Acknowledge limitations and open questions

RESPONSE FORMAT (strict JSON):
{
  "ideas": [
    {
      "title": "Research Idea Title",
      "field_context": ["Field 1", "Field 2"],
      "problem_to_solve": "Clear problem statement",
      "proposed_method": ["Method 1", "Method 2"],
      "data_needed": ["Data type 1", "Data type 2"],
      "available_datasets": ["Dataset from sources"],
      "key_papers": ["Paper from sources"],
      "risks_open_questions": ["Risk 1", "Question 1"],
      "next_3_steps": ["Step 1", "Step 2", "Step 3"],
      "citations": {
        "papers": ["sourceId1", "sourceId2"],
        "datasets": ["sourceId3"],
        "signals": ["sourceId4"]
      }
    }
  ]
}`

    const llmResponse = await generateWithGroq(prompt)

    // Validate response structure
    if (!llmResponse.ideas || !Array.isArray(llmResponse.ideas) || llmResponse.ideas.length !== 3) {
      throw new Error('Invalid LLM response structure')
    }

    // Save to Top3Ideas
    const top3Ideas = await prisma.top3Ideas.upsert({
      where: { jobId: params.id },
      update: {
        ideasJson: JSON.stringify(llmResponse.ideas),
        traceJson: JSON.stringify({
          selectedTopics,
          sourcesCount: sources.length,
          generatedAt: new Date().toISOString(),
        }),
      },
      create: {
        jobId: params.id,
        ideasJson: JSON.stringify(llmResponse.ideas),
        traceJson: JSON.stringify({
          selectedTopics,
          sourcesCount: sources.length,
          generatedAt: new Date().toISOString(),
        }),
      },
    })

    // Mark selected topics as 'selected'
    await prisma.candidateTopic.updateMany({
      where: {
        jobId: params.id,
        label: { in: selectedTopics },
      },
      data: { status: 'selected' },
    })

    return NextResponse.json({
      ideas: llmResponse.ideas,
      top3Ideas,
    })
  } catch (error) {
    console.error('Error converging to top 3 ideas:', error)
    
    // Fallback response
    const fallbackIdeas = [
      {
        title: "Novel Biomarker Discovery Pipeline",
        field_context: ["Genomics", "Machine Learning"],
        problem_to_solve: "Early detection of disease through comprehensive biomarker analysis",
        proposed_method: ["Multi-omics integration", "Deep learning pattern recognition"],
        data_needed: ["Genomic sequences", "Clinical outcomes", "Proteomic data"],
        available_datasets: ["Public genomic repositories"],
        key_papers: ["Recent Nature Medicine publications"],
        risks_open_questions: ["Data privacy concerns", "Validation across populations"],
        next_3_steps: ["Dataset collection", "Model development", "Clinical validation"],
        citations: { papers: [], datasets: [], signals: [] }
      },
      {
        title: "CRISPR-Based Therapeutic Platform",
        field_context: ["Gene Editing", "Molecular Biology"],
        problem_to_solve: "Targeted gene modification for rare diseases",
        proposed_method: ["CRISPR-Cas9 optimization", "Delivery vector engineering"],
        data_needed: ["Genetic targets", "Delivery efficiency data"],
        available_datasets: ["Gene expression databases"],
        key_papers: ["CRISPR methodology papers"],
        risks_open_questions: ["Off-target effects", "Immune response"],
        next_3_steps: ["Target validation", "Vector design", "In vitro testing"],
        citations: { papers: [], datasets: [], signals: [] }
      },
      {
        title: "AI-Driven Drug Repurposing",
        field_context: ["Pharmacology", "Artificial Intelligence"],
        problem_to_solve: "Identify new therapeutic uses for existing drugs",
        proposed_method: ["Network pharmacology", "Predictive modeling"],
        data_needed: ["Drug databases", "Disease networks", "Side effect profiles"],
        available_datasets: ["FDA drug databases", "Clinical trial data"],
        key_papers: ["Drug repurposing methodologies"],
        risks_open_questions: ["Efficacy validation", "Regulatory approval pathways"],
        next_3_steps: ["Network analysis", "Candidate identification", "Preclinical testing"],
        citations: { papers: [], datasets: [], signals: [] }
      }
    ]

    try {
      const top3Ideas = await prisma.top3Ideas.upsert({
        where: { jobId: params.id },
        update: {
          ideasJson: JSON.stringify(fallbackIdeas),
          traceJson: JSON.stringify({
            selectedTopics,
            sourcesCount: 0,
            generatedAt: new Date().toISOString(),
            fallback: true,
          }),
        },
        create: {
          jobId: params.id,
          ideasJson: JSON.stringify(fallbackIdeas),
          traceJson: JSON.stringify({
            selectedTopics,
            sourcesCount: 0,
            generatedAt: new Date().toISOString(),
            fallback: true,
          }),
        },
      })

      return NextResponse.json({
        ideas: fallbackIdeas,
        top3Ideas,
        fallback: true,
      })
    } catch (fallbackError) {
      console.error('Fallback also failed:', fallbackError)
      return NextResponse.json({ error: 'Failed to generate ideas' }, { status: 500 })
    }
  }
}
