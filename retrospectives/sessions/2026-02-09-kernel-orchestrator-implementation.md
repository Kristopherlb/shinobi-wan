# Retrospective: Phase 4 Kernel Orchestrator Implementation

**Date:** 2026-02-09
**Session Duration:** ~25 minutes
**Artifacts Produced:**
- `@shinobi/kernel` package (~750 lines of TypeScript)
- 4 test files, 45 tests passing
- 8 source files + 2 interface files
- Compilation pipeline: validate → bind → policy → freeze

---

## What Went Well

### 1. Plan Was Nearly Zero-Friction
The Phase 4 plan was the best-structured plan yet. Every file was pre-specified with exact interfaces, types, and test expectations. Implementation was almost mechanical — decisions were already made. This validates the trend observed in Phase 3: better plans → faster implementation.

### 2. Smooth Integration with Existing Packages
The kernel correctly composed `Graph` from `@shinobi/ir`, `validateGraph`/`validateIntent` from `@shinobi/validation`, and types from `@shinobi/contracts`. No type mismatches required fixing at the interface boundary — the plan accurately reflected the real APIs.

### 3. No Vitest Alias Issues
Unlike Phase 3, no path alias problems occurred. The kernel's `vitest.config.ts` didn't need explicit aliases because pnpm workspace resolution worked correctly. This may be because the dependencies were already properly linked.

### 4. Dependency Direction Corrected
The plan correctly identified that kernel should depend on `validation`, not on `binder`/`policy`. Removing `@shinobi/binder` and `@shinobi/policy` from `package.json` was the right call — kernel defines interfaces *for* those packages.

### 5. Clean Lint on First Try (Almost)
After removing unused imports and replacing `!` non-null assertions with optional chaining (`?.`), the kernel achieved 0 lint errors, 0 lint warnings. The cleanup was minor and fast.

---

## What Could Have Been Better

### 1. Canonical Ordering in Test Snapshots
The `makeSnapshot` test helper initially didn't sort nodes/edges via `compareNodes`/`compareEdges`. The validation pipeline rejected the snapshot as non-canonical, causing one test to fail with a confusing "Cannot read properties of undefined" error (because `result.intents` was empty).

**Root Cause:** Test code constructed `GraphSnapshot` manually without canonical ordering.
**Impact:** ~3 minutes debugging
**Fix:** Added `[...nodes].sort(compareNodes)` and `[...edges].sort(compareEdges)` to the test helper.

**This is the 3rd occurrence of this pattern.** See PAT-006 below.

### 2. Validation Package Had Hardcoded Deps
`packages/validation/package.json` had `"@shinobi/contracts": "0.0.1"` and `"@shinobi/ir": "0.0.1"` instead of `workspace:*`. This caused `pnpm install` to fail trying to resolve from npm. Already documented in memory but still present.

**Impact:** ~1 minute to fix
**Root Cause:** Not fixed during Phase 3 implementation.

### 3. Wrong Import Source for `validateGraph`
Initially imported `validateGraph` from `@shinobi/ir` instead of `@shinobi/validation`. Quick fix once spotted.

**Impact:** ~30 seconds
**Root Cause:** Both packages export validation-related functions; easy to confuse.

---

## The Golden Path

```
┌─────────────────────────────────────────────────────────────────────┐
│  Step 1: Package Config (2 min)                                     │
│  Outputs: package.json, project.json, vitest.config.ts              │
└─────────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────────┐
│  Step 2: Standalone Utilities (3 min)                               │
│  Outputs: freeze.ts, errors.ts + freeze.test.ts (7 tests)          │
└─────────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────────┐
│  Step 3: Types + Interfaces (3 min)                                 │
│  Outputs: types.ts, interfaces/{binder,policy,index}.ts             │
└─────────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────────┐
│  Step 4: Config Resolution (4 min)                                  │
│  Outputs: config.ts, config.test.ts (14 tests)                      │
└─────────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────────┐
│  Step 5: Compilation Pipeline (5 min)                               │
│  Outputs: compilation-pipeline.ts, test.ts (10 tests)               │
│  Note: Use sorted snapshots in test helpers!                        │
└─────────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────────┐
│  Step 6: Kernel Class + Root Exports (5 min)                        │
│  Outputs: kernel.ts, kernel.test.ts (14 tests), index.ts            │
└─────────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────────┐
│  Step 7: Lint + Verify (2 min)                                      │
│  Fix unused imports, non-null assertions → 0 errors                 │
└─────────────────────────────────────────────────────────────────────┘
```

**Estimated time with golden path:** ~22 minutes (vs ~25 minutes actual)

---

## Recommendations

### Immediate (This Sprint)

| ID | Action | Effort | Impact |
|----|--------|--------|--------|
| IMP-011 | IR test fixture generators with canonical ordering | 2 hours | Prevents PAT-006 recurrence; reduces test boilerplate across all packages |

### Near-Term (Next 2 Sprints)

| ID | Action | Effort | Impact |
|----|--------|--------|--------|
| IMP-012 | Shared test helpers package (or shared fixtures module) | 1 hour | Kernel and validation both define `makeNode`/`makeEdge` — consolidate |
| IMP-003 | Package generator (existing) | 2 hours | Eliminates config setup entirely |

### Strategic (Roadmap)

| ID | Action | Effort | Impact |
|----|--------|--------|--------|
| IMP-013 | Workspace dep linter (reject non-workspace:* internal deps) | 30 min | Prevents validation's `0.0.1` bug from recurring |

---

## Metrics

| Metric | Value | Notes |
|--------|-------|-------|
| Test files | 4 | freeze, config, compilation-pipeline, kernel |
| Tests passing | 45 | All green |
| Source files | 10 | Including interfaces/ |
| Lines of code | ~750 | Including tests |
| Runtime dependencies | 3 | contracts, ir, validation |
| Session duration | ~25 min | Fastest phase yet |
| Test failure debugging | ~3 min | Canonical ordering issue |
| Lint cleanup | ~2 min | Unused imports + non-null assertions |

---

## Key Takeaway

> **The kernel implementation was the fastest phase yet (~25 min for 45 tests), validating that plan quality compounds: each phase learns from the prior phase's retrospective, and detailed plans with exact interfaces eliminate decision overhead almost entirely.**

---

## Plan Alignment (Mandatory)

### Drift Analysis
Implementation matched the plan very closely:

1. **Test helper fix**: `makeSnapshot` needed canonical ordering — not in plan
2. **Validation deps fix**: `workspace:*` fix was a pre-existing bug, not plan drift
3. **Import source fix**: `validateGraph` imported from wrong package — 30-second fix
4. **Scope unchanged**: All planned files, types, interfaces, and tests delivered

### Plan Updates for Future Phases
For binder/policy implementation:

```markdown
## Test Helpers (add to every phase plan)

When constructing GraphSnapshot objects in tests, ALWAYS sort via canonical
comparators. Use this pattern:

```typescript
import { compareNodes, compareEdges, compareArtifacts } from '@shinobi/ir';

function makeSnapshot(nodes: Node[], edges: Edge[]): GraphSnapshot {
  return {
    schemaVersion: '1.0.0',
    nodes: [...nodes].sort(compareNodes),
    edges: [...edges].sort(compareEdges),
    artifacts: [],
  };
}
```
```

### New Preflight Steps
- Verify `workspace:*` in all `package.json` deps before `pnpm install`
- Double-check import sources: `validateGraph` is from `@shinobi/validation`, not `@shinobi/ir`

---

## Improvements / Capabilities That Would Help Next

| Type | Proposal | Effort | Expected Impact |
|------|----------|--------|-----------------|
| Generator | Shared `makeNode`/`makeEdge`/`makeSnapshot` test factory | 1 hour | Eliminates duplicate helpers across packages |
| Linter | Workspace dep validator (no hardcoded versions) | 30 min | Prevents pnpm resolution failures |
| Skill | Kernel integration skill (how to wire binders/evaluators) | 30 min | Reduces onboarding friction for Phase 5 |

---

## Files Created

```
packages/kernel/
├── project.json (modified - added test target)
├── package.json (modified - deps corrected)
├── vitest.config.ts (new)
└── src/
    ├── index.ts (replaced stub)
    ├── freeze.ts
    ├── errors.ts
    ├── types.ts
    ├── config.ts
    ├── compilation-pipeline.ts
    ├── kernel.ts
    ├── interfaces/
    │   ├── index.ts
    │   ├── binder-interface.ts
    │   └── policy-evaluator-interface.ts
    └── __tests__/
        ├── freeze.test.ts (7 tests)
        ├── config.test.ts (14 tests)
        ├── compilation-pipeline.test.ts (10 tests)
        └── kernel.test.ts (14 tests)
```

Also modified:
- `packages/validation/package.json` (fixed `0.0.1` → `workspace:*`)

---

## Next Phase

Phase 5 candidates (per CLAUDE.md sequence):
1. `binder` — First real binder end-to-end (kernel interfaces are ready)
2. `policy` — First policy rule (kernel interfaces are ready)
3. `conformance` — First golden test

The kernel now exports `IBinder` and `IPolicyEvaluator` interfaces, so binder and policy packages can depend on kernel and implement these contracts.

---

## Follow-Up Actions

- [x] Create retrospective file
- [x] Update `/retrospectives/PATTERNS.md` with PAT-006
- [x] Add recommendations to `/retrospectives/IMPROVEMENTS.md`
