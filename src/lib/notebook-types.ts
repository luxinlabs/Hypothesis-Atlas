// Notebook types
export interface NotebookPage {
  id: string
  jobId: string
  title: string
  content: string
  createdAt: string
  updatedAt: string
}

export interface NotebookMessage {
  id: string
  jobId: string
  pageId: string | null
  role: 'user' | 'assistant'
  content: string
  citationsJson: string | null
  createdAt: string
}

export interface CandidateTopic {
  id: string
  jobId: string
  label: string
  status: 'active' | 'archived' | 'selected'
  evidenceJson: string | null
  score: number | null
  createdAt: string
}

export interface Top3Ideas {
  id: string
  jobId: string
  generatedAt: string
  ideasJson: string
  traceJson: string | null
}

// Idea schema types
export interface Citation {
  papers: string[]
  datasets: string[]
  signals: string[]
}

export interface ResearchIdea {
  title: string
  field_context: string[]
  problem_to_solve: string
  proposed_method: string[]
  data_needed: string[]
  available_datasets: string[]
  key_papers: string[]
  risks_open_questions: string[]
  next_3_steps: string[]
  citations: Citation
}

export interface ConvergeResponse {
  ideas: ResearchIdea[]
  top3Ideas: Top3Ideas
  fallback?: boolean
}

export interface ChatResponse {
  userMessage: NotebookMessage
  assistantMessage: NotebookMessage
  suggestedTopics: Array<{
    label: string
    evidence: string
  }>
}

// UI state types
export interface NotebookState {
  pages: NotebookPage[]
  currentPage: NotebookPage | null
  messages: NotebookMessage[]
  candidates: CandidateTopic[]
  selectedCandidates: string[]
  top3Ideas: ResearchIdea[] | null
  isLoading: boolean
  isChatting: boolean
}

export interface ChatMessage {
  role: 'user' | 'assistant'
  content: string
  citations?: string[]
  timestamp: Date
}
