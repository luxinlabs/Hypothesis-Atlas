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

## Mass experiments — how others do it (research, Sep 2026)

Researched before designing a "mass experiment" feature (many claims / many
attempts, not one click). Everything below is from the linked sources; numbers
are theirs, on their hardware.

### 1. The standard architecture: a pool of persistent Lean REPLs behind HTTP
- **Kimina Lean Server** (Project Numina, MIT, Docker image `projectnumina/kimina-lean-server`)
  is the open-source reference. One persistent REPL process per core (a Lean
  process is single-threaded); requests are routed to an idle REPL; an LRU cache
  keyed on the file's *header* (its `import` lines) keeps warmed workers so
  `import Mathlib` is paid once. Knobs: `LEAN_SERVER_MAX_REPLS` (default CPUs-1),
  `LEAN_SERVER_MAX_REPL_MEM` (8G per REPL), `LEAN_SERVER_MAX_REPL_USES` (recycle
  after N uses), `LEAN_SERVER_MAX_WAIT` (60s queue wait), `LEAN_SERVER_INIT_REPLS`
  (pre-warm), optional API key. Runs commands with `gc: true` to drop
  environments and avoid OOM.
- Their benchmark (9,419 proofs, 72-vCPU box): 8 cores 42:40, 32 cores 11:33,
  64 cores 7:56 (0.051 s/proof); import caching alone is a 1.94x speedup.
- **What we have:** the single-worker version of this (one warm REPL, recycled
  after 100 commands, killed on timeout). Same design, no pool.

### 2. What companies run (Axiom's AXLE, Harmonic, ByteDance)
- **AXLE** (Axiom Math; cloud service, >500M requests served, behind their
  12/12 Putnam 2025 result): each request runs in its own sandboxed process
  (no network, no filesystem writes; a crash or runaway can't affect other
  requests); per-API-key fair-share queueing; elastic scaling up for training
  runs and down when idle; several Lean/Mathlib versions behind one endpoint;
  per-request wall-clock timeouts with automatic retry on infrastructure
  failures. Isolation costs ~0.3 s/request versus a shared REPL.
- Workloads they describe: RL training (thousands of candidate proofs per step,
  sub-second checks), agentic proving (decompose → solve → merge loops, dozens
  of checker calls per attempt), dataset curation (millions of requests).
- **Aristotle (Harmonic)** and **Seed-Prover (ByteDance)**: same loop — generate,
  compile in Lean, feed the compiler's feedback back, refine; Aristotle's IMO
  2025 solutions were all machine-verified in Lean, no human checking.

### 3. "It compiles" is not "it's verified"
- AXLE's `verify_proof` exists because plain compilation happily accepts `sorry`,
  custom axioms, and a theorem restated with a weaker type. It rejects `sorry`,
  any axiom outside the standard three (`propext`, `Quot.sound`,
  `Classical.choice`), and signature mismatches against the target statement.
- Trade-off they document: this trusts the elaborator's declarations rather than
  replaying everything through the kernel — ~100x faster than Comparator
  (0.43 vs 0.026 req/s) and ~4x faster than SafeVerify (0.107 req/s), but open to
  kernel-bypass via metaprogramming. Fine for cooperating AI clients, not for
  adversarial input.
- **What we have:** a denylist (`#eval`, IO, `axiom`, `elab`, ...), `sorry`
  reported as incomplete. **Missing:** an axiom whitelist check (`#print axioms`)
  and a statement/signature check.

### 4. Mass *evaluation* harnesses (how they measure a prover across a benchmark)
- `MechMath/lean-eval-toolkit`: N independent attempts per problem
  (`--attempts`), a concurrency flag, pass@k (direct = first round only, final =
  any round), repair rounds and truncation retries, dataset splits. Never runs
  Lean locally — forwards every candidate to a strict verifier. Output per run:
  `run.json` (settings), `results.jsonl` (one row per trajectory: rounds,
  extraction strategy, verifier detail, token usage), `summary.json` (pass
  rates, success-by-round, latency).
- Benchmarks in use: miniF2F, PutnamBench, SorryDB (real in-the-wild `sorry`s),
  FormalProofBench (graduate-level), MathArena's arXiv-Lean track.

### 5. The unsolved problem: statement faithfulness
- A miniF2F-Lean audit found the formal statement disagreeing with the informal
  problem in **over half of 488 problems** (16 unprovable, 40 simplified, 45
  excessively simplified), and LLM judges rated translation quality **97%
  correct where human experts said 66%**. Correcting the statements moved prover
  accuracy by up to 13 points.
- Implication: an LLM cannot be the referee of "does this Lean theorem say what
  the user claimed". Every "verified" in a mass run inherits this error rate
  unless a human or a stronger independent check reviews the statements.

### 6. Non-formal quantitative checking at scale
- **Math-Verify** (Hugging Face): parses LaTeX/plain answers, normalizes them to
  SymPy, and checks symbolic equivalence plus numeric tolerance; the common
  reward function in RL-on-math pipelines. Same job as our mathjs claim
  verifier, much more robust on LaTeX; Python-only.

### What this implies for our design
1. **Pool, not a single worker.** Size to cores, bounded by memory: in our
   Docker VM (8 GB) a warm REPL is ~2.7 GB, so 2 workers max locally; Kimina's
   per-REPL cap (8G) shows real deployments budget far more.
2. **Never pay a reload on the request path.** Today a timeout kills the worker
   and the next request waits ~60 s for `import Mathlib`. Keep a spare warm
   worker to swap in (Kimina's pre-warm / AXLE's per-request isolation).
3. **Batch + queue API, not one-click.** Accept a list of claims, N attempts
   each, run through a bounded queue, persist every trajectory (claim, Lean
   code, verifier output, timings) as `results.jsonl`-style records, report
   pass@k.
4. **Strict verification** before we call anything "verified": axiom whitelist
   and signature match, not just "no errors".
5. **Faithfulness is a first-class field**, not a footnote: store the generated
   statement next to the claim, sample for human review, never let an LLM judge
   be the only signal.
6. **Separate "prove" from "measure".** Proving a user's claims and benchmarking
   our own pipeline (miniF2F/PutnamBench subsets) are different products with
   different needs; decide which "mass experiment" means before building.

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
- [Kimina Lean Server (paper)](https://arxiv.org/html/2504.21230v3) and [repo](https://github.com/project-numina/kimina-lean-server)
- [AXLE: A Cloud Infrastructure for Lean 4 Theorem Proving Utilities](https://arxiv.org/html/2606.26442v1)
- [Aristotle: IMO-level Automated Theorem Proving (Harmonic)](https://arxiv.org/pdf/2510.01346)
- [lean-eval-toolkit](https://github.com/MechMath/lean-eval-toolkit)
- [miniF2F-Lean Revisited: Reviewing Limitations and Charting a Path Forward](https://arxiv.org/html/2511.03108v1)
- [Math-Verify (Hugging Face)](https://github.com/huggingface/Math-Verify)
- [PutnamBench](https://arxiv.org/pdf/2407.11214), [FormalProofBench](https://arxiv.org/html/2603.26996v1), [SorryDB](https://arxiv.org/pdf/2603.02668)
