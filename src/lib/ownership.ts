// SPDX-License-Identifier: AGPL-3.0-only

/**
 * #36/V3.6 phase 4: the ownership rule applied across Job/BoldIdea routes.
 *
 * A resource with no owner (userId null — created anonymously, which is the
 * *only* way to create one on a self-hosted/no-auth-required deployment,
 * see phase 3's REQUIRE_AUTH flag) stays exactly as open as it is today:
 * anyone who has the id can read/write it. This is deliberate, not a gap
 * being left open — self-hosted, single-tenant-by-deployment usage has no
 * real ownership boundary to enforce, and changing that would break every
 * existing anonymous workflow.
 *
 * A resource that *does* have an owner (created by a signed-in user, which
 * only happens on deployments where accounts exist) is now actually
 * private to that owner — this is the real security gap #36 identified
 * ("anyone can GET/PATCH/DELETE any job... by id"), closed only for the
 * resources an account-holder actually created under their account.
 */
export function canAccessResource(resourceUserId: string | null, sessionUserId: string | undefined | null): boolean {
  if (!resourceUserId) return true
  return resourceUserId === sessionUserId
}

/**
 * The same rule as `canAccessResource`, as a Prisma `where` filter for list
 * endpoints — "show me what I can see" rather than "can I see this one
 * thing". Without this, a list route can return other accounts' owned
 * resources even though the single-resource route correctly 403s them
 * (exactly this mismatch was a real gap: GET /api/jobs returned every job
 * in the database regardless of owner).
 */
export function visibleToUserWhere(sessionUserId: string | undefined | null) {
  return sessionUserId ? { OR: [{ userId: null }, { userId: sessionUserId }] } : { userId: null }
}
