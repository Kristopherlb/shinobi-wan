# Spec — shinobi-wan golden-path manifest→plan flow

This is the **inner loop**: short-horizon, fast-feedback, one objective — make
these tests pass. The eval (`eval/dev`, `eval/holdout`) is the **outer loop**:
long-horizon, sparse feedback, measured only after this spec is green.

`goal.md` gates the outer loop behind this one: **Stage 0 = this spec passes,
locally, before any descent on the eval.**

## System under test

Shinobi V3 compiles a YAML service manifest into a deterministic AWS resource
plan: manifest → parse → graph mutations → kernel compile → binders → intents
→ policy evaluation → AWS adapter lowering → `ResourcePlan`. The golden path
is the CLI contract:

```
node packages/cli/dist/main.js validate <manifest> --json [--policy-pack P]
node packages/cli/dist/main.js plan     <manifest> --json
```

Scoring is **plan-only**: no `up`, no Pulumi engine, no AWS credentials, no
network at scoring time. The observable contract is the structured JSON
envelope + the lowered resource set + error/policy semantics.

### Build contract (also the liveness gate)

```
pnpm install --frozen-lockfile
pnpm nx run-many -t build
# healthy when: plan examples/lambda-sqs.yaml --json => {"success": true, ...}
```

Note: the built CLI currently resolves `@pulumi/*` only via
`NODE_PATH=packages/adapters/aws/node_modules`. The harness sets this
defensively; making the CLI self-contained is legitimate (and welcome)
product work.

### The golden-path contract (what a case asserts)

| Case class       | Input shape                                                                                                                              | Correct behavior                                                                                                                                                                                          |
| ---------------- | ---------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `plan_golden`    | valid manifest                                                                                                                           | `success == true`; the lowered resource set (name, resourceType, dependsOn, properties), restricted to the case's frozen resource-type families, exactly matches the reference projection                 |
| `invalid_schema` | manifest broken by construction (missing `service`, unknown platform, dangling binding target, missing `resourceType`, duplicate ids, …) | `success == false` with structured errors whose **paths** match the reference (KL-002: stable paths; message wording is free to improve)                                                                  |
| `policy_pack`    | valid manifest × `--policy-pack` ∈ {Baseline, FedRAMP-Moderate, FedRAMP-High}                                                            | `validate --json` projection matches: `success`, `validation.valid/errorCount/warningCount`, `policy.policyPack/compliant/violationCount`                                                                 |
| `envelope`       | any manifest, including ones current lowerers mishandle                                                                                  | stdout parses as JSON with a boolean `success` — the CLI **never crashes with a stack trace** (KL-002/KL-006). Content beyond the envelope is not scored, so repairing a broken lowerer is never punished |

Projections are computed by `harness/lib/proj.py` — the SAME code at
generation time and scoring time. Warning diagnostics and resource types
outside a case's frozen families are **excluded** from `plan_golden`
comparison, so roadmap work (e.g. network resource emission) does not break
golden cases.

## Known defects on current main (Stage-0 repair targets)

Captured at reference SHA `4a748b3`:

1. **`generatePlan` crash**: any manifest containing `aws-ecs-cluster` dies
   with `TypeError: resource.dependsOn is not iterable`
   (`topologicalSort` in the plan generator; the ECS-cluster lowerer emits a
   resource without `dependsOn`). This is why `blueprints/compute/
ecs-fargate-alb.yaml` crashes. The `envelope` eval class fails on every
   such case until fixed.
2. **Shipped blueprints that do not plan**: 8 more of the 25 shipped
   manifests fail `plan` — `$.service`/`$.components` schema errors
   (multi-document YAML blueprints the parser rejects:
   `ml-training-pipeline`, `networking-hub-spoke`, `msk-kafka`,
   `data-lake`), missing `resourceType` in binding configs
   (`serverless-api-etl`, `agent-orchestration-sfn`, `bedrock-gateway`,
   `rag-pipeline`), and an IAM intent lowerer that cannot resolve a
   resource pattern for `aws-elasticache` (`elasticache-redis`). Fix the
   blueprint data or extend the parser/lowerers — either is legitimate;
   crashing is not.
3. **Network intents** are warning-only and **telemetry intents** are
   skipped by lowering (documented MVP limits — out of scope; the eval
   deliberately does not score warnings).

## Inner-loop test suite (Stage 0 — must be green before descent)

1. `pnpm nx run-many -t test` — the existing ~1,750-test suite stays green.
2. Envelope sweep over the repo's own shipped manifests:
   `for f in examples/*.yaml blueprints/*/*.yaml: plan $f --json` must emit
   parseable JSON with boolean `success` for **every** file (no crashes).
   `scripts/target-repo/score-dev.sh` runs `harness/score.sh`, whose dev
   split contains the same case classes and reports per-class rates.

Exit criteria for Stage 0: both of the above hold locally. Then, and only
then, begin outer-loop cycles against the eval bar (goal.md).
