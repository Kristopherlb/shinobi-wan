# Retrospective: Phase 6 Policy Evaluator Implementation

**Date:** 2026-02-10
**Session Duration:** ~15 minutes
**Artifacts Produced:**
- `@shinobi/policy` package (~400 lines of TypeScript)
- 5 test files, 44 tests passing
- 6 source files (including evaluators/ barrel)
- End-to-end: Kernel + Binder + Policy → compile → violations with severity tiers

---

## What Went Well

### 1. Plan Was Comprehensive and Required Zero Design Decisions
The plan pre-specified all 4 rules, all 3 severity packs, the exact module structure, every test case, and the integration test shape. Implementation was purely mechanical — zero architectural decisions needed at coding time. This is the strongest validation yet that investing in plan quality compounds across phases.

### 2. Existing Patterns Made Implementation Fast
Patterns from binder (intent factories, test helpers, integration tests) mapped 1:1 onto policy. The `createViolation` factory follows the exact same shape as `createIamIntent`/`createNetworkIntent`: enforce schemaVersion, compute stable ID, freeze output. Test helpers (`makeNode`, `makeEdge`, `makeSnapshot`) were copy-paste from binder with additions (`makeIamIntent`, `makeNetworkIntent`).

### 3. No Canonical Ordering Issues (PAT-006 Fully Internalized)
Test snapshots used sorted comparators from the start. The `makeSnapshot` helper in the policy test-helpers.ts correctly applies `compareNodes`/`compareEdges`. No debugging time lost to this pattern — the 3-occurrence graduation in PAT-006 and explicit plan guidance worked.

### 4. Integration Test Worked First Try
The Kernel + Binder + Policy end-to-end integration test passed on the first run. All 7 integration tests verified: Baseline compliance, FedRAMP-High non-compliance, clean graph compliance, violation structure, deterministic sorting, deterministic output, and frozen result.

### 5. Rules-as-Data Design is Clean and Extensible
The separation of `RULE_CATALOG` (what rules exist), `SEVERITY_MAP` (how severe per pack), and `BaselinePolicyEvaluator` (where rules are applied) means adding a new rule requires only: (1) add to catalog, (2) add severity entries, (3) add check logic. No pack branching — KL-008 enforced by design.

---

## What Could Have Been Better

### 1. Module Boundary Required Two Adjustments
The original plan specified adding `scope:kernel` to `scope:policy`'s module boundary. This was correct. However, the integration test also imports `@shinobi/binder`, requiring `scope:binder` to be added as well. The plan mentioned `@shinobi/binder` as a devDependency but did not mention the eslint module boundary update.

**Root Cause:** Module boundary constraints apply to all files including tests. The plan's "Reusable Existing Code" table listed binder for integration tests but didn't flag the eslint boundary.
**Impact:** ~1 minute to add `scope:binder` to module boundary after lint failure.
**Fix:** Added `scope:binder` to `scope:policy` in root `.eslintrc.json`.

### 2. Non-Null Assertions Flagged by Lint
The initial evaluator used `RULE_CATALOG.find(...)!` (non-null assertion) to look up rules. ESLint flagged 4 instances of `@typescript-eslint/no-non-null-assertion`.

**Root Cause:** The `!` operator is a known lint violation in this repo (documented in PAT/memory). The plan didn't pre-resolve this.
**Impact:** ~2 minutes to refactor. Pre-resolved rules at module level instead.
**Fix:** Used `getRuleById()` at module scope, then guard with `&& RULE_X` in the check.

### 3. Unused Import Flagged by Lint
The evaluator imported `Intent` type that wasn't used. The test imported `IamIntent` and `NetworkIntent` types that weren't needed after the `makeContext` function signature was changed to use `Intent`.

**Impact:** ~30 seconds each cleanup.

### 4. Duplicate Test Helpers Across Packages (IMP-012 Still Open)
Policy now has its own `makeNode`/`makeEdge`/`makeSnapshot` — identical copies exist in binder and kernel test directories. This is the 3rd (or 4th) copy. IMP-012 (shared test factory) is still proposed.

**Impact:** No debugging time, but technical debt accumulates.

---

## The Golden Path

```
┌─────────────────────────────────────────────────────────────────────┐
│  Step 1: Package Config (2 min)                                     │
│  Outputs: package.json, project.json, vitest.config.ts,             │
│           .eslintrc.json, module boundary update, pnpm install       │
│  Note: Update BOTH scope:policy deps AND devDeps boundary            │
└─────────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────────┐
│  Step 2: Violation Factory (2 min)                                   │
│  Outputs: violation-factory.ts + test (5 tests)                      │
│  Pattern: Same as intent factories — enforce schema, stable ID,      │
│           freeze output                                              │
└─────────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────────┐
│  Step 3: Rule Catalog (2 min)                                        │
│  Outputs: rules.ts + test (6 tests)                                  │
│  Pattern: Pure data, no code. ReadonlyArray<PolicyRule>.              │
└─────────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────────┐
│  Step 4: Severity Map (2 min)                                        │
│  Outputs: severity-map.ts + test (6 tests)                           │
│  Pattern: Record<pack, Record<ruleId, Severity>>.                    │
│  Tests: verify escalation from Baseline → Moderate → High.           │
└─────────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────────┐
│  Step 5: Evaluator + Test Helpers (4 min)                            │
│  Outputs: baseline-policy-evaluator.ts + test (20 tests),            │
│           test-helpers.ts                                            │
│  Note: Pre-resolve rules at module level (avoid ! assertions)        │
└─────────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────────┐
│  Step 6: Integration Test (2 min)                                    │
│  Outputs: integration.test.ts (7 tests)                              │
│  Tests: Kernel + Binder + Policy → compile → verify violations       │
│  Note: Requires @shinobi/binder devDep + scope:binder boundary       │
└─────────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────────┐
│  Step 7: Exports + Lint + Verify (1 min)                             │
│  Fix: unused imports, non-null assertions → 0 errors, 0 warnings    │
│  Verify: pnpm nx run-many -t test → 519 tests, 0 regressions        │
└─────────────────────────────────────────────────────────────────────┘
```

**Estimated time with golden path:** ~15 minutes (matches actual)

---

## Recommendations

### Immediate (This Sprint)

| ID | Action | Effort | Impact |
|----|--------|--------|--------|
| IMP-012 | Shared test factory package (`makeNode`/`makeEdge`/`makeSnapshot`) | 1 hour | 3+ copies now exist (kernel, binder, policy). Consolidate. |
| IMP-014 | Add module boundary checklist to plan template | 15 min | Prevents lint failures from missing boundary entries |

### Near-Term (Next 2 Sprints)

| ID | Action | Effort | Impact |
|----|--------|--------|--------|
| IMP-003 | Package generator with Vitest config | 2 hours | Eliminates Steps 1 entirely for new packages |
| IMP-015 | Pre-resolve lint patterns skill | 30 min | Document no-non-null-assertion pattern and module-level lookup approach |

### Strategic (Roadmap)

| ID | Action | Effort | Impact |
|----|--------|--------|--------|
| IMP-013 | Workspace dep linter | 30 min | Prevents hardcoded version bugs |

---

## Metrics

| Metric | Value | Notes |
|--------|-------|-------|
| Test files | 5 | violation-factory, rules, severity-map, evaluator, integration |
| Tests passing | 44 | All green |
| Source files | 6 | Including evaluators/index.ts barrel |
| Lines of code | ~400 | Including tests |
| Runtime dependencies | 3 | contracts, ir, kernel |
| Dev dependencies | 1 | binder (integration tests only) |
| Session duration | ~15 min | Fastest non-trivial phase |
| Lint cleanup | ~2 min | Non-null assertions + unused imports |
| Test failure debugging | ~1 min | Module boundary only |
| Total workspace tests | 519 | contracts(39) + ir(135) + validation(212) + kernel(45) + binder(44) + policy(44) |

---

## Key Takeaway

> **The policy implementation was the smoothest phase yet (~15 min, 44 tests, 0 design decisions at coding time), confirming that the pattern established in binder — factory + catalog + map + evaluator — is a reliable, repeatable template. Plans that pre-resolve lint patterns (no `!`, module boundary for devDeps) and include exact test cases eliminate nearly all friction.**

---

## Plan Alignment (Mandatory)

### Drift Analysis
Implementation matched the plan very closely:

1. **Module boundary for binder**: Plan did not mention adding `scope:binder` to `scope:policy` — required for integration test imports. Added during lint fix.
2. **Non-null assertions**: Plan used `RULE_CATALOG.find(...)!` pattern. Lint rejects `!`. Refactored to pre-resolved module-level lookups.
3. **Unused imports**: Minor cleanup needed (removed `Intent` from evaluator, `IamIntent`/`NetworkIntent` from test after signature change).
4. **Scope unchanged**: All 4 rules, 3 packs, all tests, integration tests delivered exactly as planned.

### Plan Updates for Future Phases

```markdown
## Module Boundary Checklist (add to every phase plan)

When a package has integration tests that import from other packages:
1. Add the package as a devDependency in package.json
2. Also add its scope tag to the module boundary in root .eslintrc.json
3. Run `pnpm nx lint <package>` before running tests to catch early

## Lint-Safe Patterns

- Never use `!` non-null assertion. Instead, pre-resolve lookups at module level:
  ```typescript
  const RULE_X = getRuleById('rule-id'); // undefined | PolicyRule
  if (condition && RULE_X) { ... }       // guard instead of !
  ```
- Remove unused type imports before committing
```

### New Preflight Steps
- Verify ALL dependency scopes in module boundary (including devDeps used in tests)
- Pre-resolve rule/constant lookups at module level to avoid non-null assertions

---

## Improvements / Capabilities That Would Help Next

| Type | Proposal | Effort | Expected Impact |
|------|----------|--------|-----------------|
| Shared Lib | Shared `@shinobi/test-utils` package for makeNode/makeEdge/makeSnapshot/makeIamIntent/makeNetworkIntent | 1 hour | Eliminates 3+ copies of identical test helpers |
| Checklist | Module boundary checklist in plan template | 15 min | Prevents lint failures from missing boundary scope tags |
| Skill | Lint-safe patterns skill (no `!`, pre-resolve at module level) | 30 min | Eliminates recurring lint cleanup step |

---

## Files Created

```
packages/policy/
├── package.json (replaced stub)
├── project.json (modified - added test target)
├── vitest.config.ts (new)
├── .eslintrc.json (new)
└── src/
    ├── index.ts (replaced stub)
    ├── violation-factory.ts
    ├── rules.ts
    ├── severity-map.ts
    ├── evaluators/
    │   ├── index.ts
    │   └── baseline-policy-evaluator.ts
    └── __tests__/
        ├── test-helpers.ts
        ├── violation-factory.test.ts (5 tests)
        ├── rules.test.ts (6 tests)
        ├── severity-map.test.ts (6 tests)
        ├── evaluators/
        │   └── baseline-policy-evaluator.test.ts (20 tests)
        └── integration.test.ts (7 tests)
```

Also modified:
- `.eslintrc.json` (root — added `scope:kernel` and `scope:binder` to `scope:policy`)

---

## Next Phase

Phase 7 candidates (per CLAUDE.md sequence):
1. `conformance` — First golden test (triad matrix: component × binder × policy_pack)
2. Additional binder types (triggers, dependsOn edge types)
3. Additional policy rules (config validation, telemetry requirements)
4. `cli` — Validate/plan commands

The triad matrix is now testable: we have component→platform bindings (binder), 3 policy packs (policy), and the kernel orchestrator. A conformance golden test can exercise: `my-svc → aws-sqs` × `ComponentPlatformBinder` × `{Baseline, FedRAMP-Moderate, FedRAMP-High}`.

---

## Follow-Up Actions

- [x] Create retrospective file
- [x] Update `/retrospectives/PATTERNS.md` with PAT-006 update + PAT-007, PAT-008
- [x] Add IMP-014, IMP-015 to `/retrospectives/IMPROVEMENTS.md`
