# V3 Planning — Experiments Module (starting with Mathematics)

Status: research complete, no code/branch changes made yet. This doc is the output
of a scoping pass done in a separate session before implementation begins.

## Where we're starting from (V2.x today)

- `src/components/ExperimentsPanel.tsx` + `src/app/api/jobs/[id]/experiments/verify/route.ts`
  already do a first version of "experiments": they pull an assistant-generated
  experiment plan, extract up to 5 quantitative claims via Groq, and check them
  numerically with **mathjs** (`math.evaluate`, with a `math.simplify` symbolic
  fallback when the numeric check fails). This is arithmetic/numeric verification,
  not proof — it can catch "0.843 − 0.812 ≠ 0.031" but can't check a derivation or
  a symbolic argument.
- `src/components/MathText.tsx` already renders `$...$` / `$$...$$` LaTeX via
  **KaTeX** (`katex` + `@types/katex` in package.json, `mathjs` v15 also present).
  So LaTeX *display* is solved; LaTeX *authoring → verified proof* is not.
- V3's stated purpose: turn "Experiments" into a real module, starting with
  mathematics (proofs), with the architecture built so physics/bio/chemistry
  experiment types can be added on top of the same scaffold later.

## Landscape survey: math proof tooling (as of Sep 2026)

### Interactive proof assistants (the ground truth checkers)
- **Lean 4 + Mathlib** — current default choice for LLM-assisted proof work; huge
  active corpus (Mathlib), strong tooling ecosystem, is what nearly all the newer
  LLM provers below target.
- **Coq / Rocq** (Rocq is the 2025 rename of Coq) — mature, large legacy library
  (mathcomp), less LLM tooling momentum than Lean right now.
- **Isabelle/HOL** — strong automation (Sledgehammer), good for classical
  analysis-style proofs, smaller LLM-prover ecosystem than Lean.
- Recommendation: **target Lean 4 first** — best LLM-prover coverage, active
  benchmark ecosystem (miniF2F, PutnamBench), and it's what SorryDB/Mathlib CI
  tooling assumes.

### LLM-based / neural theorem provers (open source, actively developed in 2026)
- **DeepSeek-Prover-V2** — synthetic proof data + RL with explicit subgoal
  decomposition; ~88.9% on miniF2F. Open weights.
- **Goedel-Prover-V2** — expert iteration + scaffolded data synthesis +
  verifier-guided self-correction.
- **BFS-Prover** — shows plain best-first search with good heuristics can beat
  MCTS/value-function approaches; simpler to self-host.
- **AlphaProof** (DeepMind) — AlphaZero-style RL on auto-formalized problems +
  test-time RL; not open-weight, but its approach (informal→formal→search)
  is the reference architecture.
- **AxiomProver** (Axiom Math) — autonomous multi-agent ensemble prover for
  Lean 4; used to close a handful of previously-open small problems in 2026,
  fully verified in Mathlib.
- **UlamAI Prover** — open-source CLI, LLM-driven proof-strategy generation for
  Lean 4; lighter-weight, easier to evaluate first.

### Autoformalization (natural language ⇄ formal Lean) — the actual gap we have
This is the piece our app doesn't have at all yet, and it's the bridge between
"user writes a proof in plain LaTeX/English in the app" and "a checker verifies
it." Relevant 2026 work:
- **AutoformBot** — multi-agent system formalizing whole textbooks into Lean 4
  at scale (interesting naming coincidence: their corpus project is literally
  called "ATLAS," unrelated to this repo).
- **Prove2Me** — open collaborative platform for math formalization with AI
  agents as first-class contributors; closest existing analogue to what we'd
  want for a "community/user submits, agents help formalize" flow.
- **SorryDB** — benchmark/dataset of real Lean theorems with `sorry` placeholders,
  used to test whether provers can actually complete real in-the-wild proofs
  (not just curated benchmarks) — good target for an internal eval harness.

### Supporting infra (glue we'd actually build on)
- **LeanDojo** — Python interface to Lean proof states + premise retrieval over
  Mathlib; this is the most likely integration point for calling into Lean from
  a Node/Next.js backend (via a Python microservice or subprocess).
- **Lean Copilot** — in-editor LLM tactic suggestions; less relevant server-side.
- **PyPantograph** — another Lean↔Python bridge, alternative to LeanDojo.

### Benchmarks (for internal eval once we build something)
- **miniF2F** — competition-style formalized problems, standard prover benchmark.
- **PutnamBench** — Putnam-competition-level formalized problems.
- **MathlibPR** — merge-readiness benchmark for formal-library PRs (useful if we
  ever accept user-formalized lemmas back into a shared library).

## What this means for our architecture

The realistic V3 pipeline for a math "experiment":
1. User states a claim/proof sketch in natural language + LaTeX (already renderable
   via `MathText.tsx`).
2. An LLM step *autoformalizes* it into Lean 4 syntax (new — needs a prompt/agent,
   informed by Prove2Me/AutoformBot patterns: give the model Mathlib-relevant
   context/premises, not a blind translation).
3. A **real Lean 4 + Mathlib toolchain** (not just an LLM claiming success) checks
   the formalized statement — this needs a sandboxed Lean execution environment
   (likely a small containerized service, since Lean isn't natively available in
   the Next.js/Node runtime). LeanDojo or PyPantograph is the natural bridge if we
   front it with a lightweight Python service.
4. If it fails, either surface the Lean error to the user/LLM for another attempt
   (bounded retries, à la BFS-Prover-style search) or fall back to reporting
   "not verified" rather than silently downgrading to a numeric-only check.
5. Numeric-only claims (current `mathjs` behavior) stay as a fast-path for plans
   that are purely arithmetic — full Lean verification is for actual proofs/derivations.

This is a meaningfully bigger lift than the current mathjs panel (it requires
standing up a Lean toolchain somewhere), so V3 should scope an MVP rather than
the full pipeline above on day one.

## To-do list for V3

### Phase 0 — scaffolding & decisions
- [ ] Create `version-3` branch off `main` (mirrors `version-1`/`version-2.x` convention).
- [ ] Decide hosting for the Lean toolchain: sandboxed container/service (e.g. a
      small Fly.io/Railway box running `elan` + Lean 4 + a pinned Mathlib checkout)
      vs. calling an external hosted Lean-checking API if one exists with acceptable
      terms. Self-hosting is safer for an experimental feature with unknown load.
- [ ] Decide the Python↔Lean bridge: LeanDojo vs. PyPantograph (LeanDojo has more
      Mathlib retrieval tooling; PyPantograph is lighter-weight — spike both against
      a trivial theorem before committing).
- [ ] Define what "domain" means in the data model now (`Experiment { domain: 'math' | 'physics' | 'bio' | 'chemistry', ... }`)
      so math isn't hardcoded in a way that has to be ripped out later.

### Phase 1 — mathematics MVP
- [ ] Extend `ExperimentsPanel` (or split into a new `ProofExperimentsPanel`) to
      accept a proof/claim in LaTeX + natural language, not just numeric plans.
- [ ] Build the autoformalization step: LLM prompt that turns the LaTeX/NL claim
      into a Lean 4 theorem statement + proof attempt, with Mathlib premise context
      (start simple: no retrieval, just a system prompt with common Mathlib idioms;
      add LeanDojo-style premise retrieval only if accuracy is too low without it).
- [ ] Stand up the Lean verification service (containerized `elan` + Lean + Mathlib,
      exposes a minimal HTTP endpoint: `{lean_code} -> {success, errors, sorry_count}`).
- [ ] New API route, e.g. `src/app/api/jobs/[id]/experiments/prove/route.ts`, that
      orchestrates: NL/LaTeX claim → autoformalize → call Lean service → return
      verified/failed/partial (has `sorry`) with the Lean error surfaced to the UI.
- [ ] UI: show the generated Lean code (collapsible, for transparency/trust), pass/fail
      badge, and the raw Lean error on failure — don't just say "not verified."
- [ ] Bounded retry loop: on failure, feed the Lean error back to the LLM for one or
      two more attempts before giving up (keep cost/latency bounded — this is the
      most expensive part of the feature).
- [ ] Internal eval set: 10–20 hand-picked claims of increasing difficulty (a few
      trivial algebra identities, a few real induction/analysis proofs) to sanity-check
      the pipeline before shipping; consider sampling a few from SorryDB/miniF2F style
      problems for calibration.
- [ ] Keep the existing mathjs numeric-claim path as the fast/cheap path for plans
      that are purely arithmetic (don't force everything through Lean).

### Phase 2 — polish & guardrails
- [ ] Timeout + resource limits on the Lean service (proof search can hang; cap
      wall-clock time per attempt).
- [ ] Cost/rate controls on the autoformalization LLM calls (this is easy to spam).
- [ ] Decide what "partial success" looks like in the UI (Lean proof compiles but
      contains `sorry` — i.e., the statement is well-formed but not fully proved).
- [ ] Write up the feature in README (V3 changelog section, same pattern as V2.1–V2.5).

### Phase 3 — extensibility groundwork for other domains
- [ ] Confirm the `Experiment.domain` schema/UI split cleanly supports adding a
      second domain without touching the math code path (this is the real test of
      whether Phase 0's data model held up).
- [ ] Physics: likely needs numeric/simulation verification (e.g. checking a
      derivation's units + a numeric simulation, not a Lean proof) — different
      verification backend from math, same UI shell.
- [ ] Biology/Chemistry: likely experiment *design* review (protocol sanity-checking,
      reagent/dose math) rather than formal proof — closer to the existing mathjs
      numeric-claim checker than to Lean. Don't force a proof-assistant model onto
      domains where it doesn't fit; "verification" should mean different things per
      domain and the architecture should allow that explicitly rather than
      generalizing prematurely from the math case.

## Open questions to resolve before Phase 1 starts
1. Who hosts/pays for the Lean toolchain service, and what's the expected load
   (this is not a cheap thing to run per-request if proof search is involved)?
2. Do we want user-submitted formalizations to ever be contributed back anywhere
   (a shared library, à la Prove2Me), or is this purely per-user/per-job verification
   with no persistence beyond the job?
3. What's acceptable latency for a "verify this proof" click — seconds (autoformalize
   + typecheck only, no search) or minutes (allow bounded automated proof search)?

## Sources consulted
- [Discover and Prove: An Open-source Agentic Framework for Hard Mode Automated Theorem Proving in Lean 4](https://arxiv.org/pdf/2604.15839)
- [SorryDB: Can AI Provers Complete Real-World Lean Theorems?](https://arxiv.org/pdf/2603.02668)
- [Prove2Me: An Open Collaborative Platform for Scaling Math Formalization](https://arxiv.org/html/2608.28433v1)
- [QED: An Open-Source Multi-Agent System for Generating Mathematical Proofs on Open Problems](https://arxiv.org/pdf/2604.24021)
- [AxiomProver: AI-Generated Mathematical Proofs (2026)](https://wal.sh/research/axiomprover-2026/)
- [UlamAI Prover: Teaching AI to Prove Math Theorems](https://pchojecki.medium.com/ulamai-prover-teaching-ai-to-prove-math-theorems-e2f548f81c55)
- [Process-Driven Autoformalization in Lean 4](https://arxiv.org/pdf/2406.01940)
- [Automatic Textbook Formalization (AutoformBot)](https://arxiv.org/pdf/2604.03071)
- [Evaluating the Robustness of Proof Autoformalization in Lean 4](https://arxiv.org/pdf/2606.14867)
- [Formalizing Mathematics at Scale](https://arxiv.org/html/2605.29955v1)
