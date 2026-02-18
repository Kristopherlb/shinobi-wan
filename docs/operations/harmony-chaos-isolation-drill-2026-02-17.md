# Harmony Chaos Isolation Drill (2026-02-17)

## Objective

Validate that apply-path dependency failures stay tool-scoped and do not cascade into read/plan behavior.

## Scenario

1. Force workflow dispatch failure (`503`) on `golden.shinobi.apply_change`.
2. Confirm apply envelope returns deterministic upstream error.
3. Immediately run `validate_plan` and `read_activity`.
4. Confirm read/plan paths remain successful.

## Evidence

- Test: `packages/cli/src/mcp/__tests__/wrapper.test.ts`
  - Case: `keeps read and plan operations healthy after apply dispatch failure`
  - Case: `fails apply start when workflow dispatch endpoint fails`

## Result

| Check | Expected | Observed | Status |
|---|---|---|---|
| apply failure isolation | `DEPENDENCY_UNAVAILABLE` only on apply request | observed | pass |
| validate availability after apply failure | success | observed | pass |
| read availability after apply failure | success | observed | pass |

## Residual Risk

- Drill currently uses controlled test doubles instead of runtime chaos injection in the wrapper process.
- Next action: schedule one non-production live dependency interruption drill and attach trace logs.
