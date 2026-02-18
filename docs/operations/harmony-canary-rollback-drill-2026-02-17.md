# Harmony Canary And Rollback Pin Drill (2026-02-17)

## Objective

Verify release pin discipline and rollback posture for restricted apply rollout.

## Drill Matrix

| Version Pin | Expected Behavior | Result |
|---|---|---|
| N-1 | known-good contract compatibility | pass |
| N | current candidate behavior | pass |
| N+1 (simulated) | no breaking envelope behavior introduced | pass |

## Rollback Exercise

1. Freeze apply enablement flag changes.
2. Re-pin to N-1 wrapper release candidate.
3. Re-run `validate_plan` and `plan_change`.
4. Confirm deterministic envelope metadata and policy blocks.

## Evidence

- Contract invariants:
  - `packages/cli/src/integration/__tests__/contract.test.ts`
  - `packages/cli/src/integration/__tests__/envelope.test.ts`
- Operational decision guard:
  - `docs/operations/harmony-go-no-go-decision.md`

## Result

- Pin-and-rollback rehearsal completed for non-mutating paths.
- Restricted apply remains gated behind explicit decision package and approvals.
- No envelope schema regression detected in tested matrix.
