# Retrospective: Phase 7 Conformance Golden Tests Implementation

**Date:** 2026-02-11
**Session Duration:** ~20 minutes
**Artifacts Produced:**
- `@shinobi/conformance` package (~350 lines of TypeScript)
- 3 test files, 47 tests passing
- 4 source files (types, golden-runner, index, plus 3 test files)
- End-to-end: Golden graph IR + binder + triad matrix (2 scenarios x 3 packs)

---

## What Went Well

### 1. Plan Was Almost Entirely Accurate
The plan pre-specified the file structure, types, gate coverage, and test scenarios. Implementation was ~95% mechanical. The only correction needed was the expected violation count for admin-wildcard (3 rules, not 4 — see "What Could Have Been Better").

### 2. Existing Integration Tests Provided Reliable Patterns
The policy integration test (`packages/policy/src/__tests__/integration.test.ts`) was the primary pattern source for the triad matrix. The `createKernel()` + `addViolatingGraph()` + `addCleanGraph()` setup pattern mapped directly to `runGoldenCase()` + scenario setup functions.

### 3. Zero Canonical Ordering Issues (PAT-006 Fully Graduated)
No manual snapshot construction was needed — `runGoldenCase()` delegates to `Kernel.compile()` which handles all ordering internally. The pattern is now so internalized that conformance tests never touch raw `GraphSnapshot` construction.

### 4. Module Boundary Handled Correctly From Start
Plan specified `scope:conformance` depending on all 5 prior scopes, and the implementation included the `.eslintrc.json` update in Step 1. No surprise lint failures. This validates IMP-014/PAT-007 guidance — the plan included the module boundary update as a first-class step.

### 5. No Duplicate Test Helpers Created
Unlike prior phases (kernel, binder, policy), conformance imports `createTestNode`/`createTestEdge` directly from `@shinobi/ir` rather than creating local `makeNode`/`makeEdge` aliases. This is the cleanest approach and validates the direction IMP-012 proposes.

### 6. `runGoldenCase()` Eliminated Boilerplate
The golden runner utility wraps Kernel construction, mutation application, and compilation in a single function call. All 3 test files use it (except the G-003 dangling edge test which tests mutation rejection, not compilation).

---

## What Could Have Been Better

### 1. Plan Incorrectly Assumed `iam-no-wildcard-resource` Would Fire
The plan stated the admin-wildcard scenario "triggers all 4 policy rules." In reality, `ComponentPlatformBinder` always emits `scope: 'specific'` on IAM resources (line 93 of `component-platform-binder.ts`). The `iam-no-wildcard-resource` rule only fires when `scope === 'pattern'`, which never occurs with the current binder.

**Root Cause:** The plan was written without verifying the binder's `scope` field value. The rule exists for future binders that might emit wildcard scopes, but the current `ComponentPlatformBinder` is always specific.

**Impact:** ~3 minutes: 4 test failures, diagnosed from error output, corrected expectations from 4 rules to 3 rules, and adjusted compliance expectations for FedRAMP-Moderate (compliant, not non-compliant).

**Fix:** Updated `ADMIN_WILDCARD_EXPECTATIONS` to expect only 3 rules and corrected `expectedCompliant` for FedRAMP-Moderate from `false` to `true`.

### 2. G-003 Required Design Adjustment for Dangling Edge
The plan specified G-003 as "validation fails for dangling edge." In reality, the Graph class rejects dangling edges at mutation time (throws `IntegrityError`, atomic rollback) — the edge never enters the graph, so validation can't fail on it. The test had to be redesigned to verify mutation rejection instead of compilation failure.

**Root Cause:** The plan assumed validation-time rejection, but the graph enforces referential integrity at mutation time (a stricter guarantee).

**Impact:** ~2 minutes to redesign the G-003 test to verify `applyMutation()` returns `success: false` with atomic rollback.

**Fix:** G-003 now tests mutation-level rejection, which is actually a stronger conformance guarantee.

### 3. Minor Unused Import Lint Warning
The `CASE` variable (type `GoldenCase`) in the triad matrix test was assigned but never used, causing an `@typescript-eslint/no-unused-vars` warning. Converted to a comment instead.

**Impact:** ~30 seconds to fix.

---

## The Golden Path

```
+------------------------------------------------------------------+
|  Step 1: Package Infrastructure (2 min)                           |
|  Outputs: package.json (5 deps), project.json (vitest target),   |
|           vitest.config.ts, .eslintrc.json, module boundary,      |
|           pnpm install                                            |
+------------------------------------------------------------------+
                              |
                              v
+------------------------------------------------------------------+
|  Step 2: Types + Golden Runner (2 min)                            |
|  Outputs: types.ts (GoldenCase, TriadCell, GoldenResult),         |
|           golden-runner.ts (runGoldenCase)                         |
|  Pattern: Thin wrapper around Kernel — setup, mutate, compile     |
+------------------------------------------------------------------+
                              |
                              v
+------------------------------------------------------------------+
|  Step 3: Golden Graph Tests (3 min)                               |
|  Outputs: golden-graph.test.ts (6 tests: G-001, G-002, G-003)    |
|  Note: G-003 tests mutation rejection, not compilation failure    |
|  Run tests immediately — validate before proceeding               |
+------------------------------------------------------------------+
                              |
                              v
+------------------------------------------------------------------+
|  Step 4: Golden Binder Tests (3 min)                              |
|  Outputs: golden-binder.test.ts (9 tests: G-020, G-022, G-023)   |
|  Pattern: Verify intent types, structure, canonical order         |
+------------------------------------------------------------------+
                              |
                              v
+------------------------------------------------------------------+
|  Step 5: Golden Triad Matrix Tests (5 min)                        |
|  Outputs: golden-triad-matrix.test.ts (32 tests: G-040, G-041)   |
|  Pattern: describe.each over 6 cells (2 scenarios x 3 packs)     |
|  Note: admin-wildcard triggers 3 rules (NOT 4 — see PAT-009)     |
|  Includes cross-cell severity escalation assertions               |
+------------------------------------------------------------------+
                              |
                              v
+------------------------------------------------------------------+
|  Step 6: Exports + Lint + Full Suite (2 min)                      |
|  Outputs: index.ts barrel, lint clean, 566 total tests passing    |
+------------------------------------------------------------------+
```

**Estimated time with golden path:** ~17 minutes (actual was ~20 minutes due to test expectation corrections)

---

## Recommendations

### Immediate (This Sprint)

| ID | Action | Effort | Impact |
|----|--------|--------|--------|
| IMP-016 | Document binder scope behavior in plan checklist | 15 min | Prevents incorrect policy rule expectations in future conformance tests |
| IMP-012 | Shared test factory (still open) | 1 hour | Conformance imported directly from `@shinobi/ir` — validates approach |

### Near-Term (Next 2 Sprints)

| ID | Action | Effort | Impact |
|----|--------|--------|--------|
| IMP-017 | Conformance gate coverage report script | 30 min | Auto-generate which of the 28 gates are covered vs missing |
| IMP-003 | Package generator with Vitest config | 2 hours | Eliminates Step 1 entirely for new packages |

### Strategic (Roadmap)

| ID | Action | Effort | Impact |
|----|--------|--------|--------|
| — | Expand triad matrix with additional binder types | 2+ hours | Cover triggers/dependsOn edge types in conformance matrix |
| — | Add G-004/G-005/G-021/G-042 gates to conformance | 2+ hours | Cover component manifest, binder input schema, audit records |

---

## Metrics

| Metric | Value | Notes |
|--------|-------|-------|
| Test files | 3 | golden-graph, golden-binder, golden-triad-matrix |
| Tests passing | 47 | All green |
| Source files | 4 | types, golden-runner, index, plus 3 test files |
| Lines of code | ~350 | Including tests |
| Runtime dependencies | 5 | contracts, ir, kernel, binder, policy |
| Dev dependencies | 0 | All deps are runtime (conformance is a test harness) |
| Session duration | ~20 min | Slightly longer than policy due to expectation corrections |
| Lint cleanup | ~30 sec | Unused variable only |
| Test failure debugging | ~5 min | iam-no-wildcard-resource + dangling edge redesign |
| Gates covered | 8 of 12 | G-001/2/3, G-020/22/23, G-040/41 |
| Total workspace tests | 566 | contracts(39) + ir(135) + validation(212) + kernel(45) + binder(44) + policy(44) + conformance(47) |

---

## Key Takeaway

> **The conformance package was the first phase that consumes all prior packages end-to-end, and the only friction came from plan assumptions about policy rule behavior (which rules fire for a given binder scenario). The fix is simple: future plans should verify binder output shapes against policy rule trigger conditions before specifying expected violation counts. The `runGoldenCase()` utility and `describe.each` parameterization pattern make triad matrix expansion trivial.**

---

## Plan Alignment (Mandatory)

### Drift Analysis

1. **admin-wildcard expected 4 rules, actual 3**: Plan assumed `iam-no-wildcard-resource` fires. It doesn't — `ComponentPlatformBinder` always emits `scope: 'specific'`. Plan should have verified binder output before specifying rule expectations.
2. **G-003 redesigned**: Plan assumed validation-time rejection for dangling edges. Graph enforces referential integrity at mutation time (stronger guarantee). Test redesigned to verify mutation rejection.
3. **FedRAMP-Moderate compliance for admin-wildcard**: Plan assumed non-compliant. Actually compliant — only `warning` severity violations at Moderate level for the 3 triggered rules.
4. **Test count exceeded plan**: Plan estimated ~26 tests. Actual: 47 tests — parameterized `describe.each` over 6 cells with 5 tests per cell produced more tests than estimated.

### Plan Updates for Future Phases

```markdown
## Conformance Test Design Checklist (add to plans that involve policy assertions)

Before specifying expected violation counts:
1. Check which IAM scope the binder emits (`scope: 'specific'` vs `scope: 'pattern'`)
2. Check `iam-no-wildcard-resource` only fires for `scope: 'pattern'` — ComponentPlatformBinder never emits this
3. Verify `compliant` semantics: `violations.every(v => v.severity !== 'error')` — warnings/info are compliant
4. Count rules that actually trigger, not rules that exist in the catalog

## Graph Integrity Model

The Graph class enforces referential integrity at mutation time (IntegrityError, atomic rollback).
Dangling edges can never exist in the graph — test mutation rejection, not validation failure.
```

---

## Improvements / Capabilities That Would Help Next

| Type | Proposal | Effort | Expected Impact |
|------|----------|--------|-----------------|
| Documentation | IMP-016: Document binder scope → policy rule mapping | 15 min | Prevents incorrect rule expectations in conformance plans |
| Script | IMP-017: Gate coverage report (gates.md vs test files) | 30 min | Shows which gates need tests, prevents coverage blind spots |
| Skill update | Update conformance-test-design skill with triad matrix patterns | 30 min | Capture describe.each, runGoldenCase, cross-cell assertions |

---

## Files Created

```
packages/conformance/
├── package.json (replaced stub — added 5 deps)
├── project.json (modified — vitest test target)
├── vitest.config.ts (new)
├── .eslintrc.json (new)
└── src/
    ├── index.ts (replaced stub)
    ├── types.ts (GoldenCase, TriadCell, GoldenResult)
    ├── golden-runner.ts (runGoldenCase)
    └── __tests__/
        ├── golden-graph.test.ts (6 tests: G-001, G-002, G-003)
        ├── golden-binder.test.ts (9 tests: G-020, G-022, G-023)
        └── golden-triad-matrix.test.ts (32 tests: G-040, G-041)
```

Also modified:
- `.eslintrc.json` (root — added `scope:conformance` with all 5 scope dependencies)

---

## Next Phase

Phase 8 candidates:
1. **Additional binder types** — `triggers` and `dependsOn` edge binders
2. **Additional policy rules** — config validation, telemetry requirements
3. **More conformance gates** — G-004, G-005, G-021, G-042 (component manifest, binder input schema, audit records)
4. **`cli`** — Validate/plan commands
5. **`adapters/aws`** — Lower intents to Pulumi AWS resources

---

## Follow-Up Actions

- [x] Create retrospective file
- [ ] Update `/retrospectives/PATTERNS.md` with PAT-009
- [ ] Add IMP-016, IMP-017 to `/retrospectives/IMPROVEMENTS.md`
- [ ] Graduate PAT-006 (canonical ordering fully internalized)
- [ ] Update IMP-012 status (conformance validates approach — import directly from @shinobi/ir)
