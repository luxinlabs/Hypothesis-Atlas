import { NextResponse } from 'next/server'
import { isRateLimited, RATE_LIMIT_MAX_REQUESTS_PER_MIN } from './lean'

/**
 * Shared request guards for the Experiments verify/formalize routes
 * (formalize, prove, verify-physics, verify-protocol). Each one previously
 * hand-copied the same "is a provider configured" and "is this job rate
 * limited" checks with identical wording and status codes — centralized
 * here so a future change to either message only needs to happen once.
 * Each returns a ready-to-send NextResponse on failure, or null to
 * continue — call as `guard(...) ?? guard(...)` and return the first
 * non-null result.
 */
export function configuredOrError(configured: boolean, envVarName: string): NextResponse | null {
  if (configured) return null
  return NextResponse.json(
    { error: `${envVarName} is not configured. Add it to your .env.local file.` },
    { status: 503 }
  )
}

export function rateLimitOrError(jobId: string): NextResponse | null {
  if (!isRateLimited(jobId)) return null
  return NextResponse.json(
    { error: `Too many requests for this job — wait a minute and try again (limit: ${RATE_LIMIT_MAX_REQUESTS_PER_MIN}/min).` },
    { status: 429 }
  )
}
