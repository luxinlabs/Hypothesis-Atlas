// SPDX-License-Identifier: AGPL-3.0-only

import { groq } from './groq'

/**
 * "Try Something Bold" — a small, two-step pipeline that turns an
 * unconstrained free-text research idea into inputs for the *existing*
 * evidence-mapping pipeline (see /api/jobs), rather than a parallel one.
 * Deliberately minimal: two Groq calls, not a heavyweight agent framework —
 * start small, let real usage decide if it needs to grow.
 */

export interface BoldIdeaAnalysis {
  tags: string[]
  topicQuery: string
}

const FALLBACK_TAG = 'General'

/**
 * Tags the idea with 2-5 subject labels, which may span multiple domains —
 * this is what makes a cross-disciplinary idea ("a new drug for Type 2
 * Diabetes" -> Pharmacology + Endocrinology + Drug Discovery) show up as
 * more than one tag, unlike the word cloud's single fixed domain per word.
 */
async function tagSubjects(text: string): Promise<string[]> {
  if (!groq) return [FALLBACK_TAG]
  try {
    const completion = await groq.chat.completions.create({
      model: 'openai/gpt-oss-120b',
      temperature: 0.2,
      max_tokens: 300, // see refineQuery's comment — reasoning tokens share this budget
      messages: [
        {
          role: 'system',
          content:
            'Classify the research idea below into 2-5 short subject tags (e.g. "Pharmacology", ' +
            '"Endocrinology", "Drug Discovery", "Materials Science"). The idea may span multiple ' +
            'fields — list every field it genuinely touches, not just one. Respond with ONLY JSON: ' +
            '{"tags":["...", "..."]}.',
        },
        { role: 'user', content: text },
      ],
    })
    const raw = completion.choices[0]?.message?.content ?? ''
    const match = raw.match(/\{[\s\S]*\}/)
    if (!match) return [FALLBACK_TAG]
    const parsed = JSON.parse(match[0]) as { tags?: unknown }
    const tags = Array.isArray(parsed.tags) ? parsed.tags.map((t) => String(t).trim()).filter(Boolean) : []
    return tags.length > 0 ? tags.slice(0, 5) : [FALLBACK_TAG]
  } catch {
    return [FALLBACK_TAG]
  }
}

/**
 * Rewrites the free text into a short topicQuery string in the same shape
 * the word-cloud flow already produces (a plain topic phrase, not a full
 * sentence) — so it drops straight into the existing pipeline unmodified.
 * Falls back to the original text (trimmed/truncated) if the model is
 * unavailable or returns nothing usable, so a bold idea never gets stuck
 * for lack of a refinement step.
 */
async function refineQuery(text: string): Promise<string> {
  const fallback = text.trim().slice(0, 200)
  if (!groq) return fallback
  try {
    const completion = await groq.chat.completions.create({
      model: 'openai/gpt-oss-120b',
      temperature: 0.2,
      // gpt-oss-120b is a reasoning model — its "reasoning" tokens are drawn
      // from the same max_tokens budget as the final "content", before it.
      // A tight budget (tried 60 first) sometimes left content truncated
      // mid-phrase because reasoning ate most of it. 300 leaves headroom.
      max_tokens: 300,
      messages: [
        {
          role: 'system',
          content:
            'Rewrite the research idea below as a short topic phrase (5-10 words, not a full sentence) ' +
            'suitable as a search/research topic — e.g. "novel therapeutics for type 2 diabetes" rather ' +
            'than "I want to know more about new drugs for type 2 diabetes." Respond with ONLY the ' +
            'phrase, no quotes, no explanation.',
        },
        { role: 'user', content: text },
      ],
    })
    const refined = completion.choices[0]?.message?.content?.trim().replace(/^["']|["']$/g, '')
    return refined || fallback
  } catch {
    return fallback
  }
}

export async function analyzeBoldIdea(text: string): Promise<BoldIdeaAnalysis> {
  const [tags, topicQuery] = await Promise.all([tagSubjects(text), refineQuery(text)])
  return { tags, topicQuery }
}
