# Improvements

Tracked recommendations from retrospectives. Each improvement has an ID, status, and owner.

---

## Status Legend

| Status | Meaning |
|--------|---------|
| 🟡 Proposed | Identified, not yet started |
| 🔵 In Progress | Work has begun |
| 🟢 Implemented | Complete, awaiting validation |
| ✅ Validated | Confirmed effective |
| ⚪ Declined | Decided not to implement |
| 🗄️ Archived | Obsolete or superseded |

---

## Active Improvements

### IMP-001: Install @nx/eslint-plugin
**Status:** 🟢 Implemented
**Source:** 2026-02-07-kernel-graph-core-implementation
**Effort:** 5 min (actual: 10 min - also needed @typescript-eslint/eslint-plugin, @typescript-eslint/parser, @types/node)
**Impact:** Enables lint checks on all packages

**Action:**
```bash
pnpm add -wD @nx/eslint-plugin @typescript-eslint/eslint-plugin @typescript-eslint/parser @types/node
```

---

### IMP-002: Add tsconfig.json and .eslintrc.json for IR package
**Status:** 🟢 Implemented
**Source:** 2026-02-07-kernel-graph-core-implementation
**Effort:** 5 min
**Impact:** Proper TypeScript compilation, IDE support, and linting

**Action:** Created `packages/ir/tsconfig.json` and `packages/ir/.eslintrc.json`.

---

### IMP-003: Package Generator with Vitest Config
**Status:** 🟡 Proposed
**Source:** 2026-02-07-kernel-graph-core-implementation
**Effort:** 2 hours
**Impact:** Consistent package scaffolding, eliminates test framework setup friction

**Action:** Create Nx generator or template that includes:
- `vitest.config.ts`
- `tsconfig.json`
- `tsconfig.spec.json`
- Correct `project.json` test target

---

### IMP-004: Update TDD Skill with Type-Only Import Guidance
**Status:** 🟡 Proposed
**Source:** 2026-02-07-kernel-graph-core-implementation
**Effort:** 30 min
**Impact:** Prevents false-positive tests in TypeScript projects

**Action:** Add section to `.claude/skills/test-driven-development/SKILL.md`:
```markdown
## TypeScript-Specific Guidance

When testing TypeScript modules, always include at least one runtime import
(constant, function, or class) in your test file. Type-only imports are
elided by the compiler and won't cause test failures if the module is missing.

❌ Bad (test passes even if module doesn't exist):
```typescript
import type { Node } from '../types';
```

✅ Good (test fails if module is missing):
```typescript
import { NODE_TYPES, type Node } from '../types';
```
```

---

### IMP-005: Golden Snapshot Fixtures
**Status:** 🟡 Proposed
**Source:** 2026-02-07-kernel-graph-core-implementation
**Effort:** 1 hour
**Impact:** Regression testing for serialization format stability

**Action:** Create `packages/ir/src/__tests__/__fixtures__/` with:
- `minimal-graph.json`
- `complex-graph.json`
- Golden snapshot tests that compare against these fixtures

---

### IMP-006: Barrel Export Validation Script
**Status:** 🟡 Proposed
**Source:** 2026-02-07-contract-layer-implementation
**Effort:** 30 min
**Impact:** Catches export mismatches before type-checking fails

**Action:** Create a script that:
1. Parses `index.ts` for exported names
2. Verifies each export exists in the referenced module
3. Runs as part of CI or pre-commit hook

---

### IMP-007: Contract Authoring Skill
**Status:** 🟡 Proposed
**Source:** 2026-02-07-contract-layer-implementation
**Effort:** 1 hour
**Impact:** Standardizes contract patterns, reduces decision overhead

**Action:** Create `.claude/skills/contract-authoring/` with guidance on:
- Including runtime constants alongside types
- schemaVersion on all interfaces
- Backend-neutral field naming
- Stable ID formats

---

### IMP-008: Auto-Generate Barrel Exports
**Status:** 🟡 Proposed
**Source:** 2026-02-07-contract-layer-implementation
**Effort:** 2 hours
**Impact:** Eliminates export drift entirely

**Action:** Create generator that scans `*.ts` files and produces `index.ts` with all public exports. Run on file changes or as build step.

---

### IMP-009: Package Scaffolding Template with Vitest Aliases
**Status:** 🟡 Proposed
**Source:** 2026-02-09-validation-pipeline-implementation
**Effort:** 30 min
**Impact:** Eliminates vitest alias debugging for new packages

**Action:** Update package scaffolding to include vitest.config.ts with:
```typescript
import { resolve } from 'path';

export default defineConfig({
  resolve: {
    alias: {
      '@shinobi/contracts': resolve(__dirname, '../contracts/src/index.ts'),
      '@shinobi/ir': resolve(__dirname, '../ir/src/index.ts'),
      // Add other workspace packages as needed
    },
  },
  // ...
});
```

---

### IMP-010: Validation Pattern Skill
**Status:** 🟡 Proposed
**Source:** 2026-02-09-validation-pipeline-implementation
**Effort:** 1 hour
**Impact:** Standardizes 3-layer validation approach (schema → semantic → determinism)

**Action:** Create `.claude/skills/validation-patterns/` documenting:
- Error model with deterministic sorting
- Schema validation layer (field validators, type validators)
- Semantic validation layer (references, forbidden patterns, least-privilege)
- Determinism validation layer (ordering, hashing, stable IDs)
- Orchestrator pattern with validation levels

---

### IMP-011: IR Test Fixture Generators
**Status:** 🟡 Proposed
**Source:** 2026-02-09-validation-pipeline-implementation
**Effort:** 2 hours
**Impact:** Type-safe test data creation, reduces boilerplate

**Action:** Create `packages/ir/src/__tests__/fixtures/` with factory functions:
```typescript
export function createTestNode(overrides?: Partial<Node>): Node { ... }
export function createTestEdge(source: string, target: string, overrides?: Partial<Edge>): Edge { ... }
export function createTestArtifact(sourceNodeId: string, overrides?: Partial<DerivedArtifact>): DerivedArtifact { ... }
```

### IMP-012: Shared Test Factory for Graph Fixtures
**Status:** 🟡 Proposed (validated by conformance — direct @shinobi/ir imports work well)
**Source:** 2026-02-09-kernel-orchestrator-implementation
**Effort:** 1 hour
**Impact:** Eliminates duplicate `makeNode`/`makeEdge`/`makeSnapshot` helpers across packages; auto-applies canonical ordering (PAT-006 graduation)

**Action:** Create shared test utilities (either in `@shinobi/ir` or as a separate `@shinobi/test-utils` package):
```typescript
export function createTestNode(overrides: { id: string; type: NodeType } & Partial<Node>): Node { ... }
export function createTestEdge(overrides: { id: string; type: EdgeType; source: string; target: string } & Partial<Edge>): Edge { ... }
export function createTestSnapshot(nodes: Node[], edges: Edge[], artifacts?: DerivedArtifact[]): GraphSnapshot {
  return {
    schemaVersion: '1.0.0',
    nodes: [...nodes].sort(compareNodes),
    edges: [...edges].sort(compareEdges),
    artifacts: [...(artifacts ?? [])].sort(compareArtifacts),
  };
}
```

---

### IMP-013: Workspace Dependency Linter
**Status:** 🟡 Proposed
**Source:** 2026-02-09-kernel-orchestrator-implementation
**Effort:** 30 min
**Impact:** Prevents `pnpm install` failures from hardcoded version references to workspace packages

**Action:** Create a script or CI check that scans all `packages/*/package.json` files and verifies that any dependency matching `@shinobi/*` uses `workspace:*` rather than a hardcoded version.

### IMP-014: Module Boundary Checklist in Plan Template
**Status:** 🟡 Proposed
**Source:** 2026-02-10-policy-evaluator-implementation
**Effort:** 15 min
**Impact:** Prevents lint failures from missing module boundary scope tags for test-only dependencies

**Action:** Add to plan template:
```markdown
## Module Boundary Checklist
For each dependency (including devDeps used in tests):
- [ ] Added to package.json (dependencies or devDependencies)
- [ ] Scope tag added to root .eslintrc.json module boundary
- [ ] Verified with `pnpm nx lint <package>`
```

---

### IMP-015: Lint-Safe Patterns Skill
**Status:** 🟡 Proposed
**Source:** 2026-02-10-policy-evaluator-implementation
**Effort:** 30 min
**Impact:** Eliminates recurring lint cleanup from non-null assertions and unused imports

**Action:** Document patterns in memory/skills:
- Pre-resolve catalog lookups at module level instead of using `!`
- Guard with `&& RULE_X` in conditional logic
- Remove unused type imports before running lint
- Run `pnpm nx lint <package>` early (before tests) to catch issues

### IMP-016: Document Binder Scope → Policy Rule Mapping
**Status:** 🟡 Proposed
**Source:** 2026-02-11-conformance-golden-tests-implementation
**Effort:** 15 min
**Impact:** Prevents incorrect policy rule expectations in conformance plans

**Action:** Add a conformance test design checklist to plan templates:
```markdown
## Conformance Test Design Checklist
Before specifying expected violation counts:
1. Check which IAM scope the binder emits (scope: 'specific' vs 'pattern')
2. iam-no-wildcard-resource only fires for scope: 'pattern' — ComponentPlatformBinder never emits this
3. Verify compliant semantics: violations.every(v => v.severity !== 'error')
4. Count rules that actually trigger, not rules that exist in the catalog
```

---

### IMP-017: Conformance Gate Coverage Report Script
**Status:** 🟡 Proposed
**Source:** 2026-02-11-conformance-golden-tests-implementation
**Effort:** 30 min
**Impact:** Auto-generates which of the 12 gates defined in gates.md are covered by conformance tests

**Action:** Create a script that:
1. Parses `docs/conformance/gates.md` for gate IDs
2. Scans conformance test files for gate ID references
3. Reports covered vs uncovered gates
4. Currently covered: G-001/2/3, G-020/22/23, G-040/41 (8 of 12)
5. Missing: G-004, G-005, G-021, G-042

---

## Impact Tracking

_Record actual impact after implementation._

| ID | Expected Impact | Actual Impact | Validated |
|----|-----------------|---------------|-----------|
| IMP-001 | Enables lint checks | Lint now runs on ir (15 warnings) and contracts (8 warnings) | ✅ |
| IMP-002 | TypeScript compilation | IR package type-checks; lint and test pass | ✅ |

---

## Archived

_Improvements that are obsolete or superseded._

(None yet)
