# Goal: repair and hold the shinobi-wan manifest→plan golden path on held-out manifests

## Stage 0 — Build to spec (inner loop)
Implement `spec.md`. The repo must build (`pnpm install --frozen-lockfile &&
pnpm nx run-many -t build`), the existing ~1,750-test suite must stay green
(`pnpm nx run-many -t test`), and every shipped manifest
(`examples/*.yaml`, `blueprints/*/*.yaml`) must produce a structured JSON
envelope from `plan <file> --json` — no stack traces (spec.md lists the
known Stage-0 defects: the `generatePlan` dependsOn crash, the 9 failing
shipped manifests, the `aws-elasticache` IAM lowerer gap). Do not score
against the eval until this is green, and keep it green every cycle
thereafter.

## Target (outer loop)
Metric: the fraction of held-out manifest cases whose canonicalized CLI
projection matches the reference. A case is scored on exactly one of:
valid manifests — `success:true` plus the EXACT lowered resource set
(name, resourceType, dependsOn, properties) within the case's frozen
resource-type families; schema-invalid manifests — `success:false` plus
exact structured error paths (message wording is unscored); policy cases —
`validate --json` validation + policy counters per pack; envelope cases —
stdout is JSON with a boolean `success`, never a crash. The metric
penalizes BOTH directions: always-succeed fails the invalid cases,
always-error fails the golden and policy cases, empty or padded resource
sets fail the exact-set comparison, and a crash fails everything it
touches. You cannot max it without actually implementing the
manifest→graph→intents→policy→lowering contract across the surface.

Bar: **0.80** on holdout. Score with `harness/score.sh`; scores are
reported as `score ± hw` at 95% (case-level bootstrap) — a bare point is
not a score. A **VOID** result means a constraint was violated — find and
remove the violation; the harness will not tell you which it was.

Holdout: aggregate-only, at most one call every 2 hours and 24 total for
the run; every holdout call is logged as a `(cycle, dev, holdout)` triple.
Request one via `scripts/target-repo/request-holdout-check.sh` and read the
result as a returned status — never by reading eval answers.
Holdout size: 443 cases (power-derived floor: 246 distinguishes δ=0.05 at
the bar with 95% confidence). Acceptance is measured on holdout
exclusively.

## Constraints
- Wall-clock budget: 12 hours. Check `harness/status.sh` every cycle — it
  shows elapsed time, score history with intervals, and the dev/holdout
  divergence flag. Watch gain per token; a flat gradient at high burn
  means stop.
- Spend ceilings: no paid external surface is in scope; the only cost is
  your own tokens. Do not add a paid surface.
- Surface: you may modify the whole repository EXCEPT `goal.md`,
  `harness/`, and `eval/`. Scoring is plan-only — do not require any AWS
  credential, Pulumi engine call, deployment, or network access for
  `validate`/`plan` to work; `up` is out of scope. Everything unlisted is
  off-limits.
- Capacity caps (enforced by `capacity_caps`): no source file may carry
  more than 160 `aws:` type-literal lines, 25 inline manifest markers, or
  60 `dependsOn` literals — a request-shaped lookup table is a lookup
  table wherever it hides.
- Contamination: no eval answer content may appear in the solution,
  verbatim or paraphrased, and no eval marker string may appear anywhere
  in the tree or its history. Enforced by `canary_scan`, `ngram_overlap`,
  and `compressibility` — any hit VOIDs the score with no further detail.
- One variable per cycle: each cycle's change isolates a single variable.
  Multi-concern diffs mark the cycle CONFOUNDED in LOG.md and its result
  may not be cited by later hypotheses. Surfaced by `diff_scope`.
- `goal.md`, `harness/`, and `eval/` are read-only. Eval inputs may be
  read where the harness exposes them; eval answers never.

## Cycle protocol
1. Score (dev) — record `score ± hw`. Movement means non-overlapping
   intervals vs. the previous cycle; an in-interval wiggle is noise and
   counts as no movement.
2. Reflect: run `harness/probe.sh` — per-operator mutation scores
   (key_reorder, item_reorder, comment_noise, service_rename,
   config_scale), floors at 0.8. A falling operator score means memorizing
   along that axis; the next change must REMOVE an eval-shaped artifact
   (cap a table, generalize a branch), never add one.
3. Hypothesize: log hypothesis, a committed numeric effect range
   (`from → to ± tol`), expected failure mode, and diagnostic in LOG.md
   BEFORE changing code. Results outside the committed range are
   refutations even when the score rose.
4. Change — ONE variable.
5. Log the result against the committed range.
6. Checkpoint: `git commit -am "cycle <n>: <score ± hw>"` — every cycle,
   gain or no gain, so the run is bisectable and crash-safe.

## Entropy rules
- Stall rule: if the last cycle produced no CI-clearing movement, the next
  attempt must be a structural change — same-knob-harder is banned.
- Exploration quota: every 5 cycles, try a structurally different approach
  even if the current one is still inching up.

## Auto-escalation (patch-mode triggers — no human report needed)
- `status.sh` prints `DIVERGENCE: dev/holdout` (dev lower-CI rising over
  the last 5 cycles while holdout is flat or falling).
- Any per-operator probe score below 0.8.
- No CI-clearing movement for 5 consecutive cycles despite the entropy
  rules.
On trigger: halt the loop at the current checkpoint and hand off to patch
mode (strongest available model, per the design skill) — never self-patch
the loss function.

## Stop conditions
Bar hit on holdout (interval lower bound ≥ 0.80) **and** Stage 0 green
(tests + every shipped manifest emitting a structured envelope) · wall-clock
budget exhausted · holdout call budget exhausted · marginal gain ≈ 0 for 5
consecutive cycles. On stop: write a final report in LOG.md — best score
with interval, divergence history, per-operator probe scores at close, what
generalized, what was abandoned, confounded cycles, highest-leverage next
steps.
