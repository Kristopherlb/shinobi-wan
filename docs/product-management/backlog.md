# Shinobi Product Backlog

This document holds **future initiatives** that are scoped but not yet on the active execution
roadmap (`docs/operations/current-roadmap.md`). When an epic is pulled into active work, promote its
requirements into the appropriate roadmap execution-control track.

Last updated: 2026-06-21

## How to read this backlog

- **Epics** (`E#`) are large initiatives. Each contains numbered **requirements** with stable IDs.
- **Requirement ID scheme**: `MCA-#` (Multi-Cloud Adapters), `EE-#` (Ephemeral Environments).
- **Priority**: `P0` (foundational/blocking), `P1` (core value), `P2` (hardening/nice-to-have).
- **Size**: `S` (≤2 days), `M` (≤1 week), `L` (1–3 weeks), `XL` (multi-week, parallelizable).
- Every requirement lists **Acceptance criteria** (its exit criteria) and the **Invariants** it must not break.

### Non-functional invariants (apply to every requirement below)

These are the project's non-negotiable invariants (see `CLAUDE.md`, kernel laws). Any change must hold them:

- **N1 — Boundary purity**: `kernel`, `binder`, `policy`, `ir`, `contracts` never import a provider SDK.
  Provider SDKs live only under `packages/adapters/*`.
- **N2 — Provider-neutral above the adapter**: nodes, edges, and intents reaching the adapter carry no
  provider-native handles or strings. (KL-004 No backend handles.)
- **N3 — Determinism**: identical inputs produce byte-stable outputs; stable IDs; canonical ordering.
  (KL-001.) New adapters/commands must be deterministic and golden-testable.
- **N4 — No pack/provider branching in shared layers**: components and binders never branch on policy
  pack (KL-008) or on target provider. Selection happens at the adapter/config boundary only.
- **N5 — Structured outputs**: all command outputs remain structured JSON envelopes, never bare strings.

---

## Epic E1 — Multi-Cloud Provider Adapters (Azure & GCP)

**Goal**: deploy Shinobi-compiled graphs to Azure and GCP, not just AWS, without weakening the
provider-neutral kernel.

**Current state (evidence)**:

- The kernel/IR/contracts/binder/policy layers are already provider-neutral. Intents
  (`packages/contracts/src/intent/*`) carry abstract concepts (`resourceType: "queue"|"bucket"`,
  `actions:{level,action}`, `protocol`) with no AWS ARNs or service strings.
- AWS coupling is concentrated in three places:
  1. **CLI hardwires the adapter** — `packages/cli/src/commands/plan.ts` and `up.ts` directly
     `import { lower, deploy, preview } from '@shinobi/adapter-aws'`; there is no `Adapter` interface
     or registry.
  2. **Node types are provider-branded** — blueprints declare `platform: aws-lambda`; lowerers match by
     exact string (`readonly platform = 'aws-lambda'`, `packages/adapters/aws/src/lowerer-registry.ts`).
  3. **Lowerers + IAM action map are AWS-specific** — `LoweredResource.resourceType = 'aws:lambda:Function'`
     (`packages/adapters/aws/src/types.ts`), and `ACTION_MAP` (`.../lowerers/iam-lowerer.ts`) maps
     `queue → sqs:*`.
- `LoweredResource` itself is provider-neutral (`{ name, resourceType, properties, sourceId, dependsOn }`),
  so a non-AWS adapter emits e.g. `gcp:cloudfunctions:Function` through the same contract.

**Architectural decision required before build — see MCA-0.**

### MCA-0 — Decide the node-typing model (decision requirement) · P0 · S

The two viable models, to be recorded as an ADR (`docs/decisions/`):

- **Model A — provider-explicit types**: keep `aws-lambda`, add `gcp-cloudfunction`, `azure-function`.
  Adapter routes by provider prefix. A manifest targets one cloud. Low risk; not portable-per-manifest.
- **Model B — abstract capability types**: manifest declares `function`/`queue`/`bucket`; provider is
  resolved at compile/deploy via kernel config. Portable manifests; high risk (services do not map 1:1,
  IAM/network semantics diverge).

**Acceptance criteria**:

- An ADR is merged choosing A or B (recommended: **A first**, with B introduced later as an additive
  manifest aliasing layer).
- The decision documents the migration path from A → B (alias resolution in the manifest parser).
  **Invariants**: N1–N5. **Blocks**: MCA-2, MCA-5.

### MCA-1 — Define a provider-neutral `Adapter` interface in `contracts` · P0 · M

**Description**: introduce an `Adapter` contract describing `lower(input) → ResourcePlan`,
`deploy(plan, opts)`, `preview(plan, opts)`, and (per E2) `destroy(opts)`. Move provider-neutral plan
types (`ResourcePlan`, `LoweredResource`, `AdapterConfig`, `AdapterResult`) from `@shinobi/adapter-aws`
into `contracts` (or a shared `adapter-contract` module) so the CLI depends on the interface, not on AWS.
**Acceptance criteria**:

- `contracts` exports an `Adapter` interface and the shared plan/result types.
- `@shinobi/adapter-aws` implements `Adapter`; no behavior change to existing AWS golden tests.
- ESLint boundary rules updated and green.
  **Invariants**: N1 (contracts stays SDK-free), N2, N5. **Depends on**: none. **Blocks**: MCA-2, MCA-3.

### MCA-2 — Adapter registry + selection mechanism · P0 · M

**Description**: a registry that maps a provider key (`aws`|`azure`|`gcp`) to an `Adapter`
implementation, plus a selection source (manifest `provider:` field and/or `--provider` CLI flag, with
defined precedence per KL-007).
**Acceptance criteria**:

- `selectAdapter(provider)` returns the correct implementation or a structured error listing supported
  providers (KL-003 allowed-values guidance).
- Selecting an unsupported provider yields an explainable diagnostic, not a crash.
- Selection is deterministic and covered by unit tests.
  **Invariants**: N3, N4 (selection only at the boundary), N5. **Depends on**: MCA-0, MCA-1.

### MCA-3 — Decouple the CLI from `@shinobi/adapter-aws` · P0 · M

**Description**: `plan`, `up`, and the new `down` (E2) call through the registry/`Adapter` interface
instead of importing AWS directly. AWS remains the default provider for backward compatibility.
**Acceptance criteria**:

- No `import ... from '@shinobi/adapter-aws'` remains in `packages/cli/src/**` outside of optional
  default-registration wiring.
- All existing CLI tests pass unchanged with AWS as default.
- A second (stub) adapter can be registered in a test and driven end-to-end through `plan`.
  **Invariants**: N1, N5. **Depends on**: MCA-1, MCA-2.

### MCA-4 — Provider-scoped lowerer registries · P1 · M

**Description**: generalize the lowerer registry so each provider owns its own node/intent lowerer set,
keyed by that provider's platform vocabulary. Extract shared scaffolding (naming, tagging, ref
resolution) into provider-agnostic helpers.
**Acceptance criteria**:

- Each adapter constructs its own registry; the AWS registry is unchanged in behavior.
- Unknown platform for a provider yields a structured, actionable diagnostic.
  **Invariants**: N2, N3. **Depends on**: MCA-1.

### MCA-5 — Manifest platform typing + parser support · P1 · M

**Description**: implement the MCA-0 decision in the manifest parser
(`packages/cli/src/manifest/`). For Model A: validate provider-prefixed platforms and route by prefix.
For Model B (later): add a capability→platform alias layer that resolves `queue` to the selected
provider's platform.
**Acceptance criteria**:

- Parser validates platform/provider combinations and emits stable-path validation errors for unknown
  pairings.
- Round-trip determinism preserved (KL-001).
  **Invariants**: N3, N4. **Depends on**: MCA-0.

### MCA-6 — Per-provider IAM/authorization action mapping · P1 · M

**Description**: extract the AWS `ACTION_MAP` into a provider-specific authorization matrix so each
adapter translates abstract `{resourceType, level}` to that cloud's native permissions (AWS IAM, Azure
RBAC roles/role-assignments, GCP IAM bindings). Keep the abstract IAM intent unchanged.
**Acceptance criteria**:

- Each adapter has its own authorization matrix with tests proving least-privilege expansion (KL-005).
- The `IamIntent` contract is untouched.
  **Invariants**: N1, N2, N5. **Depends on**: MCA-4.

### MCA-7 — Azure adapter: vertical slice · P1 · XL

**Description**: a new `packages/adapters/azure` implementing `Adapter`, with a minimal lowerer set
covering one representative blueprint (e.g. Function + Queue/Service Bus + Blob Storage + identity),
deploying via Pulumi Azure Native. Only `@pulumi/azure-native` lives here (N1).
**Acceptance criteria**:

- `plan` and `up --no-dry-run` succeed for the target blueprint against a real subscription.
- Golden plan tests for the slice (constructed `LoweringContext` directly, no kernel/binder import).
- Determinism gate passes for Azure plans.
  **Invariants**: N1–N5. **Depends on**: MCA-1, MCA-2, MCA-4, MCA-6.

### MCA-8 — GCP adapter: vertical slice · P1 · XL

**Description**: a new `packages/adapters/gcp` implementing `Adapter` with a minimal lowerer set
(Cloud Function/Run + Pub/Sub + GCS + service account/IAM), deploying via Pulumi GCP. Only the Pulumi
GCP SDK lives here.
**Acceptance criteria**: as MCA-7, for GCP.
**Invariants**: N1–N5. **Depends on**: MCA-1, MCA-2, MCA-4, MCA-6.

### MCA-9 — Multi-provider conformance / triad expansion · P2 · L

**Description**: extend the conformance triad matrix (`component × binder × policy_pack`) to add a
`provider` dimension, so policy and determinism gates run per provider.
**Acceptance criteria**:

- Triad matrix parameterized by provider; AWS coverage unchanged; Azure/GCP slices covered.
- A new conformance gate asserts intents are provider-identical pre-lowering across providers (proves N2).
  **Invariants**: N3. **Depends on**: MCA-7 or MCA-8.

### MCA-10 — Multi-cloud blueprints & docs · P2 · M

**Description**: author provider variants (or, under Model B, provider-agnostic blueprints) for the
slice services, plus a "supported providers / support matrix" doc.
**Acceptance criteria**:

- At least one blueprint deployable on ≥2 providers.
- README/support-matrix updated; CLI `--provider` documented in `docs/user/cli-reference.md`.
  **Invariants**: N5. **Depends on**: MCA-7/MCA-8.

**E1 sequencing**: MCA-0 → MCA-1 → MCA-2 → MCA-3 (framework, ~2 weeks) → MCA-4/5/6 → first vertical
slice (MCA-7 _or_ MCA-8) → MCA-9/10. Per-provider parity beyond the slice scales with how many of the
38 blueprints you choose to support.

---

## Epic E2 — Ephemeral Environments (per-PR / per-branch)

**Goal**: spin up an isolated, real deployment per PR/branch for testing & QA, and tear it down
automatically — Gitpod-style throwaway environments for infrastructure.

**Current state (evidence)**:

- Deploy/preview run via the Pulumi Automation API in `packages/adapters/aws/src/deployer.ts`
  (`LocalWorkspace.createOrSelectStack` → `stack.up()/preview()`).
- **No teardown**: the adapter exports only `deploy` and `preview`; `docs/operations/destroy-runbook.md`
  explicitly punts teardown to manual Pulumi operations.
- **Stack naming collides**: `buildStackName` defaults to `{serviceName}-{region}` with no
  per-PR/branch identifier; the `options.stackName` override exists but is not exposed as a CLI flag.
- **State backend is ambient**: `createOrSelectStack` is called with only `{stackName, projectName,
program}` — no `projectSettings.backend`, `secretsProvider`, or `pulumiHome`. State lands in whatever
  `~/.pulumi` / `PULUMI_BACKEND_URL` the runner has.
- **No env/stage wiring**: only `--policy-pack` and `--region` exist. `resolveConfig`
  (`packages/kernel/src/config.ts`) already merges `defaults → environment → overrides` and interpolates
  `${env:KEY}` tokens, but the CLI never feeds it environment-specific values.

### EE-1 — `destroy()` in the adapter/deployer · P0 · S

**Description**: add a teardown path mirroring `deploy()`: `stack.destroy()` then
`workspace.removeStack()`, with the same error classification, progress events, and timeout wrapper.
**Acceptance criteria**:

- `destroy(plan|stackRef, opts)` exported from the adapter and implementing the `Adapter` contract.
- Destroying a non-existent stack returns a structured, non-fatal result.
- Unit tests mock the Automation API and assert destroy + remove ordering.
  **Invariants**: N3, N5. **Depends on**: none (AWS); aligns with MCA-1.

### EE-2 — `down` / `destroy` CLI command · P0 · S

**Description**: a CLI command that resolves the target stack (service + environment + region) and calls
`destroy()`. Safe by default (requires explicit confirmation or `--yes`), structured JSON envelope output.
**Acceptance criteria**:

- `shinobi down <manifest> --environment <name> --region <r>` tears down the matching stack.
- Refuses to destroy without an explicit environment/stack target; never defaults to a shared stack.
- Help text and `docs/user/cli-reference.md` updated.
  **Invariants**: N5. **Depends on**: EE-1, EE-3.

### EE-3 — Environment namespacing (`--environment` flag) · P0 · S

**Description**: thread an environment/stage identifier through `plan`/`up`/`down` into stack naming,
e.g. `{serviceName}-{environment}-{region}` (`auth-pr1234-us-east-1`). Reuses the existing
`options.stackName` override hook.
**Acceptance criteria**:

- `--environment <name>` produces a deterministic, collision-free stack name; two concurrent PRs for the
  same service do not collide.
- Name derivation is pure/deterministic and unit-tested (KL-001).
- Backward compatible: omitting the flag preserves today's `{serviceName}-{region}` name.
  **Invariants**: N3. **Depends on**: none.

### EE-4 — Configurable, isolated state backend + secrets provider · P0 · M

**Description**: pass explicit `LocalWorkspace` options so state is isolated per environment instead of
ambient: backend URL (S3 prefix or Pulumi Cloud), `secretsProvider` (KMS), and project settings. Support
a per-environment state prefix (e.g. `s3://<bucket>/<repo>/<environment>/`).
**Acceptance criteria**:

- Backend + secrets provider are configurable via CLI/env and threaded into `createOrSelectStack`.
- Concurrent ephemeral stacks use isolated, locked state (no shared-state corruption).
- Documented default and an example CI configuration.
  **Invariants**: N1 (config stays in the adapter), N3. **Depends on**: none. **Blocks safe concurrency.**

### EE-5 — Environment-scoped config layer wiring (KL-007) · P1 · M

**Description**: have the CLI build an `environment` config layer from flags/branch metadata and inject
it into the kernel so manifests can reference `${env:...}` values that differ per environment (sizes,
domains, feature toggles) without per-environment manifest copies.
**Acceptance criteria**:

- `--set key=value` / env-file input produces an `environment` layer merged at the correct precedence.
- Compilation remains deterministic for a fixed environment input (KL-001).
- No new branching in components/binders (N4) — values flow through config only.
  **Invariants**: N3, N4. **Depends on**: EE-3.

### EE-6 — Ownership & TTL resource tagging · P1 · S

**Description**: tag every emitted resource with environment metadata (PR number, branch, creator,
created-at, TTL) so cleanup tooling can find stale stacks. Tags flow from CLI context into
`createStandardTags`.
**Acceptance criteria**:

- All resources in an ephemeral stack carry environment + TTL tags.
- Tag values are deterministic given the same inputs (timestamps injected, not generated mid-compile — N3).
  **Invariants**: N3. **Depends on**: EE-3.

### EE-7 — TTL & auto-cleanup orchestration · P1 · L

**Description**: a mechanism to destroy expired/abandoned environments — either an external scheduled
sweep (list stacks by tag/pattern, `down` those past TTL or whose PR is closed) or a deployable cleanup
component. Must be idempotent and safe.
**Acceptance criteria**:

- Stacks past TTL or tied to a closed PR are reliably torn down.
- Dry-run mode lists what would be destroyed; destructive run is explicit.
- Cleanup never touches non-ephemeral (e.g. `prod`) stacks.
  **Invariants**: N3, N5. **Depends on**: EE-1, EE-2, EE-6.

### EE-8 — CI orchestration (GitHub Actions) · P1 · M

**Description**: a reusable workflow: on `pull_request` opened/synchronized → `up --environment
pr-<num>`; on closed/merged → `down --environment pr-<num>`. Posts the environment URL/outputs back to
the PR.
**Acceptance criteria**:

- Opening a PR provisions an isolated environment; pushing updates it; closing destroys it.
- Workflow uses isolated state (EE-4) and scoped credentials.
- Failures surface as structured CI annotations.
  **Invariants**: N5. **Depends on**: EE-2, EE-3, EE-4.

### EE-9 — Idempotent update on PR sync · P1 · S

**Description**: ensure re-running `up` for an existing environment updates in place (Pulumi
`createOrSelectStack` already supports this) and that plan/preview is shown before apply in CI.
**Acceptance criteria**:

- Repeated `up` on the same environment converges (no duplicate resources); preview diff available.
  **Invariants**: N3. **Depends on**: EE-3, EE-8.

### EE-10 — Guardrails: cost, quota, blast-radius · P2 · M

**Description**: optional guardrails so ephemeral envs can't run away — per-environment budget/quota
checks (policy pack or pre-deploy gate), max concurrent environments, and a forced TTL ceiling.
**Acceptance criteria**:

- Exceeding a configured ceiling blocks provisioning with an explainable diagnostic (KL-006).
  **Invariants**: N4, N5. **Depends on**: EE-5, EE-7.

**E2 sequencing**: EE-1 + EE-3 (a usable manual flow in ~2 days) → EE-2 → EE-4 (the correctness work that
makes concurrency safe) → EE-5/6 → EE-8 (CI) → EE-7 (auto-cleanup) → EE-9/10. EE-1, EE-2, and EE-3
generalize cleanly into the `Adapter` contract from MCA-1, so doing E2's teardown work contract-first
also advances E1.

---

## Cross-epic notes

- **Shared leverage**: MCA-1 (`Adapter` interface) and EE-1 (`destroy`) are the two highest-leverage,
  lowest-risk starting points — both are small, self-contained, and never touch the kernel. Define the
  `Adapter` contract to include `destroy` from the start so E1 and E2 converge.
- **What stays untouched**: in both epics the kernel, IR, binder, policy, and contracts' intent model
  require no functional change — only additive interfaces and adapter-layer work. Treat any proposed
  change to those layers as a red flag against N1/N2.
- **Promotion**: when an epic starts, move its in-flight requirements into
  `docs/operations/current-roadmap.md` execution-control tables (Owner / Target Window / Status /
  Blockers / Exit Criteria) and keep this backlog as the scoped source for the rest.
