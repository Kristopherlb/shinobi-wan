# Harmony External Wiring Evidence (2026-02-17)

## Objective

Confirm required workflow/status wiring artifacts and environment controls for restricted apply orchestration.

## Required Wiring Artifacts

| Artifact | Source | Status |
|---|---|---|
| workflow name | `SHINOBI_HARMONY_WORKFLOW_NAME` | pass |
| task queue | `SHINOBI_HARMONY_TASK_QUEUE` | pass |
| status base URL | `SHINOBI_HARMONY_STATUS_BASE_URL` | pass |
| dispatch URL | `SHINOBI_HARMONY_DISPATCH_URL` | pass |
| apply enablement flag | `SHINOBI_APPLY_ENABLED` | pass |
| apply mode flag | `SHINOBI_APPLY_MODE` | pass |

## Contract Validation Coverage

- `packages/cli/src/integration/__tests__/workflow-client.test.ts`
  - Dispatch + status endpoint behavior
- `packages/cli/src/mcp/__tests__/wrapper.test.ts`
  - Missing wiring returns `DEPENDENCY_UNAVAILABLE`
  - Apply start mode dispatch behavior

## Result

- External wiring contract is complete for current integration path.
- Missing-wiring behavior remains fail-fast and deterministic.
- Wrapper retains read/plan continuity when apply wiring fails.
