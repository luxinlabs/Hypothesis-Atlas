// SPDX-License-Identifier: AGPL-3.0-only

import { groq } from './groq'
import { anthropic, ANTHROPIC_MODEL } from './anthropic'
import { fetchTopicPapers, type FetchedPaper } from './fetchTopicPapers'

/**
 * Bold Idea's multi-agent pipeline — see issue "Bold Idea: multi-agent
 * exploration + cross-model verification" for the design and the research
 * it's based on (Google's AI Co-Scientist's Generation/Reflection split,
 * heterogeneous-model debate findings that cross-model critique surfaces
 * more genuine disagreement than same-model self-critique, and agentic
 * literature search as a multi-step process rather than one search call).
 *
 * Three agents, two model providers, one bounded pass (v0 — no tournament
 * ranking, no iterative evolution, no multi-round debate):
 *   1. Explorer (Groq)     — idea exploration: 2-4 candidate directions.
 *   2. Literature Agent    — searching: grounds each candidate in real
 *      papers via the *existing* fetchTopicPapers (OpenAlex + PubMed),
 *      not a new retrieval pipeline.
 *   3. Critic (Anthropic)  — validating: a genuinely different model from
 *      the Explorer reviews each grounded candidate and gives a verdict.
 *
 * This is a confidence signal from LLM-as-judge machinery, not a proof —
 * stated explicitly in the synthesis, the same way this app's other
 * verification features (math/physics/chemistry) state their own limits.
 */

export interface AgentCandidate {
  title: string
  rationale: string
}

export interface GroundedCandidate extends AgentCandidate {
  papers: { title: string; url: string; year: string }[]
}

export type CriticVerdict = 'well-supported' | 'speculative' | 'contradicted'

export interface CritiquedCandidate extends GroundedCandidate {
  verdict: CriticVerdict
  critique: string
}

export interface BoldIdeaAgentTrace {
  explorer: AgentCandidate[]
  literature: GroundedCandidate[]
  critic: CritiquedCandidate[]
  /** Rendered once, from the three stages above — what the chat actually shows. */
  synthesisMarkdown: string
}

const MAX_CANDIDATES = 4
const PAPERS_PER_CANDIDATE = 3

/** Explorer agent (Groq): idea exploration — candidate research directions, not literature-grounded yet. */
async function explore(text: string, tags: string[]): Promise<AgentCandidate[]> {
  if (!groq) return []
  try {
    const completion = await groq.chat.completions.create({
      model: 'openai/gpt-oss-120b',
      temperature: 0.4,
      max_tokens: 500,
      messages: [
        {
          role: 'system',
          content:
            `You are a research exploration agent. Given a research idea (tagged as: ${tags.join(', ')}), ` +
            `propose ${MAX_CANDIDATES} distinct, concrete research directions it could branch into — not ` +
            'restatements of the same idea, genuinely different angles (e.g. a mechanism question, a ' +
            'clinical/applied question, a methods question, a comparative question). Respond with ONLY ' +
            'JSON: {"candidates":[{"title":"short direction name","rationale":"1-2 sentences why this ' +
            'is a distinct, worthwhile direction"}]}.',
        },
        { role: 'user', content: text },
      ],
    })
    const raw = completion.choices[0]?.message?.content ?? ''
    const match = raw.match(/\{[\s\S]*\}/)
    if (!match) return []
    const parsed = JSON.parse(match[0]) as { candidates?: AgentCandidate[] }
    return (parsed.candidates ?? []).slice(0, MAX_CANDIDATES).filter((c) => c.title && c.rationale)
  } catch {
    return []
  }
}

/** Literature agent: searching — grounds each candidate via the existing fetchTopicPapers, not a new pipeline. */
async function ground(candidates: AgentCandidate[]): Promise<GroundedCandidate[]> {
  return Promise.all(
    candidates.map(async (candidate) => {
      let papers: FetchedPaper[] = []
      try {
        papers = await fetchTopicPapers(candidate.title, PAPERS_PER_CANDIDATE)
      } catch {
        papers = []
      }
      return {
        ...candidate,
        papers: papers.map((p) => ({ title: p.title, url: p.url, year: p.year })),
      }
    })
  )
}

/**
 * Critic agent (Anthropic — deliberately the *other* model provider from
 * the Explorer's Groq call): validating — reviews each grounded candidate
 * and gives a verdict. Runs as one call covering all candidates (not one
 * call per candidate) to keep this a single bounded pass, not an
 * open-ended multi-round debate.
 */
async function critique(candidates: GroundedCandidate[]): Promise<CritiquedCandidate[]> {
  if (!anthropic || candidates.length === 0) {
    return candidates.map((c) => ({ ...c, verdict: 'speculative' as const, critique: 'Critic model unavailable.' }))
  }
  try {
    const candidateBlock = candidates
      .map(
        (c, i) =>
          `${i + 1}. "${c.title}" — ${c.rationale}\n   Papers found: ${
            c.papers.length > 0 ? c.papers.map((p) => `"${p.title}" (${p.year})`).join('; ') : 'none'
          }`
      )
      .join('\n')
    const message = await anthropic.messages.create({
      model: ANTHROPIC_MODEL,
      max_tokens: 1000,
      system:
        'You are an independent research critic reviewing candidate research directions proposed by ' +
        'another model, each with papers found for it by a separate search step. For each candidate, ' +
        'give a verdict — "well-supported" (the papers genuinely back the direction), "speculative" (no ' +
        'strong papers either way, not unreasonable), or "contradicted" (the papers found undercut or ' +
        'contradict the premise) — plus one sentence of critique. Be skeptical: a paper merely sharing ' +
        'keywords with the candidate is not support. Respond with ONLY JSON: {"verdicts":[{"index":1,' +
        '"verdict":"well-supported","critique":"..."}]}.',
      messages: [{ role: 'user', content: candidateBlock }],
    })
    const block = message.content.find((b) => b.type === 'text')
    const text = block && block.type === 'text' ? block.text : ''
    const match = text.match(/\{[\s\S]*\}/)
    const parsed = match ? (JSON.parse(match[0]) as { verdicts?: { index: number; verdict: string; critique: string }[] }) : null
    const byIndex = new Map((parsed?.verdicts ?? []).map((v) => [v.index, v]))
    return candidates.map((c, i) => {
      const v = byIndex.get(i + 1)
      const verdict: CriticVerdict =
        v?.verdict === 'well-supported' || v?.verdict === 'contradicted' ? v.verdict : 'speculative'
      return { ...c, verdict, critique: v?.critique ?? 'No critique returned.' }
    })
  } catch {
    return candidates.map((c) => ({ ...c, verdict: 'speculative' as const, critique: 'Critic call failed.' }))
  }
}

const VERDICT_EMOJI: Record<CriticVerdict, string> = {
  'well-supported': '✅',
  speculative: '🤔',
  contradicted: '⚠️',
}

function renderSynthesis(text: string, critiqued: CritiquedCandidate[]): string {
  if (critiqued.length === 0) {
    return (
      `I looked into **"${text}"** but couldn't generate candidate directions for it — the exploration ` +
      `model may be unavailable right now. The research run below still covers the idea as a whole.`
    )
  }
  const sections = critiqued
    .map((c) => {
      const papers =
        c.papers.length > 0
          ? c.papers.map((p) => `  - [${p.title}](${p.url}) (${p.year})`).join('\n')
          : '  - No supporting papers found.'
      return `### ${VERDICT_EMOJI[c.verdict]} ${c.title}\n${c.rationale}\n\n**Critic (${c.verdict}):** ${c.critique}\n\n${papers}`
    })
    .join('\n\n')
  return (
    `I explored **"${text}"** across ${critiqued.length} directions — each one searched against real ` +
    `literature and independently reviewed by a second model.\n\n${sections}\n\n` +
    `_This is a confidence signal from model critique, not a proof — the research run below still goes ` +
    `ahead regardless of verdict; use these as a starting point for what to dig into first._`
  )
}

export async function runBoldIdeaAgents(text: string, tags: string[]): Promise<BoldIdeaAgentTrace> {
  const explorer = await explore(text, tags)
  const literature = await ground(explorer)
  const critic = await critique(literature)
  return { explorer, literature, critic, synthesisMarkdown: renderSynthesis(text, critic) }
}
