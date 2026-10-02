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
