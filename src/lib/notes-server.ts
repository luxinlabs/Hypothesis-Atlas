export const NOTE_ENTITY_TYPE = 'note'

export interface NoteEntryShape {
  id: string
  type: 'manual' | 'comparison' | 'session' | 'insight'
  timestamp: string
  title?: string
  content: string
}

export function toNoteEntry(e: {
  id: string
  label: string
  content: string | null
  metadataJson: string | null
  createdAt: Date
}): NoteEntryShape {
  let meta: { noteType?: unknown; title?: unknown } = {}
  try {
    meta = e.metadataJson ? JSON.parse(e.metadataJson) : {}
  } catch {
    meta = {}
  }
  const noteType =
    meta.noteType === 'comparison' || meta.noteType === 'session' || meta.noteType === 'insight'
      ? (meta.noteType as 'comparison' | 'session' | 'insight')
      : 'manual'
  const title = typeof meta.title === 'string' && meta.title ? meta.title : undefined
  return {
    id: e.id,
    type: noteType,
    timestamp: e.createdAt.toISOString(),
    title,
    content: e.content ?? e.label,
  }
}

export function parseNoteMetadata(metadataJson: string | null): {
  noteType?: 'manual' | 'comparison' | 'session' | 'insight'
  title?: string
} {
  try {
    const meta = metadataJson ? JSON.parse(metadataJson) : {}
    const noteType =
      meta.noteType === 'comparison' || meta.noteType === 'session' || meta.noteType === 'insight'
        ? meta.noteType
        : 'manual'
    const title = typeof meta.title === 'string' && meta.title ? meta.title : undefined
    return { noteType, title }
  } catch {
    return { noteType: 'manual' }
  }
}

export function noteLabel(title: string | undefined, content: string): string {
  return title ? `${title} — ${content}`.slice(0, 200) : content.slice(0, 200)
}

export function noteMetadata(type: string, title: string | undefined): string {
  return JSON.stringify({ noteType: type, ...(title ? { title } : {}) })
}
