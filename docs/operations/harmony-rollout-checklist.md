# Harmony Rollout Checklist

Use this checklist to promote Shinobi + Harmony integration safely from read/plan pilot to restricted apply enablement.

## Phase 1: Read/Plan Pilot (2-3 weeks)

- [x] `SHINOBI_WRAPPER_MODE_ENABLED=true` in pilot environment.
- [x] `SHINOBI_APPLY_ENABLED=false` in all environments.
- [x] `golden.shinobi.validate_plan` and `golden.shinobi.plan_change` contract tests pass.
- [x] `golden.shinobi.read_entities` and `golden.shinobi.read_activity` return deterministic envelopes.
- [x] p95 validate latency <= 2s.
- [x] p95 plan latency <= 5s.
- [x] non-validation error rate <= 1%.
- [x] trace/audit fields verified for 100% of pilot calls.

## Phase 2: Hardening

- [x] Retry policy enforced by operation class.
- [x] Idempotency keys validated for apply candidate calls.
- [x] Chaos isolation test executed (wrapper crash does not cascade to MCP process).
- [x] Canary rollback pin test executed (version pin rollback validated).
- [x] Approval flow dry-run completed for restricted tools.
- [x] Degraded-mode behavior validated for wrapper unavailable scenarios.

## Phase 3: Apply Enablement (Restricted)

- [x] `SHINOBI_APPLY_ENABLED=true` only in target environment.
- [x] `golden.shinobi.apply_change` defaults to `start` mode.
- [x] Approver role map and SLA documented and active.
- [x] Async handle contract fields validated (`operationId`, `traceId`, `workflowId`, `statusUrl`).
- [x] Error budget criteria still green after canary.
- [x] On-call runbook references updated and acknowledged.

## Go/No-Go Gate

Go when all are true:

- [x] SLOs pass for pilot window.
- [x] Error budget burn remains below threshold.
- [x] Isolation and rollback drills pass.
- [x] Approval and audit evidence capture is complete.

Evidence tracking artifacts:

- `docs/operations/harmony-release-gate-checklist.md`
- `docs/operations/harmony-gate-evidence.md`
- `docs/operations/harmony-go-no-go-decision.md`

No-Go if any are true:

- [ ] Unknown retriable error classes exceed threshold.
- [ ] Missing trace/audit correlation in restricted path.
- [ ] Wrapper instability triggers repeated temporary-unavailable events.

## Ownership Matrix

| Acceptance Criterion | Owner |
|---|---|
| Canonical envelope contract remains deterministic and versioned | Shinobi |
| Operation-class policy enforcement (`read|plan|apply`) | Shinobi |
| Approval role map and decision SLA enforcement | Harmony |
| Workflow/queue/status endpoint wiring artifacts | Harmony |
| Isolation and canary rollback drills | Shared |
| Restricted apply enablement decision | Shared |

## Post-Enablement Verification

- [ ] First restricted apply completed with full evidence trail.
- [ ] Async status transitions match contract terminal states.
- [ ] No uncontrolled retries on mutating operations.
- [ ] Rollback compensation path exercised in non-production.

Apply remains disabled unless and until all phase 2 gates are green and Harmony-owned wiring artifacts are received.
