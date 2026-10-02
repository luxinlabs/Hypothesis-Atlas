// SPDX-License-Identifier: AGPL-3.0-only

/**
 * A piece of chat text the researcher highlighted and chose to keep —
 * Bold Idea's lightweight stand-in for the regular Job pipeline's
 * graph-backed notes (GraphEntity, see /api/jobs/[id]/notes), which a bold
 * idea can't use since it has no Job row. Stored as a plain JSON array on
 * BoldIdea.knowledgeJson rather than its own table — this is a flat list
 * with no graph relationships, so a table/relation would be overhead this
 * doesn't need.
 */
export interface Highlight {
  id: string
  text: string
  createdAt: string
}
