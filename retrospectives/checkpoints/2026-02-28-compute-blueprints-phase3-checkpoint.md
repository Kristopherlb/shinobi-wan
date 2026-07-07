# Checkpoint: Compute Blueprints — Phase 3 (BP-007 Scheduled Batch Processing)

**Date:** 2026-02-28
**Session:** Phase 3 implementation + DRY refactoring
**Phase:** 3 of 5

## Progress

- [x] EventBridge Scheduler lowerer (`eventbridge-lowerer.ts`) — ScheduleGroup + Schedule
- [x] Step Functions lowerer (`stepfunctions-lowerer.ts`) — LogGroup + StateMachine
- [x] Data map updates (PLATFORM_REF_MAP, OUTPUT_MAP, ACTION_MAP, ARN patterns)
- [x] Lowerer registry, adapter, index, pulumi-program updates
- [x] EventBridge→Lambda/StepFunctions integration generator in adapter.ts
- [x] 50 lowerer unit tests (scheduler-sfn-lowerers.test.ts) — all pass
- [x] 2 policy rules: stepfunctions-logging-disabled, eventbridge-retry-missing
- [x] SEVERITY_MAP entries for 2 rules × 3 packs
- [x] 7 policy rule tests (compute-rules.test.ts) — all pass
- [x] Blueprint manifest (blueprints/compute/scheduled-batch.yaml)
- [x] Golden conformance test (golden-blueprint-scheduled-batch.test.ts) — 12 tests pass
- [x] FedRAMP audit: Baseline COMPLIANT (1 info), FedRAMP-Moderate COMPLIANT (1 warning), FedRAMP-High NON-COMPLIANT (1 error — iam-missing-conditions, expected)
- [x] **DRY refactoring** (user-requested mid-phase):
  - Data-driven `checkComputeNodes()` — replaced 155 lines of if-chains with `NODE_RULE_CHECKS` array (~30 lines)
  - `createStandardTags()` utility in `lowerers/utils.ts`
  - `makeResourceName()` utility in `lowerers/utils.ts`

## Test Counts

| Suite       | Before Phase 3 | After Phase 3 | Delta   |
| ----------- | -------------- | ------------- | ------- |
| adapter-aws | 260            | 310           | +50     |
| policy      | 66             | 73            | +7      |
| conformance | 163            | 175           | +12     |
| **Total**   | 489            | 558           | **+69** |

## Learnings

### Data-driven evaluator eliminates all node-level boilerplate

The `NODE_RULE_CHECKS` array replaces per-rule if-blocks. Adding the 2 Phase 3 rules (stepfunctions-logging-disabled, eventbridge-retry-missing) required only 2 data entries (10 lines) instead of 2 if-blocks (28 lines). This is now the canonical pattern for all future node-level policy rules. The evaluator went from 285 lines to ~160 lines with identical behavior (all 73 policy tests pass).

### ScheduleBinder deferred — TriggersBinder handles platform→platform triggers

The plan specified a new `ScheduleBinder` for EventBridge→target edges. However, the `triggers` edge from `platform:daily-trigger` → `platform:batch-workflow` passes through the kernel without binder compilation (TriggersBinder only handles `platform→component`). The actual integration (schedule target configuration) happens in the adapter's `generateEventBridgeIntegrations()`. This mirrors the Phase 2 pattern (PAT-017) — infrastructure-level relationships are resolved by lowerers, not binders.

### Integration generator pattern repeats (adapter.ts)

This is the 3rd edge-walking generator function in adapter.ts (EventSourceMappings, ApiGwIntegrations, EventBridgeIntegrations). All three share identical boilerplate: walk edges → find nodes → check platforms → emit resources. The DRY review identified this as a consolidation opportunity (medium priority). Deferring to post-Phase 5 to avoid disrupting the implementation flow.

### `createStandardTags()` and `makeResourceName()` utilities ready for adoption

Created but not yet applied to existing lowerers (would be a large diff with no behavioral change). New lowerers in Phase 4/5 should use these utilities from the start.

## Friction

### PAT-014 recurrence (3rd occurrence — graduation candidate)

Changed `rules.test.ts` from `toHaveLength(10)` → `toHaveLength(12)`. This is the 3rd occurrence across 3 phases. Should graduate to a dynamic assertion.

## Plan Alignment

### Delivered vs. planned

Plan specified: ~62 new tests, 6 new files, 7 modified files, 1 new ScheduleBinder.

- Actual: **69 new tests** (exceeded), **6 new files** (exact), **10 modified files** (exceeded due to DRY refactoring), **0 new binders** (ScheduleBinder deferred — handled by adapter integration generator instead)
- ScheduleBinder was unnecessary — TriggersBinder doesn't handle platform→platform edges, and the adapter integration generator handles the wiring directly

### Proposed plan update

Remove ScheduleBinder from Phase 3 scope. The adapter integration generator pattern (`generateEventBridgeIntegrations`) is sufficient and avoids a new binder that would need module boundary updates.

## DRY Refactoring Summary (user-requested)

### Completed (high priority)

1. **Policy evaluator data-driven refactor**: 155 → 30 lines, `NODE_RULE_CHECKS` array
2. **`createStandardTags()`**: Centralizes tag construction for all lowerers
3. **`makeResourceName()`**: Centralizes `serviceName-shortName` naming pattern

### Identified but deferred (medium priority)

4. **Adapter integration generator consolidation**: 3 functions → 1 data-driven function
5. **Platform metadata co-location**: 4 scattered maps → 1 unified file
6. **Test helper consolidation**: Eliminate DEFAULT_CONTEXT duplication

### Impact

- Evaluator: 285 → 160 lines (44% reduction), new rules = 5-line data entry
- Total lines saved: ~125 (with more savings as Phase 4/5 rules use the new pattern)
