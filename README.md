# Hypothesis Atlas

HEPOPS Atlas (Hypothesis Atlas) is a multi-domain evidence mapping platform that automatically discovers, analyzes, and visualizes scientific and technical knowledge from multiple sources including peer-reviewed papers, datasets, and social signals.

It now includes a full **Academic Paper Pipeline** powered by the [ARS (Academic Research Skills)](https://github.com/luxinlabs/academic-research-skills) plugin — letting you go from a research topic all the way to a structured paper draft without leaving the app.

## Demo Video

[![Watch the demo](https://img.youtube.com/vi/5io6ZrWCPIw/maxresdefault.jpg)](https://youtu.be/5io6ZrWCPIw)

▶️ Click the image above to watch the demo.

---

## Features

### Evidence Mapping
- Word cloud topic explorer across Biology, Chemistry, Technology, and Finance domains
- Real-time knowledge tree built from peer-reviewed papers, datasets, and social signals
- Reliability-tiered source visualization (Paper Map — SVG network graph)
- Node-level detail: methods, findings, disagreements, open problems

### Notebook & Topic Copilot
- AI-assisted brainstorm with streaming responses
- Converge to Top 3 research ideas from your exploration
- Export brainstorm as Markdown

### Paper Pipeline (new)
- **Idea selection** — picks from your converged ideas, knowledge tree nodes, or raw topic
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
   ANTHROPIC_API_KEY="sk-ant-..."   # required for ARS Plan Mode
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

This app integrates with the [luxinlabs/academic-research-skills](https://github.com/luxinlabs/academic-research-skills) Claude Code plugin suite:

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

## Contributing

See `CONTRIBUTING.md`.

## Security

See `SECURITY.md` for responsible disclosure.

## License

MIT License — see `LICENSE` file.
