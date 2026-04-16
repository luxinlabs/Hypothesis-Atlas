# Hypothesis Atlas

A biotech research evidence mapping platform that automatically discovers, analyzes, and visualizes scientific knowledge from multiple sources including peer-reviewed papers, datasets, and social signals.

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
2. Create `.env` with:
   ```env
   DATABASE_URL="postgresql://postgres:postgres@localhost:5433/hypothesis_atlas?schema=public"
   REDIS_URL="redis://localhost:6379"
   GROQ_API_KEY="your_groq_api_key_here"
   ```
3. Start infrastructure: `make infra-up`
4. Push schema: `make db-push`
5. Start app and worker: `make dev` and `make worker`

## Usage

1. Visit `/explore` and click a term in the word cloud
2. Watch the real-time evidence gathering
3. Explore the knowledge tree and detailed analysis
4. Use the Notebook & Topic Copilot for research notes and AI assistance

## Deployment

Production requires separate services:

- **Web app**: Deploy to Vercel with env vars set
- **Worker**: Deploy to Railway/Render (runs `npm run worker`)
- **Database**: Use managed PostgreSQL (Neon/Supabase)
- **Queue**: Use managed Redis (Upstash)

Push schema to production: `DATABASE_URL="prod_url" npm run db:push`

## Development

```bash
# Database studio
npm run db:studio

# Reset database
docker-compose down -v && docker-compose up -d && npm run db:push
```

## Contributing

See `CONTRIBUTING.md`.

## Security

See `SECURITY.md` for responsible disclosure.

## License

MIT License - see `LICENSE` file.
