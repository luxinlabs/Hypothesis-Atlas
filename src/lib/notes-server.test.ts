import { describe, it, expect } from 'vitest'
import { toNoteEntry, parseNoteMetadata, noteLabel, noteMetadata } from './notes-server'

describe('toNoteEntry', () => {
  const base = {
    id: 'n1',
    label: 'fallback label',
    content: 'the content',
    metadataJson: null as string | null,
    createdAt: new Date('2024-01-01T00:00:00.000Z'),
  }

  it('defaults to manual type with no metadata', () => {
    const entry = toNoteEntry(base)
    expect(entry).toEqual({
      id: 'n1',
      type: 'manual',
      timestamp: '2024-01-01T00:00:00.000Z',
      title: undefined,
      content: 'the content',
    })
  })

  it('reads noteType and title from metadataJson', () => {
    const entry = toNoteEntry({ ...base, metadataJson: JSON.stringify({ noteType: 'insight', title: 'My Title' }) })
    expect(entry.type).toBe('insight')
    expect(entry.title).toBe('My Title')
  })

  it('falls back to manual for unknown noteType values', () => {
    const entry = toNoteEntry({ ...base, metadataJson: JSON.stringify({ noteType: 'bogus' }) })
    expect(entry.type).toBe('manual')
  })

  it('falls back to manual on malformed JSON without throwing', () => {
    const entry = toNoteEntry({ ...base, metadataJson: '{not json' })
    expect(entry.type).toBe('manual')
    expect(entry.title).toBeUndefined()
  })

  it('drops non-string or empty title values', () => {
    const entry = toNoteEntry({ ...base, metadataJson: JSON.stringify({ title: '' }) })
    expect(entry.title).toBeUndefined()
  })

  it('falls back to label when content is null', () => {
    const entry = toNoteEntry({ ...base, content: null })
    expect(entry.content).toBe('fallback label')
  })
})

describe('parseNoteMetadata', () => {
  it('returns manual/undefined title for null input', () => {
    expect(parseNoteMetadata(null)).toEqual({ noteType: 'manual', title: undefined })
  })

  it('parses a valid noteType and title', () => {
    expect(parseNoteMetadata(JSON.stringify({ noteType: 'session', title: 'T' }))).toEqual({
      noteType: 'session',
      title: 'T',
    })
  })

  it('returns manual on parse failure', () => {
    expect(parseNoteMetadata('not-json')).toEqual({ noteType: 'manual' })
  })
})

describe('noteLabel', () => {
  it('joins title and content with an em dash when title is present', () => {
    expect(noteLabel('Title', 'Body text')).toBe('Title — Body text')
  })

  it('uses content alone when title is absent', () => {
    expect(noteLabel(undefined, 'Body text')).toBe('Body text')
  })

  it('truncates to 200 characters', () => {
    const long = 'x'.repeat(300)
    expect(noteLabel(undefined, long)).toHaveLength(200)
  })
})

describe('noteMetadata', () => {
  it('serializes noteType and title', () => {
    expect(JSON.parse(noteMetadata('insight', 'Title'))).toEqual({ noteType: 'insight', title: 'Title' })
  })

  it('omits title when absent', () => {
    expect(JSON.parse(noteMetadata('manual', undefined))).toEqual({ noteType: 'manual' })
  })
})
