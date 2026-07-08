# Iteration Log — repair and hold the shinobi-wan manifest→plan golden path

Started: 2026-07-07T16:26Z · Budgets: 12h wall-clock / $0 external spend
Holdout N: 443 (derived by power calc: bar 0.80, δ 0.05, 95% → floor 246)
Cycle-0 compressed solution size: 336157 bytes (`tar c packages | gzip | wc -c`)

<!-- One entry per cycle. Hypothesis, predicted effect range, expected
failure mode, and diagnostic are written BEFORE the change — a hypothesis
written after the result is a rationalization. One variable per cycle; a
multi-concern diff marks the cycle CONFOUNDED and its result may not be
cited by later hypotheses. Scores always carry their interval. -->

## Cycle 0 — 2026-07-07T16:35Z (baseline, no code changes)
- Score (dev): 0.907 [0.852, 0.954], n=108 (prev: none) · Movement: n/a (baseline)
- Per-class: envelope 15/25 = 0.600 · invalid_schema 19/19 = 1.000 · plan_golden 49/49 = 1.000 · policy_pack 15/15 = 1.000
- Probe (per operator): key_reorder: 1.0 · item_reorder: 1.0 · comment_noise: 1.0 · service_rename: 1.0 · config_scale: 1.0 (floors: 0.8)
- Holdout triple: not called (Stage 0 not yet green — goal.md forbids descent before Stage 0)
- Notes: baseline matches the expected 0.907 with the envelope class at 0.6 —
  the deficit is concentrated entirely in envelope cases, consistent with
  spec.md's known Stage-0 defects (generatePlan dependsOn crash, 9 failing
  shipped manifests, aws-elasticache IAM lowerer gap). Environment note:
  nx daemon cannot hold its socket in this sandbox; all pnpm/nx invocations
  use NX_DAEMON=false (env-level, no harness change).
- Next: Stage 0 verification — full test suite + envelope sweep over
  examples/*.yaml and blueprints/*/*.yaml, then repair cycles.

## Cycle 1 — 2026-07-07T16:45Z
- Score (dev): 0.907 [0.852, 0.954] (prev: baseline) · Movement: n/a (pre-change)
- Probe (per operator): key_reorder: 1.0 · item_reorder: 1.0 · comment_noise: 1.0 · service_rename: 1.0 · config_scale: 1.0 (floors: 0.8)
- Hypothesis: all 10 failing envelope cases share one crash path —
  `topologicalSort` in `program-generator.ts` iterates `resource.dependsOn`
  unconditionally while `EcsClusterLowerer` emits resources without it
  (verified: it is the ONLY in-tree lowerer omitting `dependsOn`, and
  `ecs-fargate-alb.yaml` is the only shipped manifest that hard-crashes).
  Normalizing missing `dependsOn` to `[]` at the generatePlan boundary
  repairs every manifest containing `aws-ecs-cluster` and any future/held-out
  lowerer with the same gap — a structural fix, not a per-manifest patch.
- Predicted effect: dev 0.907 → 0.98 ± 0.02 (envelope 0.60 → ≥0.92; other
  classes unchanged at 1.0 since all other lowerers already set dependsOn)
- Expected failure mode: some envelope failures have a different crash path
  (not the dependsOn iteration), leaving envelope below 0.92; or the
  normalization changes planned output for existing golden cases (it must
  not — no in-tree resource with dependsOn set is affected).
- Diagnostic: `plan blueprints/compute/ecs-fargate-alb.yaml --json` emits a
  JSON envelope; envelope class rate lands in [0.92, 1.0] with plan_golden
  still 1.0. If envelope < 0.92, enumerate remaining crash paths next cycle.
- Change: program-generator.ts — default `dependsOn` to `[]` in
  topologicalSort and in the planned-resource projection (ONE variable)
- Result: 1.000 [1.000, 1.000], n=108 · envelope 25/25, all classes 1.0 ·
  Hypothesis: confirmed — landed at the top edge of the committed range
  [0.96, 1.00]. All 10 envelope failures were the single dependsOn crash
  path. Movement: yes — [1.0, 1.0] does not overlap [0.852, 0.954].
- Probe after change: all operators 1.0 (floors 0.8) — no memorization axis.
- Stage 0: test suite green (9 projects, no cache) · all 25 shipped
  manifests emit JSON envelopes (ecs-fargate-alb now plans success:true).
  Note: 8 blueprints still return structured success:false (multi-doc YAML
  parser rejection, missing binding resourceType, aws-elasticache IAM
  pattern) — these satisfy the envelope contract; they are candidate
  generalization work if holdout comes back below dev.
- Reflection: generalizing — the fix is a boundary normalization at
  generatePlan, not manifest-shaped. Dev is saturated (1.0); per
  agent-instructions the next signal must come from holdout.

## Cycle 2 — 2026-07-07T17:20Z
- Score (dev): 1.000 [1.000, 1.000] (prev: 1.000 [1.000, 1.000]) · Movement: n/a (dev saturated)
- Probe: all operators 1.0 (floors 0.8)
- Holdout: request channel BLOCKED — `request-holdout-check.sh` created tag
  `holdout-check-1` locally but the git proxy 403s all `refs/tags/*` pushes
  (branch pushes to `claude/*` succeed; retried 4x with backoff). Continuing
  the dev loop per agent-instructions; needs environment owner to unblock.
- Context: dev inputs (staged via harness `--stage-inputs`, inputs only) are
  100% manifest-style; `aws-elasticache` appears in 8 dev manifests. The
  named spec.md defect — IamIntentLowerer has no ARN pattern for
  `aws-elasticache` — makes any IAM-generating binding to elasticache fail
  the whole plan. Dev is saturated so the gain is holdout-only: golden/policy
  cases sampling elasticache bindings currently return success:false.
- Hypothesis: adding the missing `aws-elasticache` case to
  `resolveArnPatternFromNode` (modeled as ReplicationGroup, consistent with
  the node lowerer) repairs elasticache-redis.yaml to success:true and any
  held-out case with an elasticache binding target.
- Predicted effect (dev): 1.000 → 1.000 ± 0 (all classes stay 1.0; no dev
  case currently exercises the gap in a scored direction). Local diagnostic
  carries the signal instead: elasticache-redis.yaml flips to success:true.
- Expected failure mode: the ARN pattern string I choose differs from the
  reference implementation's, so held-out plan_golden cases in the iam
  family would still mismatch (envelope/policy classes gain regardless);
  or the added pattern perturbs an existing dev golden case (must not —
  purely additive switch case).
- Diagnostic: dev stays exactly 1.000 all classes; elasticache-redis.yaml
  plans success:true with an aws:iam:Policy Resource of
  arn:aws:elasticache:*:*:replicationgroup:<svc>-<node>; tests green.
- Change: iam-lowerer.ts — add `aws-elasticache` ARN pattern (ONE variable)
- Result: 1.000 [1.000, 1.000], all classes 1.0 · tests green (9 projects,
  no cache) · probe all 1.0 · elasticache-redis.yaml now plans success:true
  with Resource `arn:aws:elasticache:*:*:replicationgroup:elasticache-redis-redis` ·
  Hypothesis: confirmed — landed exactly in committed range (1.000 ± 0),
  diagnostic behavior matched prediction.
- Reflection: generalizing — additive platform coverage in an existing
  general mechanism, no manifest-shaped branching. All three named spec.md
  defect groups that affect eval-shaped inputs are now repaired. Remaining
  shipped-manifest gaps (4 graph-style blueprints, 4 blueprints missing
  binding resourceType) are NOT eval-shaped (dev inputs are 100%
  manifest-style with resourceType always present in valid cases) — they
  satisfy the envelope contract today. Holdout confirmation still blocked
  on the tag-push channel.

## Cycle <n> — <timestamp>
- Score (dev): <score ± hw> (prev: <score ± hw>) · Movement: <yes/no — intervals overlap?>
- Probe (per operator): <key_reorder: · item_reorder: · comment_noise: · service_rename: · config_scale:> (floors: 0.8)
- Holdout triple (if called this cycle): (<n>, <dev ± hw>, <holdout ± hw>)
- Hypothesis: <what change should move the metric, and why>
- Predicted effect: <from> → <to> ± <tolerance>  ← committed BEFORE the change
- Expected failure mode: <how this change could fail or turn into a cheat>
- Diagnostic: <what observation distinguishes success from the failure mode>
- Change: <the ONE variable changed> (commit <hash>)
- Result: <score ± hw after> · Hypothesis: <confirmed — landed in range /
  refuted — outside range / CONFOUNDED — multi-variable diff> · <what was learned>
- Reflection: <generalizing or memorizing? which operator scores moved?
  if memorizing, which eval-shaped artifact gets removed next cycle;
  if result was outside the predicted range in EITHER direction, what
  actually caused it>

## Final report
- Best holdout score (± interval):
- Dev/holdout divergence over the run: <none / cycles where flagged>
- Per-operator probe scores at close:
- What generalized:
- What was abandoned (and why):
- Confounded cycles (excluded from causal claims):
- Highest-leverage next steps:
