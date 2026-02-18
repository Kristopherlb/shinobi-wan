# Shinobi Current Roadmap

This document is the canonical roadmap for active work. It consolidates implementation progress and rollout status into one place.

Last updated: 2026-02-16

## Scope

Shinobi currently has two parallel roadmap tracks:

1. Core platform delivery (kernel/binder/policy/conformance/adapter maturity)
2. Harmony integration rollout (read/plan pilot -> hardening -> restricted apply)

## Status Legend

- `Done`: completed and validated in repo artifacts/tests
- `In Progress`: active track with outstanding gates/tasks
- `Next`: planned follow-on work not yet complete
- Weekly execution status taxonomy: `on-track`, `at-risk`, or `blocked`.

## Perspective Model (Agent-First)

Roadmap quality is evaluated from five perspectives, ordered by execution criticality:

1. `Agent` (primary): tool discoverability, deterministic behavior, input/output clarity, HITL boundaries.
2. `Platform Engineers`: architecture invariants, package boundaries, deterministic compilation.
3. `Operations`: runbook quality, gate closure, rollback posture.
4. `Security/Compliance`: auditability, severity policy, approval controls.
5. `Leadership/Product`: milestone confidence, measurable progress, delivery risk.

Current assessment:

- Agent confidence: `medium` (strong structure, but execution controls were previously implicit).
- Platform confidence: `high`.
- Operations confidence: `medium`.
- Security/compliance confidence: `medium`.
- Leadership predictability: `medium`.

## Track A: Core Platform Delivery

### Done

- `Phase 1` IR graph core implemented (`packages/ir`) with deterministic foundations and tests.
- `Phase 2` contracts layer implemented (`packages/contracts`).
- `Phase 3` validation pipeline implemented (`packages/validation`).
- `Phase 4` kernel orchestrator implemented (`packages/kernel`).
- `Phase 5/Resource Expansion` binder + adapter expansion for DynamoDB/S3/API Gateway and triggers flow.
- `Phase 6` policy evaluator implemented (`packages/policy`).
- `Phase 7` conformance golden tests implemented (`packages/conformance`).
- `Phase 8A` utility extraction + SNS lowerer + additional conformance gates completed.

### In Progress

- Conformance gate registry coverage is complete: coverage is `12/12` gates.

### Next

- Continue adapter expansion via existing lowerer pattern (e.g., EventBridge/CloudFront/RDS candidates).
- Continue hardening plugin-style lowerer registry rollout while legacy fallback exists.

### Execution Control (Track A)

| Work Item | Owner | Target Window | Status | Blockers | Exit Criteria |
|---|---|---|---|---|---|
| `G-005` conformance gate | Shinobi | Completed | `Done` | None | Gate tests merged and green in CI |
| `G-042` conformance gate | Shinobi | Completed | `Done` | None | Gate tests merged and green in CI |
| Triad matrix expansion | Shinobi | Completed (phase scope) | `Done` | None | Added DynamoDB/S3/SNS/API Gateway scenario coverage in conformance tests |
| Additional lowerers | Shinobi | Rolling | `Next` | Prioritization not finalized | At least one new lowerer shipped with tests and wiring checklist complete |
| Plugin-style lowerer registry | Shinobi | In progress | `In Progress` | Final migration off legacy fallback still pending | Registry abstraction implemented with parity tests and legacy fallback retired |

## Track B: Harmony Integration Rollout

### Done

- Integration contract and envelope model documented and wired for MCP-facing read/plan/apply tool classes.
- Rollout and go/no-go gate documents are in place:
  - `docs/operations/harmony-rollout-checklist.md`
  - `docs/operations/harmony-go-live-gates.md`
  - `docs/operations/harmony-integration.md`

### In Progress

- Restricted apply enablement is active with approval-required start mode.
- Ongoing work is focused on operational cadence (weekly SLO recapture and monthly chaos/canary drills).

### Next

- Validate production owner roster parity (replace `harmony-owner` alias with roster IDs).
- Automate recurring evidence capture for SLO and drill cadence.
- Re-run go/no-go package before broadening apply scope beyond restricted mode.

### Execution Control (Track B)

| Work Item | Owner | Target Window | Status | Blockers | Exit Criteria |
|---|---|---|---|---|---|
| Phase 1 gate closure | Kristopher Bowles (Shinobi) | 2026-02-17 | `Done` | None | All Phase 1 checklist boxes complete |
| Phase 2 hardening closure | Kristopher Bowles (Shinobi) + harmony-owner | 2026-02-17 | `Done` | None | All Phase 2 checklist boxes complete |
| Async apply handle validation | Kristopher Bowles (Shinobi) | 2026-02-17 | `Done` | None | Contract fields validated in E2E evidence |
| Restricted apply decision | Shared review board | 2026-02-17 | `Done` | None | Explicit go/no-go sign-off recorded |

### Critical Path

`G-005 + G-042 + Harmony Phase 2 hardening gates -> shared go/no-go -> restricted apply enablement (completed 2026-02-17)`

## Source-of-Truth Order

When docs disagree, use this precedence for roadmap status:

1. `retrospectives/sessions/*.md` (completed implementation evidence)
2. `docs/operations/harmony-*.md` (active rollout gate state)
3. `docs/conformance/gates.md` (authoritative gate registry)
4. `CLAUDE.md` (project context; may lag implementation status)

## Notes on Drift

- `CLAUDE.md` still describes an earlier "current state" sequence that does not reflect Phase 8A progress.
- Keep this document as the canonical active roadmap and update it when a phase/gate changes state.

## Hindsight Decision Deltas

With current evidence, the following decisions would be made earlier if starting again:

1. Establish an explicit Agent-first roadmap review from day one (discoverability, contract clarity, HITL boundaries).
2. Add execution control fields (`owner`, `target window`, `blockers`, `exit criteria`) in the first roadmap revision.
3. Treat conformance gate completion as a first-class milestone stream, not a trailing hardening task.
4. Introduce adapter lowerer registry design work earlier to avoid long-term hardcoded map growth.
5. Keep apply disabled by default until evidence-based hardening gates are complete (this decision remains correct in hindsight).
