# Harmony Release Handoff Packet (2026-02-17)

## Release Intent

Authorize senior DevOps operators to run restricted Harmony apply with confidence under the established MVP safety posture.

Operating mode:

- Wrapper mode enabled
- Restricted apply enabled only in approved target environment
- Approval evidence and idempotency required

## Gate Status Snapshot

Source of truth:

- `docs/operations/harmony-release-gate-checklist.md`

Current snapshot:

| Gate | Status |
|---|---|
| Contract Conformance | pass |
| Read/Plan SLO | pass |
| Error Taxonomy Stability | pass |
| Isolation Chaos Test | pass |
| Approval Wiring Validation | pass |
| Canary + Rollback Pin | pass |
| External Wiring Complete | pass |
| Restricted Apply Enablement | pass |

Dashboard reference:

- `docs/operations/harmony-rollout-dashboard.md`

## Decision Records

- Go/no-go package: `docs/operations/harmony-go-no-go-decision.md`
- Gate tracker: `docs/operations/harmony-go-live-gates.md`
- Weekly evidence tracker: `docs/operations/harmony-gate-evidence.md`

## Determinism And Contract Evidence

- Determinism report: `docs/operations/harmony-determinism-report-2026-02-17.md`
- Core contract tests:
  - `packages/cli/src/integration/__tests__/contract.test.ts`
  - `packages/cli/src/integration/__tests__/envelope.test.ts`
  - `packages/cli/src/integration/__tests__/async-handle.test.ts`
  - `packages/cli/src/integration/__tests__/workflow-client.test.ts`
  - `packages/cli/src/mcp/__tests__/wrapper.test.ts`

## Rollback Evidence

- Canary + rollback pin drill: `docs/operations/harmony-canary-rollback-drill-2026-02-17.md`
- Staging game-day drill (includes rollback-to-known-good path):
  - `docs/operations/harmony-staging-game-day-2026-02-17.md`

Rollback posture for operators:

1. freeze apply requests,
2. re-pin to known-good release candidate,
3. re-run validate/plan checks,
4. reopen restricted apply only after gate re-check.

## Operator Run Commands

Primary operator runbook:

- `docs/operations/runbook.md`

Required command sequence:

```bash
node packages/cli/dist/main.js validate <manifest.yaml>
node packages/cli/dist/main.js plan <manifest.yaml> --region <region>
node packages/cli/dist/main.js up <manifest.yaml> --region <region> --code-path <lambda.zip>
node packages/cli/dist/main.js up <manifest.yaml> --region <region> --code-path <lambda.zip> --no-dry-run
```

Harmony envelope validation:

```bash
node packages/cli/dist/main.js validate <manifest.yaml> --harmony-envelope --trace-id <trace-id>
node packages/cli/dist/main.js plan <manifest.yaml> --harmony-envelope --trace-id <trace-id>
```

## Ownership And Escalation

| Responsibility | Primary Owner | Escalation |
|---|---|---|
| Wrapper/integration contract behavior | Kristopher Bowles (Shinobi) | Shared review board |
| Approval role/SLA policy and external wiring | harmony-owner | Shared review board |
| Gate state and release decision package | Shared (Shinobi + Harmony) | Shared final sign-off |
| Production execution and rollback decision | Platform owner on duty | Designated reviewer + shared board |

## Open Risks And Follow-Ups

- Runtime CLI repeat-run determinism check in this local environment was blocked by missing `@pulumi/pulumi`; rerun in release runtime with Pulumi dependencies installed.
- Non-production live workflow interruption drill should be scheduled to complement test-double chaos evidence.

## Handoff Decision

Recommendation: **Go (restricted)** with current guardrails.

Conditions:

- Keep approval-required policy active.
- Keep idempotency and plan-fingerprint enforcement active.
- Do not broaden to unrestricted apply without a new gate review and decision package refresh.
