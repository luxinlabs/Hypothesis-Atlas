# Code Review Checklist

What to check before approving a PR, beyond "does it work." Each section
below is grounded in patterns already in this codebase — not generic
advice — so a reviewer can grep the examples and see exactly what's being
asked for.

This is a checklist to apply, not a gate that blocks every PR on every
item — use judgment on what's proportionate to the change's size and risk.

---

## 1. Duplication

Is the same logic, string, or decision written out more than once instead
of being defined in one place and reused?

**What to look for:**
- The same conditional/branching logic re-implemented in multiple files or
  functions instead of one shared function.
- The same literal string (an error message, a URL, a magic number) copied
  instead of a named constant.
- The same request/response shape hand-rolled in multiple API routes.

**Real example from this repo:** the math/physics/protocol domain dispatch
used to be independently re-implemented in four places — `ProveClaimPanel`'s
create/verify dispatch, its summary line, its render switch, and
`context.ts`'s result summary. Fixed by introducing `domainKind()` in
`src/lib/experiments/types.ts` as the single classification point (see
commit `2bc1d2e`). Four `formalize`/`prove`/`verify-*` routes also
hand-copied identical rate-limit and "provider not configured" checks;
fixed with `src/lib/experiments/guard.ts`.

**Ask:** if this domain/case/shape needs to change, how many files does
someone have to update, and would they know to find all of them?

---

## 2. Reuse of existing code

Does the change build on what's already in the codebase, or does it
reinvent something that already exists?

**What to look for:**
- A new helper that duplicates an existing one in `src/lib/` — search
  before writing.
- A new API route that re-implements a pattern (auth check, rate limit,
  error shape) an existing route already has, instead of extracting or
  calling into the existing implementation.
- A new UI component that duplicates styling/behavior an existing component
  already has (check `src/components/` first).

**Real example:** the chemistry-domain numeric checker
(`src/lib/experiments/numeric.ts`'s `toAsciiMath`/`closeEnough`) was
originally written once for math, then correctly *extracted and reused*
for the drug_discovery/biology/chemistry protocol checker rather than
copy-pasted — that's the pattern to hold new code to.

**Ask:** did the author search for an existing helper/pattern before writing
a new one? Is the new code positioned so the *next* similar feature will
reuse it, or did it get buried inside a component where nothing else can
find it?

---

## 3. Simplification

Is there a smaller, more direct way to write this that does the same thing?

**What to look for:**
- Unnecessary abstraction for something used exactly once (a factory,
  strategy pattern, or config object for one call site).
- Defensive code for a case that can't actually happen (validating a value
  that's already been validated one function up, or that TypeScript already
  guarantees).
- A multi-step manual implementation of something a library already does
  (see `src/lib/experiments/physics.ts`'s use of mathjs's own unit system
  for dimensional analysis, rather than hand-rolling unit conversion).
- Premature generalization: building a plugin system or registry for
  "future domains" before a second concrete case exists to generalize from.

**Ask:** could this be half as long without losing anything real? Is every
abstraction here earning its cost, or is it solving a problem that doesn't
exist yet?

---

## 4. Clarity

Would someone unfamiliar with this change understand *why* it's written
this way, not just *what* it does?

**What to look for:**
- Comments that restate what the code obviously does (delete them) vs.
  comments that explain a non-obvious constraint, a workaround, or "why not
  the simpler version" (keep and value these).
- Naming that requires reading the implementation to understand (a variable
  called `result2`, a function called `handleThing`).
- A PR description / commit message that states *why* the change was made,
  not just *what* changed — see this repo's commit history for the
  standard: every commit here explains the problem being fixed and what
  would go wrong without the fix, with a concrete example.
- Confirmed, not assumed: does the PR show evidence the behavior was
  actually exercised (a curl output, a screenshot, a test), or does it only
  claim correctness?

**Ask:** if this line breaks in six months, will the next person reading it
understand why it was written this way before they change it?

---

## 5. Security

Split into backend and frontend since the risks and reviewers differ.

### Backend

**SQL / database access**
- This project uses Prisma. Parameterized calls (`prisma.model.findMany`,
  `$queryRaw` tagged templates like `` prisma.$queryRaw`SELECT 1` `` in
  `src/app/api/health/route.ts`) are safe by construction — Prisma escapes
  the interpolated values.
- **`$executeRawUnsafe`/`$queryRawUnsafe` are a hard stop for review.**
  They take a plain string, not a tagged template — if any part of that
  string is built from user input (not just a hardcoded literal), it's SQL
  injection. If a PR introduces either, the review must trace every value
  in the query string back to its origin and confirm none of it is
  user-controlled.
- Any new raw SQL at all should be justified in the PR description — Prisma
  covers the vast majority of legitimate cases.

**Session / auth / data isolation**
- **Known gap, not yet fixed:** the standalone `/experiments` page
  (`src/app/experiments/page.tsx`) passes a single hardcoded `jobId` for
  every visitor, and every Experiments API route scopes data by that jobId
  alone with no per-user key or auth check. Two different visitors can
  read, rename, and delete each other's sessions and claims today. This is
  tracked in issue #36 (user management strategy) — any new Experiments
  route should be written with the expectation that real ownership checks
  land eventually, and should not add *more* surface area that assumes a
  single shared identity.
- Once auth exists: every new route that reads/writes a resource scoped to
  a user must filter by the authenticated user's id, not just an
  opaque/guessable id in the URL. Test this by asking "what happens if I
  change this id in the URL to someone else's?"
- Rate limiting: this project's rate limiter
  (`src/lib/experiments/lean.ts`'s `isRateLimited`) is in-memory and keyed
  by jobId. It resets on redeploy and never evicts old entries — acceptable
  for a soft, best-effort guard on an experimental feature, not acceptable
  as the only protection on anything that costs real money per call (LLM
  tokens, paid APIs) at scale.

**Input validation**
- Every API route should validate the shape of `request.json()` before
  using it — this codebase's convention is `.catch(() => ({}))` plus
  explicit `if (!field) return 400` checks (see any `route.ts` under
  `src/app/api/jobs/[id]/experiments/`). A PR that trusts a request body
  field without a presence/type check should be flagged.
- Watch for values passed straight into a template string that's later
  `eval`-adjacent — this project uses `mathjs`'s `evaluate()` on
  LLM-extracted expressions (`src/lib/experiments/physics.ts`,
  `numeric.ts`). mathjs's evaluator is not a general JS `eval` (no arbitrary
  code execution), but any *new* use of a real `eval`/`Function()`
  constructor on external input is an automatic block.

**Secrets / environment variables**
- Secrets (`ANTHROPIC_API_KEY`, `GROQ_API_KEY`, `DATABASE_URL`) must only be
  read server-side (`process.env.X` in a route handler or server component),
  never referenced from a Client Component or exposed via a
  `NEXT_PUBLIC_*` variable unless it is genuinely meant to be public.
- Never log a full request body or error object that might contain a
  secret or a user's full API key. Check what a new `console.error`/`log`
  call actually prints.
- A missing-config error message should say *which* env var is missing
  (see `configuredOrError` in `src/lib/experiments/guard.ts`) without
  echoing back any part of a real secret value.

### Frontend

**XSS / untrusted HTML**
- `dangerouslySetInnerHTML` appears in exactly one place in this codebase:
  `src/components/MathText.tsx`, rendering KaTeX's own HTML output. This is
  a deliberate, reviewed exception — KaTeX's renderer doesn't execute
  arbitrary HTML/script from its input in the way raw `innerHTML` of
  user text would. **Any new `dangerouslySetInnerHTML` usage must be
  justified in the PR**: what's the HTML source, is it actually trusted
  (a known library's sanitized output) or could it contain
  user-authored/LLM-authored content that hasn't been sanitized?
- LLM output rendered as UI copy (claim summaries, flag reasons, Lean
  diagnostics) is currently rendered as plain React children (auto-escaped
  by React), not as HTML — keep it that way. If a future change renders LLM
  output as HTML/Markdown, that's a new XSS surface and needs explicit
  sanitization (e.g. DOMPurify), not just "the model won't do that."

**CSRF / cross-origin**
- No CSRF tokens or CORS configuration currently exist in this project —
  API routes are same-origin Next.js routes with no cookie-based session to
  forge a request against yet. This assumption breaks the moment
  cookie-based auth (issue #36) lands: at that point, state-changing routes
  (POST/PATCH/DELETE) need CSRF protection or must rely on
  `SameSite=Strict/Lax` cookies plus origin checks. Flag any PR that adds
  cookie-based auth without addressing this.

**Client-side secrets**
- Nothing under `src/components/` or `src/app/**/page.tsx` (Client
  Components) should import or reference a non-`NEXT_PUBLIC_` env var —
  it won't work, but if someone works around it (e.g. hardcoding a key
  temporarily to "make it work"), that's a shipped secret.

**Third-party requests from the client**
- API calls to external services (PubChem in
  `src/lib/experiments/pubchem.ts`, the Lean checker) are made
  server-side, from route handlers — keep new integrations there rather
  than calling third-party APIs directly from client components, which
  would expose any API key involved and bypass this project's rate
  limiting.

---

## Using this checklist

- For a small PR, skim all five sections; most won't apply.
- For anything touching `src/app/api/**` or handling any external input
  (LLM output, user text, a third-party API response), the Security section
  is not optional — go through it explicitly.
- If a finding doesn't block the PR but shouldn't be forgotten, file an
  issue for it rather than letting it live only in a review comment.
