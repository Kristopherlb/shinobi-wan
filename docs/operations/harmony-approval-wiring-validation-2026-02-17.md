# Harmony Approval Wiring Validation (2026-02-17)

## Objective

Enforce approval evidence requirements for restricted apply operations and verify SLA-bound metadata.

## Contract Requirements

Apply requests in restricted mode must include:

- `approval.approvalId`
- `approval.approverRole`
- `approval.approverId`
- `approval.decision = approved`
- `approval.decidedAt`
- `approval.slaMinutes` within `SHINOBI_APPROVAL_MAX_SLA_MINUTES`

## Enforcement Implementation

- Feature flags:
  - `SHINOBI_APPROVAL_REQUIRED` (default `true`)
  - `SHINOBI_APPROVAL_MAX_SLA_MINUTES` (default `60`)
- Wrapper validation:
  - `packages/cli/src/mcp/wrapper.ts`
  - function: `validateApprovalEvidence(...)`

## Test Evidence (TDD)

- `packages/cli/src/mcp/__tests__/wrapper.test.ts`
  - `rejects apply when approval evidence is missing in restricted mode`
  - `rejects apply when approval decision is not approved`
  - `returns async handle for apply start mode when enabled` (with approval evidence)

## Result

| Check | Expected | Observed | Status |
|---|---|---|---|
| missing approval evidence | `APPROVAL_REQUIRED` authorization envelope | observed | pass |
| approval evidence present | async apply accepted with handle | observed | pass |
| SLA threshold validation | threshold enforced by validator | observed | pass |

## Owner Notes

- Owner alias `harmony-owner` is used until Harmony roster IDs are finalized.
- This gate is considered pass for integration/staging; production owner mapping remains an operational follow-up.
