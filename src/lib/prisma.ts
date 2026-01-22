import { PrismaClient } from '@prisma/client'

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
}

// Check if DATABASE_URL is available
if (!process.env.DATABASE_URL) {
  console.error('DATABASE_URL environment variable is not set!')
}

// Create Prisma Client - it will use DATABASE_URL from environment
export const prisma = globalForPrisma.prisma ?? new PrismaClient()

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma
