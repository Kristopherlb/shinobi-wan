# Harmony Release Gate Checklist

This is the authoritative release gate checklist for Harmony integration readiness.

Use this document as the single gate source for:

- release owner go/no-go reviews,
- on-call pre-apply checks,
- restricted apply enablement decisions.

## Gate Evaluation Rule

- **Go**: every required gate is `pass` with current evidence.
- **No-Go**: any required gate is `fail` or `blocked`.
- **Conditional**: allowed only with explicit owner, expiration, and mitigation.

## Required Gates

| Gate | Phase | Owner | Pass Condition | Evidence |
|---|---|---|---|---|
| Contract Conformance | 1 | Kristopher Bowles (Shinobi) | MCP responses validate against canonical envelope schema | `packages/cli/src/integration/__tests__/contract.test.ts` |
| Read/Plan SLO | 1 | Kristopher Bowles (Shinobi) | Validate p95 <= 2s and plan p95 <= 5s in pilot window | `docs/operations/harmony-pilot-slo-report-2026-02-17.md` |
| Error Taxonomy Stability | 1 | Kristopher Bowles (Shinobi) | No unknown error codes in golden tests | `packages/cli/src/integration/__tests__/envelope.test.ts` |
| Isolation Chaos Test | 2 | Kristopher Bowles (Shinobi) + harmony-owner | Apply-path dependency failure remains tool-scoped | `docs/operations/harmony-chaos-isolation-drill-2026-02-17.md` |
| Approval Wiring Validation | 2 | harmony-owner | Restricted apply requires approval evidence and SLA validation | `docs/operations/harmony-approval-wiring-validation-2026-02-17.md` |
| Canary + Rollback Pin | 2 | Kristopher Bowles (Shinobi) + harmony-owner | N-1/N/N+1 drill and rollback pin verification pass | `docs/operations/harmony-canary-rollback-drill-2026-02-17.md` |
| External Wiring Complete | 2 | harmony-owner | Dispatch/status wiring, flags, and metrics contract complete | `docs/operations/harmony-external-wiring-evidence-2026-02-17.md` |
| Restricted Apply Enablement | 3 | Kristopher Bowles (Shinobi) + harmony-owner | All prior gates pass and shared sign-off is recorded | `docs/operations/harmony-go-no-go-decision.md` |

## Current Status Snapshot (2026-02-17)

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

## Required Evidence Bundle For Each Release Candidate

1. `docs/operations/harmony-rollout-dashboard.md`
2. `docs/operations/harmony-gate-evidence.md`
3. `docs/operations/harmony-go-no-go-decision.md`
4. `docs/operations/harmony-determinism-report-2026-02-17.md`
5. Most recent staged game-day drill record
6. `docs/operations/harmony-release-handoff-packet-2026-02-17.md`

## Operator Quick Check (Friday 4:30)

- [ ] Confirm all required gates remain `pass` in this document.
- [ ] Confirm gate evidence files are present and current.
- [ ] Confirm decision package sign-offs are current.
- [ ] Confirm rollback-to-known-good drill evidence exists and is current.
- [ ] Confirm restricted apply guardrails are still enabled (`approval required`, idempotency enforced, async status path wired).
