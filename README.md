# Hypothesis Atlas

HEPOPS Atlas (Hypothesis Atlas) is a multi-domain evidence mapping platform that automatically discovers, analyzes, and visualizes scientific and technical knowledge from multiple sources including peer-reviewed papers, datasets, and social signals.

It now includes a full **Academic Paper Pipeline** powered by the [ARS (Academic Research Skills)](https://github.com/luxinlabs/academic-research-skills) plugin — letting you go from a research topic all the way to a structured paper draft without leaving the app.

## Demo Video

[![Watch the V1 demo](https://img.youtube.com/vi/5io6ZrWCPIw/maxresdefault.jpg)](https://youtu.be/5io6ZrWCPIw)

▶️ V1 — Evidence Mapping & Knowledge Tree

[![Watch the V2 demo](https://img.youtube.com/vi/V8uTbUVssmI/maxresdefault.jpg)](https://youtu.be/V8uTbUVssmI)

▶️ V2 — Paper Pipeline + ARS Integration

---

## Features

### Evidence Mapping
- Area/industry selector (General · Biology · Chemistry · Technology · Finance) with per-domain word clouds
- Custom topic search: type 2–5 words → Groq generates a live keyword cloud centered on your topic
- **Explore toggle**: switch the word cloud to subscription mode — clicking a word subscribes to weekly papers instead of launching a research run
- Real-time knowledge tree built from peer-reviewed papers, datasets, and social signals
- **Node-aware Explore Papers**: click any tree node to scope paper fetching to that node's topic; results show node-connection badges
- Hub-and-spoke Paper Map: Research hub at center, weighted lines to each paper, no visual clutter between peers
- Paper Compare Mode: pick 2 papers → Claude generates methodology differences + research gap analysis
- Node-level detail: methods, findings, disagreements, open problems

### Weekly Paper Subscription
- Subscribe to any topic (from the word cloud or Knowledge Tree) for a weekly digest of the latest papers
- Choose delivery time (8 AM / 12 PM / 6 PM / 9 PM) and number of papers (5 / 10 / 20) per week
- First digest sent immediately on subscribe; subsequent digests delivered every Monday via Vercel Cron
- Papers sourced from OpenAlex + PubMed, filtered to the last 2 years, ranked by relevance + recency
- One-click unsubscribe link in every email; branded confirmation page

### Notebook & Topic Copilot
- AI-assisted brainstorm with streaming responses
- Converge to Top 3 research ideas from your exploration
- Export brainstorm as Markdown

### Paper Pipeline
- **Idea selection** — picks from your converged ideas, knowledge tree nodes, or raw topic
- **Find Papers** — dedicated tab to search OpenAlex + PubMed with editable query; relevance + recency ranked
- **Paper Outline** — Groq-powered IMRaD outline generation
- **ARS Plan Mode** — in-app Socratic planning chat powered by Claude (`/ars-plan` workflow)
  - Session caching: resume previous sessions automatically; restart clears the cache
  - Reference Document: attach a `.md` draft or notes for Claude to reference during planning
  - Full context import: topic, peer-reviewed literature, and selected idea injected into every session
- **Export to Claude Code** — generate a structured context file and continue with the full 12-agent ARS pipeline

### Research Management
- `/jobs` page listing all past research runs with status, source counts, and actions
- Per-job: View Research · Write Paper · Delete
- One-click navigation back to Knowledge Tree, Notebook, or Paper Map from the paper session

---

## Quick Start

### One-command install

```bash
make laptop-install
```

Then start the app and worker in two terminals:

```bash
make dev
make worker
```

Open http://localhost:3000

### Manual setup

1. Install dependencies: `npm install`
2. Create `.env.local` with:
   ```env
   DATABASE_URL="postgresql://postgres:postgres@localhost:5433/hypothesis_atlas?schema=public"
   REDIS_URL="redis://localhost:6379"
   GROQ_API_KEY="your_groq_api_key_here"
   ANTHROPIC_API_KEY="sk-ant-..."        # required for ARS Plan Mode
   RESEND_API_KEY="re_..."               # required for weekly digest emails
   NEXT_PUBLIC_APP_URL="http://localhost:3000"  # used in email unsubscribe links
   ```
3. Start infrastructure: `make infra-up`
4. Push schema: `make db-push`
5. Start app and worker: `make dev` and `make worker`

> `ANTHROPIC_API_KEY` is only required for the in-app ARS Plan chat. All other features work without it.

---

## Usage

1. Visit `/explore`, choose a domain, and click a term in the word cloud
2. Watch the real-time evidence gathering in the Knowledge Tree
3. Open the **Notebook** tab → brainstorm → **Converge to Top 3** ideas
4. Click **Write Paper** in the tab bar → select an idea → plan and draft with ARS
5. Optionally export context and continue in Claude Code with `/ars-full`

### Paper Pipeline flow

```
/explore  →  /job/[id]  →  /job/[id]/paper
              (Knowledge Tree, Notebook, Paper Map)
                                ↓
                        1. Select Idea
                        2. Paper Outline  (optional — Groq)
                        3. Write Paper    (ARS Plan chat — Claude)
                                ↓
                     Export → Claude Code /ars-full
```

---

## ARS Integration

This app integrates with the [Academic Research Skills](https://github.com/Imbad0202/academic-research-skills) Claude Code plugin suite (original by Cheng-I Wu; adapted at [luxinlabs/academic-research-skills](https://github.com/luxinlabs/academic-research-skills)):

| In-app feature | ARS equivalent |
|---|---|
| ARS Plan chat (step 3) | `/ars-plan` Socratic planning mode |
| Paper Outline (step 2) | `/ars-outline` |
| Export context → Claude Code | `/ars-full` full 12-agent pipeline |

To use the full pipeline outside the app:
```
/plugin marketplace add Imbad0202/academic-research-skills
/plugin install academic-research-skills
```

---

## Deployment

Production requires separate services:

- **Web app**: Deploy to Vercel with env vars set
- **Worker**: Deploy to Railway/Render (runs `npm run worker`)
- **Database**: Managed PostgreSQL (Neon/Supabase)
- **Queue**: Managed Redis (Upstash)

Push schema to production: `DATABASE_URL="prod_url" npm run db:push`

---

## Development

```bash
# Database studio
npm run db:studio

# Reset database
docker-compose down -v && docker-compose up -d && npm run db:push
```

---

## Version History

### V2.4 — Comprehension Quiz, UI Polish & Prisma Pool Fix

- **"Test Your Understanding" quiz** on every knowledge tree node: click the button in NodeDetail to generate 4 multiple-choice questions grounded in the actual papers and findings discovered for that node — powered by Groq; includes per-question feedback and a score summary screen
- **Paper Quiz** in the Paper Pipeline: a "Quiz" button in the step tabs bar generates 4 comprehension questions drawn from the job's real evidence — root node synthesis, child subtopic findings, and linked peer-reviewed paper abstracts; slide-in panel with the same question flow and scoring
- Questions are strictly grounded in the actual evidence: a dedicated system prompt instructs Groq never to introduce concepts outside the provided content block; each finding, method, paper, and subtopic is labelled (F#/M#/P#/S#) and every question must cite a specific label — eliminating hallucinated generic questions
- **Subscribe button** on the Explore page replaced with a compact bell icon (same action; saves space in the selected-topic card)
- **"Explore Papers" button** in the Knowledge Tree simplified to "Explore"
- **Prisma P2024 fix**: `prisma.ts` now appends `connection_limit=5&pool_timeout=30` to `DATABASE_URL` at startup (if not already set), preventing connection pool exhaustion under dev hot-reloads and concurrent requests

#### New API routes (V2.4)

| Route | Method | Purpose |
|---|---|---|
| `/api/nodes/[nodeId]/questions` | GET | Generate 4 MCQs from node content + linked paper snippets |
| `/api/jobs/[id]/questions` | POST | Generate 4 MCQs from job evidence (root node, subtopics, sources) |

### V2.3 — Node-Aware Explore Papers & Weekly Paper Subscription

- **Node-aware Explore Papers** (Knowledge Tree): clicking a tree node sets it as the active search topic (shown as an indigo chip in the toolbar); "Explore Papers" fetches papers ranked specifically for that node's label rather than the job root topic
- **Explore toggle** (word cloud page): a pill toggle (default OFF) switches the word cloud from "launch research" mode to "subscribe" mode — clicking a word in Explore mode shows a subscribe card instead of navigating to a job
- **Weekly paper subscription**: Subscribe button in the Knowledge Tree toolbar and the Explore page opens a popup with:
  - Topic chip (auto-filled from selected node or searched term)
  - Email input
  - Papers per week selector: 5 / 10 / 20
  - Delivery time picker: 8 AM / 12 PM / 6 PM / 9 PM (every Monday)
- **Immediate first digest**: on subscribe, the API fetches the top N ranked papers for the topic right now and emails them instantly via Resend — same styled HTML digest as the weekly version
- **Weekly digest cron**: `vercel.json` registers a Vercel Cron (`0 * * * 1` — every hour on Mondays) that calls `GET /api/cron/weekly-digest`; the route matches subscriptions by delivery time (UTC hour), fetches fresh papers, and sends the weekly digest email
- **One-click unsubscribe**: every digest email contains a tokenised unsubscribe link (`/api/subscriptions/unsubscribe?token=...`) that deletes the subscription and redirects to a branded `/unsubscribed` confirmation page (handles success, already-used, and error states)
- **Latest papers only**: OpenAlex and PubMed queries are now filtered to the last 2 years (`currentYear-2` to `currentYear`) with `sort=publication_date:desc`; recency scoring window tightened from 10 years to 2 years so 2026 papers rank first
- **Email shows exact subscribe time**: the digest banner includes the timestamp when the user clicked Subscribe and the paper year range (e.g. "2025–2026")
- **`PaperSubscription` model**: stores `email`, `topic`, `frequency`, `deliveryTime`, `unsubToken` (unique cuid for unsubscribe links), `createdAt`
- **Shared `fetchTopicPapers()` utility** (`src/lib/fetchTopicPapers.ts`): extracted from the search-papers route so both in-app Explore Papers and email digests use the same ranking logic

#### Required environment variables (new in V2.3)

| Variable | Purpose |
|---|---|
| `RESEND_API_KEY` | Resend API key for sending digest and confirmation emails |
| `NEXT_PUBLIC_APP_URL` | App base URL used in email links (e.g. `http://localhost:3000` for dev, your Vercel URL for prod) |

### V2.2 — Notes System, Find Papers & Knowledge Tree Paper Exploration

- **Persistent notes system**: all notes stored in `localStorage` per job, synced across tabs via `atlas:notes-update` event; shared by NotesPanel, NotesTab, PaperMap compare, and Topic Copilot
- **Floating NotesPanel**: slide-in drawer (bottom-right) with entry list, type badges (session / manual / comparison / insight), expand/collapse, delete, textarea + Add Note, Export .md
- **Dedicated Notes tab**: 2-column layout — entry timeline left, detail viewer / composer right; session memory card shows topic + entry counts; quick-capture labels; inline edit & delete
- **Paper compare → notes**: Save to Notes button in compare panel writes a structured markdown comparison directly into the session notes
- **Topic Workspace redesign**: removed Pages sidebar; inline action toolbar (Write Paper · Export .md · Converge · Save to Notes) replaces floating bottom-right buttons; prominent "Type a topic and press Enter…" input at top of sidebar
- **Write Paper — Find Papers tab**: editable description field (defaults to job topic), "Explore Papers" button searches OpenAlex + PubMed, results ranked by relevance + recency (65 / 35 blend)
- **Knowledge Tree — Explore Papers**: new button in toolbar fetches related papers and displays them below the tree as a card grid; each card shows a **node-connection badge** (colour-matched to tree depth) indicating which tree node the paper connects to
- **Relevance + recency ranking**: title match (×4) + abstract match (×1) + title-start bonus (×3), blended with a 10-year recency window; applies to all paper search endpoints
- **Layout fixes**: NotebookTab and NotesTab now fill full viewport width; floating Write Paper / Export buttons moved to inline toolbar
- Write Paper: floating Notes panel + ← Back button in header

### V2.1 — Smart Explore, Hub-Spoke Paper Map & Paper Comparison
- **Custom topic search**: type 2–5 words, click Search → Groq generates a live word cloud with your keyword pinned at center and 16 related terms around it
- **Area / industry selector**: General (cross-domain, default), Biology, Chemistry, Technology, Finance — word cloud updates per domain; General triggers LLM keyword generation
- **Hub-and-spoke Paper Map**: Research hub at center with weighted lines to every paper (line width & opacity = knowledge-node count); no peer-to-peer lines cluttering the graph
- **Paper Compare Mode**: select any 2 papers → Claude returns a structured comparison of (1) methodology differences and (2) research gaps, with a combined-opportunity insight
- **Richer paper detail panel**: full abstract, publication year, stats row, "Read Paper ↗" button, venue + year on related papers
- Pricing: free & open-source; $100 / paper for hosted workflow with managed tokens

### V2 — Paper Pipeline + ARS Integration
- In-app ARS Plan chat powered by Claude (`/ars-plan` Socratic planning mode)
- Idea selection from converged ideas, knowledge tree nodes, or raw topic
- Paper Outline generation via Groq (IMRaD structure)
- Session caching: resume previous ARS sessions; restart clears the cache
- Reference Document: attach `.md` drafts or notes for Claude to reference during planning
- `/jobs` research management page: list, view, write, delete all past runs
- Knowledge Tree, Notebook, and Paper Map accessible directly from the paper session
- Export context to Claude Code for the full 12-agent ARS pipeline

### V1 — Evidence Mapping & Knowledge Tree
- Word cloud topic explorer across Biology, Chemistry, Technology, and Finance
- Real-time knowledge tree built from peer-reviewed papers, datasets, and social signals
- Reliability-tiered Paper Map (SVG network graph)
- Notebook & Topic Copilot with AI-assisted brainstorm and Converge to Top 3

---

## Contributing

See `CONTRIBUTING.md`.

## Security

See `SECURITY.md` for responsible disclosure.

---

## License

### Hypothesis Atlas

MIT License — see `LICENSE` file.

### Academic Research Skills (ARS) Plugin

The in-app ARS Plan feature integrates the [Academic Research Skills](https://github.com/Imbad0202/academic-research-skills) plugin originally created by **Cheng-I Wu**, licensed under **CC-BY-NC 4.0**.

This work is licensed under [CC-BY-NC 4.0](https://creativecommons.org/licenses/by-nc/4.0/).

You are free to:
- **Share** — copy and redistribute the material
- **Adapt** — remix, transform, and build upon the material

Under the following terms:
- **Attribution** — You must give appropriate credit
- **NonCommercial** — You may not use the material for commercial purposes

**Attribution:**

> Based on [Academic Research Skills](https://github.com/Imbad0202/academic-research-skills) by Cheng-I Wu
> https://github.com/Imbad0202/academic-research-skills

#### ARS Learning Resources

The ARS repository also includes structured learning materials covering the full academic research workflow — from Socratic research planning and systematic literature review to multi-agent peer review and publication-ready formatting. If you want to go deeper into the methodology behind the pipeline embedded in this app, visit:

- **Plugin docs**: [`docs/ARCHITECTURE.md`](https://github.com/Imbad0202/academic-research-skills/blob/main/docs/ARCHITECTURE.md)
- **Setup guide**: [`docs/SETUP.md`](https://github.com/Imbad0202/academic-research-skills/blob/main/docs/SETUP.md)
- **Full repo**: https://github.com/Imbad0202/academic-research-skills
