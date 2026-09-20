import { describe, it, expect, vi, beforeEach } from 'vitest'

describe('generateWithGroq without an API key', () => {
  beforeEach(() => {
    vi.resetModules()
    vi.spyOn(console, 'warn').mockImplementation(() => {})
    delete process.env.GROQ_API_KEY
  })

  it('returns the static fallback shape', async () => {
    const { generateWithGroq } = await import('./groq')
    const result = await generateWithGroq('summarize this')
    expect(result).toEqual({
      summary: 'Analysis unavailable — LLM service temporarily unreachable.',
      methods: [],
      findings: [],
      disagreements: [],
      openProblems: [],
      keywords: [],
      subtopics: [],
    })
  })

  it('exports a null client', async () => {
    const { groq } = await import('./groq')
    expect(groq).toBeNull()
  })

  it('streamGroqChat returns null when there is no client', async () => {
    const { streamGroqChat } = await import('./groq')
    await expect(streamGroqChat([{ role: 'user', content: 'hi' }], 'system')).resolves.toBeNull()
  })
})

describe('generateWithGroq with a mocked client', () => {
  const createMock = vi.fn()

  beforeEach(() => {
    vi.resetModules()
    vi.clearAllMocks()
    process.env.GROQ_API_KEY = 'test-key'
    vi.doMock('groq-sdk', () => ({
      default: vi.fn().mockImplementation(() => ({
        chat: { completions: { create: createMock } },
      })),
    }))
  })

  it('parses a valid JSON response', async () => {
    createMock.mockResolvedValue({ choices: [{ message: { content: '{"summary":"ok"}' } }] })
    const { generateWithGroq } = await import('./groq')
    await expect(generateWithGroq('prompt')).resolves.toEqual({ summary: 'ok' })
  })

  it('extracts JSON from a markdown code fence', async () => {
    createMock.mockResolvedValue({
      choices: [{ message: { content: '```json\n{"summary":"fenced"}\n```' } }],
    })
    const { generateWithGroq } = await import('./groq')
    await expect(generateWithGroq('prompt')).resolves.toEqual({ summary: 'fenced' })
  })

  it('falls back when the response is not valid JSON', async () => {
    createMock.mockResolvedValue({ choices: [{ message: { content: 'not json at all' } }] })
    vi.spyOn(console, 'warn').mockImplementation(() => {})
    const { generateWithGroq } = await import('./groq')
    const result = await generateWithGroq('prompt')
    expect(result.summary).toContain('unavailable')
  })

  it('falls back when the API call throws', async () => {
    createMock.mockRejectedValue(new Error('rate limited'))
    vi.spyOn(console, 'error').mockImplementation(() => {})
    const { generateWithGroq } = await import('./groq')
    const result = await generateWithGroq('prompt')
    expect(result.summary).toContain('unavailable')
  })
})
