// SPDX-License-Identifier: AGPL-3.0-only
import { PrismaAdapter } from '@next-auth/prisma-adapter'
import type { NextAuthOptions } from 'next-auth'
import CredentialsProvider from 'next-auth/providers/credentials'
import bcrypt from 'bcryptjs'
import { prisma } from './prisma'

/**
 * Phase 1 of #36/V3.6 (user management strategy): real accounts, replacing
 * AuthModal.tsx's fake setTimeout login. Credentials (email+password) is the
 * only provider for now — it matches the fields AuthModal already collects,
 * and needs no OAuth app registration to stand up. OAuth providers (Google/
 * GitHub, per the issue's recommendation) can be added to this `providers`
 * array later without touching anything else here.
 *
 * Session strategy is JWT, not database sessions: NextAuth's Credentials
 * provider doesn't support database sessions (there's no OAuth round-trip
 * for the adapter to hang a session off of) — JWT is the standard, supported
 * pairing. The Prisma adapter is still wired in so `Account`/future-OAuth
 * rows persist correctly if a provider is added.
 */
export const authOptions: NextAuthOptions = {
  adapter: PrismaAdapter(prisma),
  session: { strategy: 'jwt' },
  pages: {
    signIn: '/', // AuthModal is a modal, not a dedicated page — no custom /login route to redirect to.
  },
  providers: [
    CredentialsProvider({
      name: 'Email and password',
      credentials: {
        email: { label: 'Email', type: 'email' },
        password: { label: 'Password', type: 'password' },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) return null

        const user = await prisma.user.findUnique({ where: { email: credentials.email.toLowerCase() } })
        if (!user?.passwordHash) return null

        const valid = await bcrypt.compare(credentials.password, user.passwordHash)
        if (!valid) return null

        return { id: user.id, name: user.name, email: user.email, image: user.image }
      },
    }),
  ],
  callbacks: {
    // Carry the user id onto the JWT, then onto the session, so API routes
    // can scope queries by it once ownership enforcement (a later phase of
    // #36) lands — `session.user.id` doesn't exist by default with JWT
    // sessions.
    async jwt({ token, user }) {
      if (user) token.sub = user.id
      return token
    },
    async session({ session, token }) {
      if (session.user && token.sub) {
        session.user.id = token.sub
      }
      return session
    },
  },
}
