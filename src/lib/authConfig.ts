// SPDX-License-Identifier: AGPL-3.0-only

/**
 * #36/V3.6 phase 3: the self-hosted-vs-hosted login requirement, as a
 * concrete flag rather than a hardcoded assumption either way (per the
 * issue's decision #2). Self-hosted (AGPL, one person running their own
 * instance) has no reason to require login — it's already single-tenant by
 * deployment, so this defaults to `false`/unset. The hosted deployment sets
 * `REQUIRE_AUTH=true` in its own environment to require an account before
 * starting new research (billing, per-user API key management, "my
 * research" scoping — see the issue's context).
 *
 * Server-side only (no `NEXT_PUBLIC_` prefix): the enforcement that matters
 * is in the API routes (POST /api/jobs, POST /api/bold-ideas), not a
 * client-side UI toggle that could be bypassed by calling the API directly.
 */
export function isAuthRequired(): boolean {
  return process.env.REQUIRE_AUTH === 'true'
}
