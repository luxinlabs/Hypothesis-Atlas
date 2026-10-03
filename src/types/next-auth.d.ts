// SPDX-License-Identifier: AGPL-3.0-only
import type { DefaultSession } from 'next-auth'

/**
 * NextAuth's default `Session.user` has no `id` — lib/auth.ts's `session`
 * callback adds one from the JWT so API routes can scope queries by it
 * (future phases of #36/V3.6: ownership enforcement). This augmentation
 * makes that field visible to TypeScript everywhere `useSession()`/
 * `getServerSession()` is used, instead of every call site casting it.
 */
declare module 'next-auth' {
  interface Session {
    user: {
      id: string
    } & DefaultSession['user']
  }
}
