# Harmony Staging Game Day Drill (2026-02-17)

## Objective

Exercise the full restricted-apply operator path in staging posture:

1. plan and fingerprint capture,
2. approval evidence validation,
3. apply start-mode dispatch handling,
4. terminal-state triage behavior,
5. rollback-to-known-good decision path.

## Scope

- Environment class: staging
- Operation mode: restricted apply (`start`)
- Evidence source: deterministic integration/wrapper test suite + existing rollback pin drill

## Drill Steps And Results

| Step | Action | Expected | Observed | Status |
|---|---|---|---|---|
| 1 | Generate plan + fingerprint (`plan_change`) | plan envelope success with fingerprint | observed in wrapper tests | pass |
| 2 | Submit apply with valid approval evidence | async handle returned (`operationId`, `workflowId`, `statusUrl`) | observed in wrapper tests | pass |
| 3 | Submit apply with missing approval evidence | deterministic `APPROVAL_REQUIRED` error | observed in wrapper tests | pass |
| 4 | Submit apply with non-approved decision | deterministic `APPROVAL_REQUIRED` error | observed in wrapper tests | pass |
| 5 | Simulate workflow dispatch failure (`503`) | deterministic `DEPENDENCY_UNAVAILABLE` error | observed in wrapper tests | pass |
| 6 | Run read/plan after apply dispatch failure | read/plan still healthy | observed in wrapper tests | pass |
| 7 | Execute rollback-to-known-good posture | re-pin to known-good and validate envelopes | covered by rollback pin drill evidence | pass |

## Command Transcript

```bash
pnpm vitest run \
  packages/cli/src/integration/__tests__/contract.test.ts \
  packages/cli/src/integration/__tests__/envelope.test.ts \
  packages/cli/src/integration/__tests__/async-handle.test.ts \
  packages/cli/src/integration/__tests__/workflow-client.test.ts \
  packages/cli/src/mcp/__tests__/wrapper.test.ts
```

Observed summary:

- Test files: `5 passed`
- Tests: `30 passed`

## Rollback-To-Known-Good Posture

Rollback drill reference:

- `docs/operations/harmony-canary-rollback-drill-2026-02-17.md`

Operator rollback path validated for restricted rollout:

1. freeze new apply requests,
2. pin to known-good release candidate,
3. re-run validate/plan contract checks,
4. reopen restricted apply only after gate re-check.

## Triage Notes

- Apply-path failure class remains isolated (`DEPENDENCY_UNAVAILABLE`) and does not cascade to read/plan paths.
- Approval evidence gates fail closed before mutating path progression.
- Idempotency and plan-fingerprint checks continue to gate apply requests.

## Residual Risk

- This game day is exercised through deterministic test doubles and wrapper contracts.
- A non-production live workflow interruption drill should be scheduled to collect runtime trace evidence with real workflow infrastructure.
