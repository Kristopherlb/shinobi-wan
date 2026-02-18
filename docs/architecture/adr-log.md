# ADR Log

This file tracks high-impact architecture and behavior decisions for Shinobi V3.

## Purpose

- Preserve decision intent and tradeoffs.
- Improve auditability and onboarding.
- Avoid repeated debates on previously settled boundaries.

## Status Legend

- `proposed`
- `accepted`
- `superseded`
- `rejected`

## ADR Index

| ADR | Title | Status | Date | Supersedes |
|---|---|---|---|---|
| ADR-001 | Deterministic graph-first compilation pipeline | accepted | 2026-02-15 | - |
| ADR-002 | Fail-fast unresolved reference handling in Pulumi program | accepted | 2026-02-15 | - |
| ADR-003 | Network intent lowering behavior is explicit-warning-only in MVP | accepted | 2026-02-15 | - |
| ADR-004 | Runtime builders separated from test fixtures | accepted | 2026-02-15 | - |
| ADR-005 | `plan()` remains pure planning; preview orchestration stays in CLI | accepted | 2026-02-15 | - |
| ADR-006 | Harmony MCP-first integration through wrapper boundary | accepted | 2026-02-16 | - |
| ADR-007 | Plugin-style node lowerer registry with legacy rollback switch | accepted | 2026-02-16 | - |

## ADR Template

```markdown
## ADR-XXX: <title>

- Status: proposed|accepted|superseded|rejected
- Date: YYYY-MM-DD
- Decision Makers: <names or roles>
- Technical Area: <kernel|binder|policy|adapter|cli|validation>
- Related Artifacts: <paths>

### Context
<problem statement and constraints>

### Decision
<the decision itself>

### Consequences
- Positive:
  - <benefit>
- Negative:
  - <cost or risk>

### TDD / Verification
- Red:
  - <failing tests to add>
- Green:
  - <minimal implementation change>
- Refactor:
  - <cleanup while preserving behavior>
- Evidence:
  - <commands and/or test files>

### Follow-ups
- <action items>
```

## ADR-001: Deterministic graph-first compilation pipeline

- Status: accepted
- Date: 2026-02-15
- Technical Area: kernel
- Related Artifacts: `packages/ir`, `packages/kernel`, `packages/conformance`

### Context
Infrastructure output must be reproducible and explainable across repeated runs.

### Decision
Use a graph-first model with deterministic ordering, stable IDs, and frozen compile results.

### Consequences
- Positive:
  - Reproducible outputs and easier conformance testing.
- Negative:
  - Additional strictness/validation complexity.

### TDD / Verification
- Red:
  - Determinism tests in compile and conformance suites.
- Green:
  - Minimal compile pipeline and ordering implementations.
- Refactor:
  - Shared helpers and stricter validation.
- Evidence:
  - `pnpm nx run-many -t test --skipNxCache`

## ADR-002: Fail-fast unresolved reference handling in Pulumi program

- Status: accepted
- Date: 2026-02-15
- Technical Area: adapter
- Related Artifacts: `packages/adapters/aws/src/pulumi-program.ts`

### Context
Placeholder unresolved refs can mask real wiring defects until late runtime.

### Decision
Convert unresolved refs/outputs to deterministic hard failures.

### Consequences
- Positive:
  - Earlier detection of wiring defects.
- Negative:
  - Stricter runtime behavior may fail previously tolerated plans.

### TDD / Verification
- Red:
  - Add tests expecting throw on missing resource/field refs.
- Green:
  - Implement explicit throw paths.
- Refactor:
  - Keep mapping helpers and messages deterministic.

## ADR-003: Network intent lowering behavior is explicit-warning-only in MVP

- Status: accepted
- Date: 2026-02-15
- Technical Area: adapter
- Related Artifacts: `packages/adapters/aws/src/adapter.ts`, `packages/adapters/aws/src/lowerers/network-lowerer.ts`

### Context
Placeholder SG-rule emission looked deployable but was semantically incomplete.

### Decision
Do not emit pseudo network resources. Emit explicit warning diagnostics for unsupported network lowering.

### Consequences
- Positive:
  - Removes false confidence and Potemkin behavior.
- Negative:
  - No deployable network policy output until full implementation lands.

## ADR-004: Runtime builders separated from test fixtures

- Status: accepted
- Date: 2026-02-15
- Technical Area: ir/cli
- Related Artifacts: `packages/ir/src/builders.ts`, `packages/cli/src/manifest/graph-builder.ts`

### Context
Runtime code should not depend on test fixture constructors.

### Decision
Introduce runtime builders (`createNode`, `createEdge`) and keep test fixture helpers test-only.

### Consequences
- Positive:
  - Clear runtime vs test boundary.
- Negative:
  - Slightly more API surface in IR.

## ADR-005: `plan()` remains pure planning; preview orchestration stays in CLI

- Status: accepted
- Date: 2026-02-15
- Technical Area: cli
- Related Artifacts: `packages/cli/src/commands/plan.ts`, `packages/cli/src/cli.ts`

### Context
A mixed contract in `plan()` created API ambiguity.

### Decision
Keep `plan()` pure (validate/lower/generate plan). Keep optional preview orchestration in CLI command flow.

### Consequences
- Positive:
  - Clearer function boundaries and call semantics.
- Negative:
  - Preview requires CLI orchestration for consumers.

## ADR-006: Harmony MCP-first integration through wrapper boundary

- Status: accepted
- Date: 2026-02-16
- Technical Area: cli/integration
- Related Artifacts: `packages/cli/src/integration/*`, `docs/operations/harmony-*.md`

### Context
Shinobi integration needed a deterministic tool envelope and explicit operation classes while keeping mutation paths gated.

### Decision
Adopt wrapper-mediated MCP integration with operation class policy (`read|plan|apply`) and restricted apply defaults.

### Consequences
- Positive:
  - Clear safety boundary and deterministic response contracts.
- Negative:
  - Additional operational wiring and approval dependencies before apply enablement.

## ADR-007: Plugin-style node lowerer registry with legacy rollback switch

- Status: accepted
- Date: 2026-02-16
- Technical Area: adapter
- Related Artifacts: `packages/adapters/aws/src/lowerer-registry.ts`, `packages/adapters/aws/src/adapter.ts`, `packages/adapters/aws/src/__tests__/adapter.test.ts`

### Context
The adapter relied on a hardcoded `NODE_LOWERERS` array. This made extension possible but did not provide explicit registration semantics or a controlled fallback path if registry behavior regressed.

### Decision
Introduce a plugin-style `NodeLowererRegistry` keyed by platform and use it as the default lookup path. Retain a legacy array lookup switch (`useLegacyNodeLowererLookup`) as a rollback safety mechanism during migration.

### Consequences
- Positive:
  - Lowerer extension becomes explicit and easier to reason about.
  - Deterministic lookup remains stable by platform key.
  - Rollback switch reduces deployment risk during architecture transition.
- Negative:
  - Two lookup paths must be kept behaviorally equivalent during transition.

### TDD / Verification
- Red:
  - Add adapter tests for registry/legacy parity and custom registry injection.
- Green:
  - Implement registry class and wire default lookup through adapter.
- Refactor:
  - Keep legacy path behind explicit option for risk-managed migration.
- Evidence:
  - `pnpm nx test adapters-aws --skipNxCache`
  - `pnpm nx test conformance --skipNxCache`
