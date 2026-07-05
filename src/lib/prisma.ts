import { PrismaClient } from '@prisma/client'

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
}

// Check if DATABASE_URL is available
if (!process.env.DATABASE_URL) {
  console.error('DATABASE_URL environment variable is not set!')
}

// Append connection pool settings to avoid P2024 timeout in dev/serverless.
// Defaults: connection_limit=5, pool_timeout=30.
function buildDatasourceUrl() {
  const base = process.env.DATABASE_URL
  if (!base) return undefined
  if (base.includes('connection_limit')) return base   // already configured
  const sep = base.includes('?') ? '&' : '?'
  return `${base}${sep}connection_limit=5&pool_timeout=30`
}

const datasourceUrl = buildDatasourceUrl()

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient(datasourceUrl ? { datasourceUrl } : undefined)

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma
