# Reality Audit - 2026-02-15

## Scope

Code-and-test-only audit focused on:
- Potemkin behavior (appears functional but is not production-real)
- Vaporware risk (unimplemented critical paths masked by abstractions)
- Misleading tests
- Hardcoded/placeholder responses that can hide broken runtime behavior

No docs were used to form conclusions.

## Method

- Static review across `packages/ir`, `packages/kernel`, `packages/binder`, `packages/policy`, `packages/validation`, `packages/cli`, and `packages/adapters/aws`.
- Direct inspection of tests for realism vs mock-only assertions.
- Executed test suites without Nx cache:
  - `pnpm nx test adapter-aws --skipNxCache`
  - `pnpm nx test cli --skipNxCache`
  - `pnpm nx test kernel --skipNxCache`
  - `pnpm nx test conformance --skipNxCache`
- Result: all suites pass, but several tests validate shape/determinism while not validating deployability/semantic correctness.

## Findings (Severity-Ordered)

### Critical

1) IAM lowering can silently widen "specific" access to wildcard `*`
- Evidence:
  - `packages/adapters/aws/src/lowerers/iam-lowerer.ts`
    - Policy resource generation sets:
      - `Resource: intent.resource.scope === 'specific' ? (intent.resource.pattern ?? '*') : '*'`
  - `packages/binder/src/binders/component-platform-binder.ts`
    - Emits IAM intent with `scope: 'specific'` but normally no `pattern`.
  - `packages/policy/src/evaluators/baseline-policy-evaluator.ts`
    - Wildcard violation checks only trigger when `scope === 'pattern'`.
- Impact:
  - A "specific" intent may become `Resource: "*"`, while policy checks still treat it as specific and compliant. This is a real false-safety/security gap.
- Why this is Potemkin:
  - Policy compliance can appear healthy while generated IAM policy is materially broader than intended.

2) Conformance runner can mask failed graph setup
- Evidence:
  - `packages/conformance/src/golden-runner.ts`
    - Calls `kernel.applyMutation(mutations);` and ignores the returned success/errors.
    - Continues to `kernel.compile()` regardless.
- Impact:
  - A broken setup can still produce compile output and pass tests if assertions do not catch the missing graph state.
- Why this is Potemkin:
  - "Golden" tests may report green even when setup mutations failed.

### High

3) Reference resolution degrades to unresolved placeholders instead of failing
- Evidence:
  - `packages/adapters/aws/src/pulumi-program.ts`
    - Missing refs return `pulumi.output("<unresolved:...>")`.
    - Unknown output field also falls back to unresolved placeholder.
- Impact:
  - Broken wiring can survive plan/program construction and only fail late (or behave incorrectly), with no hard stop at compile/lowering time.
- Why this is Potemkin:
  - System appears to produce executable plans while containing unresolved dependency wiring.

4) Network lowering emits `aws:ec2:SecurityGroupRule` placeholders without full SG context
- Evidence:
  - `packages/adapters/aws/src/lowerers/network-lowerer.ts`
    - Explicitly documented as placeholder-style lowering.
    - Emits SG rules with broad CIDR and no security-group identity linkage in generated properties.
  - `packages/adapters/aws/src/__tests__/network-lowerer.test.ts`
    - Verifies shape fields only; does not validate deploy-time correctness against real provider requirements.
- Impact:
  - Produced resources may not be deployable or may not model intended least-privilege network semantics.
- Why this is Potemkin:
  - Looks like real network implementation but is effectively schematic in current form.

5) Config lowering can produce unresolved refs for common binder output forms
- Evidence:
  - `packages/adapters/aws/src/lowerers/config-lowerer.ts`
    - Reference lowers to `{ ref: "${nodeRef}.${field}" }` directly.
  - Binder examples and tests commonly use short refs like `work-queue.url`.
  - Pulumi resource registry keys are resource names like `work-queue-queue`, not node IDs, in `packages/adapters/aws/src/pulumi-program.ts`.
  - `packages/adapters/aws/src/adapter.ts` includes separate config resolution for Lambda env vars (`resolveConfigValue`), but this does not fix SSM parameter refs emitted by config lowerer.
- Impact:
  - SSM parameter resources can carry unresolved placeholder values while Lambda env vars may still appear correct, creating split-brain behavior.
- Why this is Potemkin:
  - Partial path appears functional in tests while one emitted resource class remains logically disconnected.

### Medium

6) Runtime code path uses test-fixture builders
- Evidence:
  - `packages/cli/src/manifest/graph-builder.ts` uses `createTestNode` and `createTestEdge`.
  - Fixture definitions in `packages/ir/src/test-fixtures.ts` are explicitly test-oriented.
- Impact:
  - Increases risk that production behavior inherits test defaults/assumptions and blurs boundaries.
- Why this is Potemkin:
  - Production flow can look complete while relying on test scaffolding semantics.

7) CLI `plan` API suggests preview capability that is not implemented in `plan()`
- Evidence:
  - `packages/cli/src/commands/plan.ts` imports `preview` and includes `preview` in options/result types, but never executes preview.
  - `packages/cli/src/cli.ts` performs preview externally when `--preview` is set.
- Impact:
  - API contract confusion; consumers of `plan()` may assume preview integration that does not exist.
- Why this is Potemkin:
  - Surface suggests richer behavior than actual function implementation.

8) Deployer and Pulumi program tests are high quality unit tests but heavily mocked
- Evidence:
  - `packages/adapters/aws/src/__tests__/deployer.test.ts` mocks Pulumi Automation API.
  - `packages/adapters/aws/src/__tests__/pulumi-program.test.ts` mocks Pulumi/AWS constructors.
  - `packages/cli/src/commands/__tests__/up.test.ts` mocks `@shinobi/adapter-aws`.
- Impact:
  - Excellent fast feedback on control flow and determinism, but limited confidence in real provider/runtime behavior.
- Why this is Potemkin risk:
  - Green tests can overstate deployability confidence without at least one real smoke path.

## What Is Solid (Not Vaporware)

- IR graph mutation model is real and coherent (`packages/ir/src/graph.ts`): atomic batch behavior, idempotency, deterministic snapshot ordering.
- Kernel compile pipeline is real (`packages/kernel/src/compilation-pipeline.ts`) and integrated with validation/binders/policy.
- Policy evaluation logic and severity tiering are concrete and tested (`packages/policy` + conformance triad tests).
- Adapter has substantial concrete resource coverage (IAM/Lambda/SQS/DynamoDB/S3/API Gateway + deployer plumbing).

## Priority Remediation Plan

1) Fix IAM wildcard widening (critical)
- In `iam-lowerer`, reject/diagnose `scope: specific` without resolvable concrete resource.
- Never default specific scope to `*`.
- Add tests that fail when specific scope becomes wildcard.

2) Make conformance runner fail fast on mutation failure (critical)
- In `runGoldenCase`, assert `applyMutation(...).success === true`; throw with errors otherwise.

3) Make unresolved refs a hard error (high)
- In `pulumi-program`, track unresolved refs and throw before returning outputs.
- Add tests expecting failure (not placeholder output) for missing refs.

4) Replace placeholder network resource semantics with explicit "not yet supported" diagnostics (high)
- Prefer deterministic diagnostics over pseudo-resource emission if full SG context is unavailable.

5) Separate runtime builders from test fixtures (medium)
- Add production node/edge builders in IR/CLI path; keep test fixtures test-only.

6) Clarify plan/preview contract (medium)
- Either execute preview inside `plan()` when requested or remove `preview` option from `plan()` API surface and keep preview orchestration strictly in CLI.

## Confidence Note

This codebase is not pure vaporware; it contains substantial real implementation and clean architecture boundaries. The core concern is not "nothing exists," but that some critical adapter/lowering behaviors can currently make the system look safer/more complete than runtime semantics actually are.

## Remediation Status Update (2026-02-15)

### Finding-by-finding status

1) IAM specific-scope wildcard widening - **Resolved**
- `packages/adapters/aws/src/lowerers/iam-lowerer.ts`
  - Removed fallback that silently widened to `*`.
  - Added deterministic resolution for known target platforms.
  - Added explicit erroring for invalid scope/pattern combinations.
- Tests updated:
  - `packages/adapters/aws/src/__tests__/iam-lowerer.test.ts`
  - `packages/adapters/aws/src/__tests__/adapter.test.ts`

2) Conformance runner masking setup failure - **Resolved**
- `packages/conformance/src/golden-runner.ts` now fails fast when `applyMutation` fails.
- Added focused tests:
  - `packages/conformance/src/__tests__/golden-runner.test.ts`

3) Unresolved ref placeholder behavior - **Resolved**
- `packages/adapters/aws/src/pulumi-program.ts`
  - Replaced `<unresolved:...>` placeholder returns with deterministic hard errors.
  - Output template resolution now hard-fails on missing resource/field.
- Tests updated:
  - `packages/adapters/aws/src/__tests__/pulumi-program.test.ts`

4) Placeholder network pseudo-resources - **Resolved (as explicit unsupported contract)**
- `packages/adapters/aws/src/adapter.ts`
  - Network intents now emit explicit warning diagnostics and no fake resources.
- `packages/adapters/aws/src/lowerers/network-lowerer.ts`
  - No longer emits pseudo `SecurityGroupRule` resources.
- Tests updated:
  - `packages/adapters/aws/src/__tests__/network-lowerer.test.ts`
  - `packages/adapters/aws/src/__tests__/adapter.test.ts`

5) Config ref mapping split-brain - **Resolved**
- Added canonical shared resolver:
  - `packages/adapters/aws/src/lowerers/reference-utils.ts`
- Applied consistently to both paths:
  - `packages/adapters/aws/src/lowerers/config-lowerer.ts`
  - `packages/adapters/aws/src/adapter.ts`
- Tests updated:
  - `packages/adapters/aws/src/__tests__/config-lowerer.test.ts`
  - `packages/adapters/aws/src/__tests__/adapter.test.ts`

6) Runtime use of test fixture builders - **Resolved**
- Added runtime builders:
  - `packages/ir/src/builders.ts`
  - exported from `packages/ir/src/index.ts`
- Updated runtime manifest path:
  - `packages/cli/src/manifest/graph-builder.ts` now uses runtime builders, not test fixtures.

7) `plan()` preview contract confusion - **Resolved**
- `packages/cli/src/commands/plan.ts`
  - Removed preview-related API surface from `plan()`.
- `packages/cli/src/cli.ts`
  - Preview remains orchestrated at CLI layer only.

8) Mock-heavy confidence gap - **Partially resolved**
- Added optional non-mocked smoke boundary test with deterministic skip guard:
  - `packages/cli/src/commands/__tests__/up.smoke.test.ts`
  - Runs only when `SHINOBI_RUN_PULUMI_SMOKE=true` and AWS credentials are present.
- Remaining gap:
  - Full live-cloud integration coverage is still optional, not mandatory in default CI.

### Regression verification

Executed without Nx cache:
- `pnpm nx run-many -t test --skipNxCache`

Result:
- All projects passed tests.
- Optional smoke test skipped by default unless explicitly enabled with env guards.
