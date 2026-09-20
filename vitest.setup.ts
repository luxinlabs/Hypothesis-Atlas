// Ensure tests never accidentally hit real external services regardless of
// what a developer's local .env files contain.
delete process.env.GROQ_API_KEY
delete process.env.ANTHROPIC_API_KEY
delete process.env.REDIS_URL
delete process.env.REVIEW_NLI_ENDPOINT
delete process.env.RESEND_API_KEY
process.env.DATABASE_URL = 'postgresql://test:test@localhost:5432/test'
