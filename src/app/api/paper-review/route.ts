import { NextRequest, NextResponse } from 'next/server'
import { groq } from '@/lib/groq'

interface CustomAgentInput {
  name?: string
  persona?: string
}

interface ReviewScores {
  novelty: number
  soundness: number
  clarity: number
  significance: number
  overall: number
}

interface AgentReview {
  id: string
  name: string
  unavailable?: boolean
  summary?: string
  strengths?: string[]
  weaknesses?: string[]
  questions?: string[]
  scores?: ReviewScores
  recommendation?: string
}

const PRESET_AGENTS = [
  {
    id: 'methodologist',
    name: 'Prof. Elena Marsh — Methodology & Novelty',
    persona:
      'A tenured professor who has served on top-tier program committees for 15 years. She is skeptical of incremental work and scrutinizes whether the claimed contribution is genuinely novel versus repackaged prior art. She reads the method description line by line and flags logical gaps, missing baselines, and unsupported assumptions.',
  },
  {
    id: 'committee',
    name: 'Dr. Rajiv Menon — Venue Committee, Impact & Fit',
    persona:
      'A senior program committee member and journal associate editor. He evaluates whether the paper matters to this venue\'s specific audience, whether the positioning and related-work coverage are fair, and whether the claims match the evidence. He writes balanced reviews but is decisive about rejections that waste reviewer time.',
  },
  {
    id: 'rigor',
    name: 'Dr. Sofia Lindqvist — Statistical Rigor & Reproducibility',
    persona:
      'A methods reviewer with a background in experimental design. She checks statistical validity, sample sizes, error bars, ablation coverage, dataset choices, and whether the experiments could be reproduced from the paper alone. She is unforgiving about overclaimed results and missing negative results.',
  },
]

const RECOMMENDATIONS = ['accept', 'minor revision', 'major revision', 'reject']

function clampScore(v: unknown): number {
  const n = Number(v)
  if (!isFinite(n)) return 5
  return Math.max(1, Math.min(10, Math.round(n)))
}

function asStringArray(v: unknown, max: number): string[] {
  if (!Array.isArray(v)) return []
  return v
    .filter((x): x is string => typeof x === 'string' && x.trim().length > 0)
    .slice(0, max)
}

function parseJsonObject(raw: string): any | null {
  const match = raw.match(/\{[\s\S]*\}/)
  if (!match) return null
  try {
    return JSON.parse(match[0])
  } catch {
    return null
  }
}

async function extractVenueCriteria(venueUrl: string): Promise<{ name: string | null; criteria: string[]; focus: string[] } | null> {
  let html: string
  try {
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), 8000)
    const res = await fetch(venueUrl, {
      signal: controller.signal,
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; HypothesisAtlas/1.0)' },
    })
    clearTimeout(timer)
    if (!res.ok) return null
    html = await res.text()
  } catch {
    return null
  }

  const text = html
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 8000)
  if (text.length < 200) return null

  const prompt = `Below is text scraped from a publisher or conference website (call for papers / author guidelines). Extract what their reviewers are asked to evaluate.

Website text:
${text}

Return ONLY a JSON object:
{"name": "official venue or publisher name if stated, else null", "criteria": ["...", "..."], "focus": ["what this venue values most, e.g. rigor, novelty, applications", "..."]}

criteria: 3-6 review criteria explicitly or implicitly described (e.g. novelty, technical soundness, clarity, significance, reproducibility, fit).
focus: up to 3 things this venue appears to weight most heavily.`

  const parsed = await askGroq(prompt, 'You extract structured review criteria from publisher guidelines. Respond with valid JSON only.')
  if (!parsed || typeof parsed !== 'object') return null
  const name = typeof parsed.name === 'string' && parsed.name.trim() ? parsed.name.trim().slice(0, 120) : null
  const criteria = asStringArray(parsed.criteria, 6).map((c) => c.slice(0, 200))
  const focus = asStringArray(parsed.focus, 3).map((c) => c.slice(0, 200))
  if (criteria.length === 0) return null
  return { name, criteria, focus }
}

async function askGroq(prompt: string, system: string, maxTokens = 2500): Promise<any | null> {
  if (!groq) return null
  try {
    const completion = await groq.chat.completions.create({
      model: 'openai/gpt-oss-120b',
      temperature: 0.3,
      max_tokens: maxTokens,
      messages: [
        { role: 'system', content: system },
        { role: 'user', content: prompt },
      ],
    })
    const raw = completion.choices[0]?.message?.content ?? ''
    return parseJsonObject(raw)
  } catch {
    return null
  }
}

async function reviewAsAgent(opts: {
  agent: { id: string; name: string; persona: string }
  paperText: string
  venueName: string
  venueCriteria: string[]
  venueFocus: string[]
}): Promise<AgentReview> {
  const { agent, paperText, venueName, venueCriteria, venueFocus } = opts
  const criteriaNote =
    venueCriteria.length > 0
      ? `This venue's stated review criteria: ${venueCriteria.join('; ')}.${venueFocus.length ? ` It especially values: ${venueFocus.join('; ')}.` : ''}`
      : 'No explicit venue criteria were provided; apply the standard peer-review criteria for this kind of venue.'

  const prompt = `You are ${agent.name}.
${agent.persona}

${criteriaNote}

Review the paper draft below as this reviewer would. Write a REAL peer review: specific to this paper's actual content (quote or reference its actual sections, methods, and claims — do not write generic boilerplate). Be critical but fair; a good review names concrete strengths and actionable weaknesses.

Paper draft:
"""
${paperText}
"""

Return ONLY a JSON object:
{"summary": "2-3 sentence review summary", "strengths": ["...", "...", "..."], "weaknesses": ["...", "...", "..."], "questions": ["...", "..."], "scores": {"novelty": 1, "soundness": 1, "clarity": 1, "significance": 1, "overall": 1}, "recommendation": "one of: accept, minor revision, major revision, reject"}

scores: integers 1-10 (1 = fatally flawed, 6 = marginally above threshold, 10 = exceptional).
recommendation: exactly one of the four values, lowercase.
weaknesses: at least 2 items, each actionable and specific.`

  for (let attempt = 0; attempt < 2; attempt++) {
    const parsed = await askGroq(
      prompt,
      'You are an experienced peer reviewer for an academic venue. You write specific, evidence-based reviews and respond with valid JSON only.'
    )
    if (!parsed || typeof parsed !== 'object') continue
    const s = parsed.scores
    if (!s || typeof s !== 'object') continue
    const scores: ReviewScores = {
      novelty: clampScore(s.novelty),
      soundness: clampScore(s.soundness),
      clarity: clampScore(s.clarity),
      significance: clampScore(s.significance),
      overall: clampScore(s.overall),
    }
    const summary = typeof parsed.summary === 'string' ? parsed.summary.trim().slice(0, 800) : ''
    const strengths = asStringArray(parsed.strengths, 5).map((x) => x.slice(0, 300))
    const weaknesses = asStringArray(parsed.weaknesses, 6).map((x) => x.slice(0, 300))
    const questions = asStringArray(parsed.questions, 4).map((x) => x.slice(0, 300))
    let recommendation = String(parsed.recommendation ?? '').toLowerCase().trim()
    if (!RECOMMENDATIONS.includes(recommendation)) {
      recommendation = RECOMMENDATIONS[Math.min(3, Math.floor((scores.overall - 1) / 3))]
    }
    if (!summary || weaknesses.length === 0) continue
    return { id: agent.id, name: agent.name, summary, strengths, weaknesses, questions, scores, recommendation }
  }

  return { id: agent.id, name: agent.name, unavailable: true }
}

export async function POST(request: NextRequest) {
  if (!groq) {
    return NextResponse.json(
      { error: 'GROQ_API_KEY is not configured. Add it to your .env.local file.' },
      { status: 503 }
    )
  }

  const body = await request.json().catch(() => null)
  const paperText = String(body?.paperText ?? '').trim()
  const venueNameInput = String(body?.venueName ?? '').trim().slice(0, 120)
  const venueUrl = String(body?.venueUrl ?? '').trim().slice(0, 300)
  const custom = body?.customAgent as CustomAgentInput | null

  if (!paperText || paperText.length < 200) {
    return NextResponse.json({ error: 'Paper draft is too short to review (min 200 chars)' }, { status: 400 })
  }
  if (venueUrl && !/^https?:\/\//i.test(venueUrl)) {
    return NextResponse.json({ error: 'Venue URL must start with http:// or https://' }, { status: 400 })
  }

  const truncatedPaper = paperText.slice(0, 18000)

  // Venue criteria: scrape call-for-papers URL if provided
  let venueCriteria: string[] = []
  let venueFocus: string[] = []
  let venueName = venueNameInput
  if (venueUrl) {
    const extracted = await extractVenueCriteria(venueUrl)
    if (extracted) {
      venueCriteria = extracted.criteria
      venueFocus = extracted.focus
      if (!venueName && extracted.name) venueName = extracted.name
    }
  }
  if (!venueName) venueName = 'the target venue'

  const roster = [...PRESET_AGENTS]
  const customName = String(custom?.name ?? '').trim().slice(0, 80)
  const customPersona = String(custom?.persona ?? '').trim().slice(0, 600)
  if (customName && customPersona) {
    roster.push({
      id: 'custom',
      name: customName,
      persona: `${customPersona} Review the paper in character, consistent with this description.`,
    })
  }

  const agents: AgentReview[] = []
  for (const agent of roster) {
    agents.push(
      await reviewAsAgent({ agent, paperText: truncatedPaper, venueName, venueCriteria, venueFocus })
    )
  }

  const available = agents.filter((a) => !a.unavailable && a.scores)
  if (available.length === 0) {
    return NextResponse.json(
      { error: 'All reviewer agents failed — the LLM service may be rate-limited. Try again in a moment.' },
      { status: 502 }
    )
  }

  const average = (key: keyof ReviewScores) =>
    Math.round((available.reduce((sum, a) => sum + (a.scores![key] as number), 0) / available.length) * 10) / 10

  const finalScores: ReviewScores = {
    novelty: average('novelty'),
    soundness: average('soundness'),
    clarity: average('clarity'),
    significance: average('significance'),
    overall: average('overall'),
  }

  const recCounts = new Map<string, number>()
  for (const a of available) {
    recCounts.set(a.recommendation!, (recCounts.get(a.recommendation!) ?? 0) + 1)
  }
  const consensus = [...recCounts.entries()].sort((x, y) => y[1] - x[1])[0]?.[0] ?? 'major revision'

  const metaPrompt = `You are the meta-reviewer (senior program chair / editor-in-chief) for ${venueName}. Below are ${available.length} completed peer reviews of the same paper draft, as JSON:

${JSON.stringify(
    available.map((a) => ({
      reviewer: a.name,
      summary: a.summary,
      scores: a.scores,
      recommendation: a.recommendation,
      topWeaknesses: (a.weaknesses ?? []).slice(0, 2),
    }))
  )}

Aggregate scores (1-10 averages): novelty ${finalScores.novelty}, soundness ${finalScores.soundness}, clarity ${finalScores.clarity}, significance ${finalScores.significance}, overall ${finalScores.overall}.

Write the meta-review an editor would send the authors: 3-5 sentences weighing where the reviewers agree, the single most important thing to fix before resubmission, and the final decision context. Be specific, not boilerplate.

Return ONLY JSON: {"metaReview": "..."}`

  const meta = await askGroq(metaPrompt, 'You are a senior editor writing a meta-review. Respond with valid JSON only.', 900)
  const metaReview =
    meta && typeof meta.metaReview === 'string' && meta.metaReview.trim()
      ? meta.metaReview.trim().slice(0, 1200)
      : `${available.length} reviewers reached consensus: ${consensus}. Overall score ${finalScores.overall}/10. Address the shared weaknesses above before resubmission.`

  return NextResponse.json({
    venue: { name: venueName, url: venueUrl || null, criteria: venueCriteria, focus: venueFocus },
    agents,
    final: { scores: finalScores, consensus, metaReview, reviewerCount: available.length },
  })
}
