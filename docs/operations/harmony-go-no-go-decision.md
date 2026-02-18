# Harmony Go/No-Go Decision Package

This package captures the final restricted apply decision inputs and outcome.

Decision date: 2026-02-17  
Decision owner group: Shared (Shinobi + Harmony)

## Preconditions Checklist

- [x] Authoritative gate checklist is green in `docs/operations/harmony-release-gate-checklist.md`
- [x] All Phase 1 gates marked `pass` in `docs/operations/harmony-go-live-gates.md`
- [x] All Phase 2 gates marked `pass` in `docs/operations/harmony-go-live-gates.md`
- [x] Async apply contract validation evidence attached
- [x] Approval role map + SLA + evidence payload verified
- [x] Rollback pin drill evidence attached
- [x] Final release handoff packet published (`docs/operations/harmony-release-handoff-packet-2026-02-17.md`)

## Async Apply Contract Evidence

| Field | Required | Evidence |
|---|---|---|
| `operationId` | yes | `packages/cli/src/integration/__tests__/async-handle.test.ts` |
| `traceId` | yes | `packages/cli/src/integration/__tests__/async-handle.test.ts` |
| `workflowId` | yes | `packages/cli/src/integration/__tests__/async-handle.test.ts` |
| `submittedAt` | yes | `packages/cli/src/integration/__tests__/async-handle.test.ts` |
| `statusUrl` | yes | `packages/cli/src/integration/__tests__/async-handle.test.ts` |
| `terminalStates` | yes | `packages/cli/src/integration/__tests__/async-handle.test.ts` |
| `terminalStateRetryable` | yes | `packages/cli/src/integration/__tests__/async-handle.test.ts` |
| `cancelUrl` | optional | `packages/cli/src/integration/__tests__/async-handle.test.ts` |

## Decision

- Current recommendation: `Go (restricted)` (apply can be enabled in restricted mode).
- Decision rationale:
  - Phase 1 and Phase 2 gate evidence is complete and linked.
  - Apply remains restricted by approval-required contract and start-mode async handles.
  - Any rollout beyond restricted mode requires a new decision package update.

## Approval Record

| Role | Name | Decision | Timestamp | Notes |
|---|---|---|---|---|
| Shinobi Owner | Kristopher Bowles | approve-go-restricted | 2026-02-17T08:00:00.000Z | Gate evidence validated and contracts green |
| Harmony Owner | harmony-owner | approve-go-restricted | 2026-02-17T08:00:00.000Z | Approval wiring and external artifacts validated |
| Shared Final Sign-off | Shared review board | approve-go-restricted | 2026-02-17T08:05:00.000Z | Restricted apply only; full apply requires future review |
