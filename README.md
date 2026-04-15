# Hypothesis Atlas

A biotech research evidence mapping platform that automatically discovers, analyzes, and visualizes scientific knowledge from multiple sources including peer-reviewed papers, datasets, and social signals.

## Demo

- YouTube walkthrough: https://youtu.be/RuZt-DyZ1bE

## Features

- **Interactive Word Cloud**: Explore biotech topics including neural interfaces, CRISPR, single-cell RNA-seq, and more
- **Automated Evidence Mapping**: Asynchronous pipeline that fetches papers (OpenAlex, PubMed), datasets (GEO), and social signals
- **Real-time Progress Tracking**: Server-Sent Events (SSE) stream live updates during evidence gathering
- **Knowledge Tree Visualization**: Root node with 3-6 child nodes representing subtopics
- **Detailed Analysis**: Methods, findings, disagreements, and open problems for each node
- **Epistemic Guardrails**: Clear labeling of source reliability (peer-reviewed, preprint, dataset, social signal)
- **LLM-Powered Synthesis**: Uses Groq API for hypothesis clustering and analysis (with fallback)
- **Notebook & Topic Copilot**: Research notebook with markdown editor, AI chat, and topic convergence to top 3 ideas

## Tech Stack

- **Frontend**: Next.js 14 (App Router), React, TypeScript, Tailwind CSS
- **Backend**: Next.js API Routes, PostgreSQL, Prisma ORM
- **Background Jobs**: BullMQ + Redis (with setTimeout fallback)
- **APIs**: OpenAlex, PubMed E-utilities, NCBI GEO, mock social signals
- **LLM**: Groq (llama-3.1-70b-versatile)

## Prerequisites

- Node.js 18+ and npm
- Docker and Docker Compose (for PostgreSQL and Redis)
- Groq API key (optional but recommended)

## Quick Start

### 1) Install dependencies

```bash
npm install
```

### 2) Configure environment variables

Create `.env` (or update existing) with:

```env
DATABASE_URL="postgresql://postgres:postgres@localhost:5433/hypothesis_atlas?schema=public"
REDIS_URL="redis://localhost:6379"
GROQ_API_KEY="your_groq_api_key_here"
```

Get a free Groq API key at https://console.groq.com.

### 3) Start local infrastructure

```bash
make infra-up
```

This starts:

- PostgreSQL on host port `5433`
- Redis on host port `6379`

### 4) Initialize database schema

```bash
make db-push
```

### 5) Start app and worker (two terminals)

Terminal A:

```bash
make dev
```

Terminal B:

```bash
make worker
```

App URL: `http://localhost:3000`

> The worker is required for queue-based processing. If `REDIS_URL` is unset, the app falls back to in-process `setTimeout` handling.

## Usage

### Creating an Evidence Map

1. Visit `http://localhost:3000`
2. Click any term in the biotech word cloud (e.g., "neural implant stability")
3. Watch the progress timeline as the system:
   - Expands the query with related keywords
   - Fetches papers from OpenAlex and PubMed
   - Retrieves datasets from GEO
   - Gathers social signals (GitHub, Twitter)
   - Ranks and deduplicates sources
   - Builds root and child knowledge nodes
4. Explore the knowledge tree by clicking nodes
5. View detailed analysis in the right panel

### Using the Notebook & Topic Copilot

1. After evidence mapping completes, click the **"Notebook & Topic Copilot"** tab
2. **Create notebook pages**: Click the + button to add pages for your research notes
3. **Write in markdown**: Use the editor to document your thoughts (auto-saves)
4. **Chat with the AI**: Ask questions about research directions, topic selection, or methodology
5. **Manage candidate topics**:
   - Add topics manually or get suggestions from the AI
   - Select multiple topics by clicking the checkboxes
   - Archive unwanted topics
6. **Converge to Top 3**: With topics selected, click "Converge to Top 3" to generate structured research ideas

The AI provides:

- Grounded responses citing your actual sources
- Suggested research topics based on the evidence
- Structured research ideas with methods, data needs, and citations
- Acknowledgment of limitations when evidence is insufficient

### Demo Topic

Try **"neural implant stability"** for a comprehensive demo that includes:

- Papers on electrode stability, biocompatibility, and chronic recordings
- GEO datasets with neural recording data
- Mock GitHub repositories and Twitter discussions
- Analysis of gliosis, micromotion, and material science approaches

## Project Structure

```
ATLAS/
├── prisma/
│   └── schema.prisma          # Database schema
├── src/
│   ├── app/
│   │   ├── api/
│   │   │   ├── jobs/          # Job creation and status endpoints
│   │   │   │   ├── [id]/
│   │   │   │   │   ├── notebook/
│   │   │   │   │   │   ├── pages/    # Notebook pages CRUD
│   │   │   │   │   │   ├── messages/ # Chat messages
│   │   │   │   │   │   └── chat/     # AI chat endpoint
│   │   │   │   │   ├── candidates/  # Candidate topics CRUD
│   │   │   │   │   └── converge/    # Generate top 3 ideas
│   │   │   │   └── events/
│   │   │   ├── jobs/          # Job creation and status endpoints
│   │   │   └── nodes/         # Node detail endpoints
│   │   ├── job/[id]/          # Job progress page with notebook tab
│   │   ├── layout.tsx
│   │   ├── page.tsx           # Landing page with word cloud
│   │   └── globals.css
│   ├── components/
│   │   ├── WordCloud.tsx      # Interactive word cloud
│   │   ├── ProgressTimeline.tsx
│   │   ├── KnowledgeTree.tsx  # Tree visualization
│   │   ├── NodeDetail.tsx     # Node analysis panel
│   │   ├── NotebookTab.tsx    # Main notebook interface
│   │   ├── PageList.tsx       # Notebook pages sidebar
│   │   ├── MarkdownEditor.tsx # Markdown editor with auto-save
│   │   ├── ChatPanel.tsx      # AI chat interface
│   │   └── CandidateTopics.tsx # Topic management
│   ├── lib/
│   │   ├── apis/              # External API integrations
│   │   │   ├── openalex.ts
│   │   │   ├── pubmed.ts
│   │   │   ├── geo.ts
│   │   │   └── social.ts
│   │   ├── prisma.ts          # Prisma client
│   │   ├── redis.ts           # Redis connection
│   │   ├── queue.ts           # BullMQ queue
│   │   ├── groq.ts            # Groq LLM client
│   │   ├── events.ts          # Progress event store
│   │   └── notebook-types.ts  # TypeScript types for notebook
│   └── worker/
│       ├── index.ts           # BullMQ worker
│       └── processor.ts       # Evidence mapping pipeline
├── docker-compose.yml
├── Makefile
├── railway.json              # Worker deploy config for Railway
├── LICENSE
├── package.json
└── README.md
```

## Pipeline Stages

The evidence mapping pipeline consists of 8 stages:

1. **Initialization**: Job created and queued
2. **Query Expansion**: Generate 8-12 related keywords using LLM
3. **Fetch Papers**: Search OpenAlex (20 papers) and PubMed (15 papers)
4. **Fetch Datasets**: Query NCBI GEO (10 datasets)
5. **Fetch Social Signals**: Gather GitHub repos and Twitter mentions (5 signals)
6. **Rank Sources**: Score by recency + reliability tier, deduplicate
7. **Build Root Node**: Create hypothesis clusters, extract disagreements
8. **Build Child Nodes**: Generate 3-6 subtopic nodes with detailed analysis

Each stage emits progress events via SSE for real-time UI updates.

## Database Schema

### Job

- Tracks evidence mapping jobs
- Status: pending, processing, completed, failed

### Source

- Stores papers, datasets, and social signals
- Reliability tiers: peer_reviewed, preprint, dataset, social_signal

### Node

- Knowledge tree nodes (root + children)
- Contains: summary, methods, findings, disagreements, open problems

### NodeSource

- Links nodes to sources with roles: supporting, contradicting, background, signal

### NotebookPage

- Research notebook pages with markdown content
- Linked to jobs for organization

### NotebookMessage

- Chat messages between user and AI copilot
- Stores citations and context

### CandidateTopic

- Potential research topics suggested by AI or user
- Status: active, archived, selected
- Includes evidence and scoring

### Top3Ideas

- Final converged research ideas
- Structured JSON with methods, citations, next steps
- One record per job

## API Endpoints

### Job Management

- `POST /api/jobs` - Create new evidence mapping job
- `GET /api/jobs/[id]` - Get job status and root node ID
- `GET /api/jobs/[id]/events` - SSE stream of progress events
- `GET /api/nodes/[nodeId]` - Get node details with sources and children

### Notebook & Topic Copilot

- `GET /api/jobs/[id]/notebook/pages` - List notebook pages
- `POST /api/jobs/[id]/notebook/pages` - Create new notebook page
- `GET /api/notebook/pages/[pageId]` - Get page with messages
- `PUT /api/notebook/pages/[pageId]` - Update page content
- `DELETE /api/notebook/pages/[pageId]` - Delete page
- `GET /api/jobs/[id]/notebook/messages` - Get chat messages
- `POST /api/jobs/[id]/notebook/chat` - Send message to AI copilot
- `GET /api/jobs/[id]/candidates` - List candidate topics
- `POST /api/jobs/[id]/candidates` - Add candidate topic
- `POST /api/jobs/[id]/converge` - Generate top 3 research ideas

## Epistemic Guardrails

The system implements several safeguards:

1. **Source Labeling**: Clear distinction between peer-reviewed, preprints, datasets, and social signals
2. **Reliability Tiers**: Weighted scoring favors peer-reviewed sources
3. **Warning Labels**: Social signals marked as "Speculative / pre-publication signals"
4. **Source Attribution**: All claims linked to specific sources with URLs
5. **Disagreement Tracking**: Explicitly surfaces conflicting findings

## Development

### Database Management

```bash
# View database in Prisma Studio
npm run db:studio

# Reset database (caution: deletes all data)
docker-compose down -v
docker-compose up -d
npm run db:push
```

### Debugging

- Check worker logs for pipeline errors
- Monitor SSE events in browser DevTools Network tab
- Use Prisma Studio to inspect database state
- Redis CLI: `docker exec -it hypothesis_atlas_redis redis-cli`

## Limitations & Future Work

### Current Limitations

- Social signals are mocked (no real Twitter/GitHub API integration)
- No vector embeddings or semantic search (keyword-based only)
- Limited to 50 sources per job
- No user authentication or job persistence beyond session

### Future Enhancements

- Add pgvector for semantic similarity search
- Integrate real social media APIs with proper rate limiting
- Support PDF parsing for full-text analysis
- Add citation graph visualization
- Implement collaborative filtering for topic recommendations
- Add export to Markdown/PDF

## Deployment (Production)

### Architecture (recommended)

- **Web app**: Vercel (`Next.js`)
- **Database**: Neon / Supabase / Vercel Postgres
- **Queue**: Upstash Redis (or equivalent Redis)
- **Worker**: Railway (runs `npm run worker`)

### Why worker is separate

`npm run worker` does not run inside Vercel serverless deployments. Queue-based processing in production requires a separate worker service.

### 1) Deploy web app to Vercel

Set these env vars in Vercel project settings:

```bash
DATABASE_URL=postgresql://user:password@host:port/database
REDIS_URL=redis://default:password@host:port
GROQ_API_KEY=your_groq_api_key_here
```

Deploy:

```bash
make deploy-web
```

### 2) Deploy worker to Railway

This repo includes `railway.json` with `startCommand: npm run worker`.

Railway steps:

1. Create a new Railway project from this GitHub repo.
2. Add env vars: `DATABASE_URL`, `REDIS_URL`, `GROQ_API_KEY`.
3. Deploy (Railway will use `railway.json` automatically).
4. Confirm worker logs show: `Worker started and listening for jobs...`

### 3) Push schema to production database

```bash
DATABASE_URL="your_production_db_url" npm run db:push
```

## Troubleshooting

**Jobs stuck at "Initializing pipeline"?**

This is the most common issue - it means the worker isn't running:

1. **Check if worker is running:**

   ```bash
   pgrep -f "npm run worker" || echo "Worker not running"
   ```

2. **Start the worker:**

   ```bash
   # In a separate terminal
   npm run worker
   ```

3. **Verify Redis is accessible:**

   ```bash
   docker exec -it hypothesis_atlas_redis redis-cli ping
   # Should return: PONG
   ```

4. **Alternative without Redis:**
   ```bash
   # Temporarily remove REDIS_URL from .env
   # Jobs will use setTimeout fallback (slower but works)
   ```

**Worker not processing jobs?**

- Check Redis is running: `docker ps` (local) or verify Upstash connection (production)
- Verify environment variables in `.env` or Vercel settings
- Jobs will auto-fallback to setTimeout if Redis unavailable

**No papers found?**

- OpenAlex and PubMed APIs may rate limit
- Check network connectivity
- Try a different topic

**LLM responses generic?**

- Verify GROQ_API_KEY is set correctly
- Fallback mode provides basic but functional analysis

**Database connection errors?**

- Ensure PostgreSQL container is running (local) or database is accessible (production)
- Check DATABASE_URL in `.env` or Vercel settings
- Run `npm run db:push` to sync schema

**Vercel deployment fails?**

- Check build logs in Vercel dashboard
- Ensure all environment variables are set
- Verify Prisma schema is valid: `npx prisma validate`

## Contributing

Contributions are welcome.

1. Fork the repo and create a feature branch.
2. Keep changes focused and include clear commit messages.
3. Update docs for any behavior/config changes.
4. Open a PR with a concise description and screenshots/logs if relevant.

For larger changes, open an issue first to discuss approach.

## Security

- Never commit secrets (`DATABASE_URL`, `REDIS_URL`, `GROQ_API_KEY`).
- Use environment variables in local/dev/prod.
- Report security issues privately to project maintainers.

## License

This project is licensed under the MIT License. See `LICENSE` for details.

## Acknowledgments

- OpenAlex for open access to scholarly data
- NCBI for PubMed and GEO APIs
- Groq for fast LLM inference
