# Harmony Gate Evidence Tracker

This file tracks gate evidence artifacts and current execution risk for rollout hardening.
Authoritative gate decision source: `docs/operations/harmony-release-gate-checklist.md`.

## Weekly Status Legend

- `on-track`: expected to close in target window
- `at-risk`: closure likely to slip without intervention
- `blocked`: cannot close until external dependency is resolved

## Phase 1 Evidence

| Gate | Weekly Status | Owner | Target Window | Evidence Artifact | Open Risk | Next Action |
|---|---|---|---|---|---|---|
| Contract Conformance | pass | Kristopher Bowles (Shinobi) | 2026-02-17 | `packages/cli/src/integration/__tests__/contract.test.ts` | Low - monitor contract drift on enum changes | Keep contract tests green in CI |
| Read/Plan SLO | pass | Kristopher Bowles (Shinobi) | 2026-02-17 | `docs/operations/harmony-pilot-slo-report-2026-02-17.md` | Medium - re-capture after traffic shape changes | Re-run pilot SLO capture weekly |
| Error Taxonomy Stability | pass | Kristopher Bowles (Shinobi) | 2026-02-17 | `packages/cli/src/integration/__tests__/envelope.test.ts` | Low - unknown runtime classes still possible on new upstreams | Add runtime unknown-code alert in wrapper logs |

## Phase 2 Evidence

| Gate | Weekly Status | Owner | Target Window | Evidence Artifact | Open Risk | Next Action |
|---|---|---|---|---|---|---|
| Isolation Chaos Test | pass | Kristopher Bowles (Shinobi) + harmony-owner | 2026-02-17 | `docs/operations/harmony-chaos-isolation-drill-2026-02-17.md` | Medium - chaos drill currently synthetic/test-driven only | Schedule non-prod fault-injection replay |
| Approval Wiring Validation | pass | harmony-owner | 2026-02-17 | `docs/operations/harmony-approval-wiring-validation-2026-02-17.md` | Medium - owner roster still aliases pending HRIS sync | Replace aliases with finalized roster IDs |
| Canary + Rollback Pin | pass | Kristopher Bowles (Shinobi) + harmony-owner | 2026-02-17 | `docs/operations/harmony-canary-rollback-drill-2026-02-17.md` | Medium - drill cadence not yet automated | Add monthly canary drill calendar guardrail |
| External Wiring Complete | pass | harmony-owner | 2026-02-17 | `docs/operations/harmony-external-wiring-evidence-2026-02-17.md` | Low - depends on environment parity across staging/prod | Validate artifact parity during prod cutover review |

## Async Apply Handle Contract Validation

Required fields:

- `operationId`
- `traceId`
- `workflowId`
- `submittedAt`
- `statusUrl`
- `terminalStates`
- `terminalStateRetryable`
- optional `cancelUrl`

Validation evidence:

- `packages/cli/src/integration/__tests__/async-handle.test.ts`
- `packages/cli/src/integration/async-handle.ts`
- `packages/cli/src/integration/__tests__/workflow-client.test.ts`
- `packages/cli/src/mcp/__tests__/wrapper.test.ts`

Approval evidence contract validation:

- `packages/cli/src/mcp/__tests__/wrapper.test.ts` (approval required + SLA enforcement paths)
- `packages/cli/src/mcp/wrapper.ts` (`validateApprovalEvidence` gate)
- `packages/cli/src/integration/feature-flags.ts` (`SHINOBI_APPROVAL_REQUIRED`, `SHINOBI_APPROVAL_MAX_SLA_MINUTES`)

## Restricted Apply Readiness

Restricted apply remains disabled by default until:

1. All Phase 1 and Phase 2 gates are `pass`.
2. Shared go/no-go decision is explicitly recorded.
3. Approval evidence payload contract is validated in the target environment.

Current status (2026-02-17):

- Preconditions 1 and 2 are satisfied in documented evidence.
- Preconditions 3 is satisfied for integration and staging validation.

## Staging Game Day Evidence

- `docs/operations/harmony-staging-game-day-2026-02-17.md`
  - Includes restricted apply start-mode flow, approval failure checks, apply failure isolation, and rollback-to-known-good posture.
