# Harmony Go-Live Gates

This document records rollout gate outcomes for Shinobi integration.
Authoritative gate checklist: `docs/operations/harmony-release-gate-checklist.md`.

## Go/No-Go Gate Table

| Gate | Phase | Owner | Status | Pass Condition | Blocker if Fail | Evidence |
|---|---|---|---|---|---|---|
| Contract Conformance | 1 | Kristopher Bowles (Shinobi) | pass | All MCP tool responses validate against canonical envelope schema | Release blocked | `packages/cli/src/integration/__tests__/contract.test.ts` |
| Read/Plan SLO | 1 | Kristopher Bowles (Shinobi) | pass | validate p95 <= 2s, plan p95 <= 5s, success targets met | Stay in pilot | `docs/operations/harmony-pilot-slo-report-2026-02-17.md` |
| Error Taxonomy Stability | 1 | Kristopher Bowles (Shinobi) | pass | No unknown error codes in golden tests | Release blocked | `packages/cli/src/integration/__tests__/envelope.test.ts` |
| Isolation Chaos Test | 2 | Kristopher Bowles (Shinobi) + harmony-owner | pass | Wrapper/worker failure stays tool-scoped, no platform-wide impact | No phase advance | `docs/operations/harmony-chaos-isolation-drill-2026-02-17.md` |
| Approval Wiring Validation | 2 | harmony-owner | pass | Role map + SLA + evidence payload enforced for restricted tools | No apply enable | `docs/operations/harmony-approval-wiring-validation-2026-02-17.md` |
| Canary + Rollback Pin | 2 | Kristopher Bowles (Shinobi) + harmony-owner | pass | N-1/N/N+1 checks + rollback pin verified | No apply enable | `docs/operations/harmony-canary-rollback-drill-2026-02-17.md` |
| External Wiring Complete | 2 | harmony-owner | pass | Queue/workflow names, status/cancel shape, flags, metrics finalized | No sign-off | `docs/operations/harmony-external-wiring-evidence-2026-02-17.md` |
| Restricted Apply Enablement | 3 | Kristopher Bowles (Shinobi) + harmony-owner | pass | All prior gates green + explicit approval decision | Keep apply disabled | `docs/operations/harmony-go-no-go-decision.md` |

## Current Recommendation

- Apply remains restricted to approved rollout contexts only.
- Read/plan rollout can proceed while periodic evidence refresh continues.
- Weekly status in gate tracking must use `on-track`, `at-risk`, or `blocked`.

## Decision Rule

- **Go**: all required gates `pass`.
- **No-Go**: any gate `fail` or `blocked`.
- **Conditional**: temporary exception allowed only with documented owner, expiration, and mitigation.
