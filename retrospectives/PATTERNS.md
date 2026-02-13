# Patterns

Recurring patterns observed across retrospectives. Patterns with ≥3 occurrences are candidates for graduation to formal solutions.

---

## Active Patterns

### 🔴 Friction

#### PAT-001: TypeScript Type-Only Imports Create False-Positive Tests
**Occurrences:** 2
**Sessions:** 2026-02-07-kernel-graph-core-implementation, 2026-02-07-contract-layer-implementation

**Description:** When writing tests that only use `import type { ... }`, TypeScript/esbuild elides the import entirely. The test file compiles and runs even if the module doesn't exist, creating a false sense of coverage.

**Impact:** Wasted debugging time; tests that don't actually verify anything

**Proposed Resolution:** Always include at least one runtime import (constant, function, class) in test files. Add guidance to test-driven-development skill.

---

#### PAT-002: Test Framework Preference Not Captured
**Occurrences:** 1
**Sessions:** 2026-02-07-kernel-graph-core-implementation

**Description:** Different projects prefer different test frameworks (Jest vs Vitest). This preference isn't always documented, leading to config churn mid-implementation.

**Impact:** ~5 minutes recreating config files

**Proposed Resolution:** Add test framework preference to CLAUDE.md or package.json metadata.

---

#### PAT-004: Barrel Export Drift
**Occurrences:** 1
**Sessions:** 2026-02-07-contract-layer-implementation

**Description:** Root `index.ts` barrel exports can list items that don't exist in source modules. Tests pass (types are elided), but type-checking fails later.

**Impact:** ~3 minutes debugging export mismatches

**Proposed Resolution:** Create a barrel export validation script or auto-generate exports from source files.

---

#### PAT-005: Vitest Path Alias Resolution
**Occurrences:** 1
**Sessions:** 2026-02-09-validation-pipeline-implementation

**Description:** Vitest doesn't automatically inherit path aliases from `tsconfig.base.json`. Each package's `vitest.config.ts` needs explicit `resolve.alias` configuration to import from workspace packages.

**Impact:** ~2 minutes debugging "Cannot find package" errors

**Proposed Resolution:** Add vitest alias configuration to package generator template, or create shared vitest base config with auto-discovered aliases.

---

---

#### PAT-007: Module Boundary Missing for Test-Only Dependencies
**Occurrences:** 1
**Sessions:** 2026-02-10-policy-evaluator-implementation

**Description:** When a package has integration tests that import from another workspace package (e.g., policy tests importing binder), the package needs both a `devDependency` in `package.json` AND the corresponding scope tag in the root `.eslintrc.json` module boundary rules. Plans tend to mention the devDependency but forget the module boundary update.

**Impact:** ~1 minute to diagnose and fix lint error

**Proposed Resolution:** Add a "module boundary checklist" to the plan template: for every devDep, verify the scope tag is in the module boundary.

---

#### PAT-008: Non-Null Assertions in Rule/Catalog Lookups
**Occurrences:** 1
**Sessions:** 2026-02-10-policy-evaluator-implementation

**Description:** When looking up items from a known catalog (e.g., `RULE_CATALOG.find(r => r.ruleId === 'x')!`), the `!` non-null assertion is flagged by `@typescript-eslint/no-non-null-assertion`. The fix is to pre-resolve lookups at module level and guard with `&&`.

**Impact:** ~2 minutes refactoring

**Proposed Resolution:** Document the "pre-resolve at module level" pattern in memory/skills. Use `const RULE_X = getRuleById('rule-id')` at top level, then `if (condition && RULE_X)` in evaluation logic.

---

#### PAT-009: Plan Assumes Policy Rules Fire Without Verifying Binder Output
**Occurrences:** 1
**Sessions:** 2026-02-11-conformance-golden-tests-implementation

**Description:** When writing conformance or policy test expectations, the plan assumed all 4 policy rules would fire for the admin-wildcard scenario. In reality, `iam-no-wildcard-resource` only fires when `intent.resource.scope === 'pattern'`, but `ComponentPlatformBinder` always emits `scope: 'specific'`. The plan counted catalog rules rather than verifying which rules actually trigger for a given binder output.

**Impact:** ~3 minutes debugging 4 test failures and correcting expectations

**Proposed Resolution:** Add a conformance test design checklist to plans: before specifying expected violation counts, verify binder output shape against each policy rule's trigger conditions. See IMP-016.

---

### 🔵 Tooling Gap

#### PAT-003: Missing Nx ESLint Plugin
**Occurrences:** 1
**Sessions:** 2026-02-07-kernel-graph-core-implementation

**Description:** The `@nx/eslint-plugin` is referenced in `.eslintrc.json` but not installed, causing lint commands to fail.

**Impact:** Cannot verify lint compliance

**Proposed Resolution:** Add to devDependencies: `pnpm add -wD @nx/eslint-plugin`

---

## Graduated Patterns

_Patterns that have been resolved with formal solutions._

### PAT-006: Test Snapshots Without Canonical Ordering (GRADUATED)
**Occurrences:** 4 (3 friction, 1 zero-impact)
**Sessions:** 2026-02-07 through 2026-02-11

**Resolution:** Pattern fully internalized into plan guidance and memory. Conformance package (Phase 7) had zero canonical ordering issues — `runGoldenCase()` delegates to `Kernel.compile()` which handles all ordering internally. `createTestNode`/`createTestEdge` from `@shinobi/ir` are the single source of truth for test fixtures. Duplicate `makeNode`/`makeEdge`/`makeSnapshot` helpers in kernel/binder/policy remain but are no longer causing friction. IMP-012 tracks consolidation.

---

## Pattern Graduation Criteria

A pattern is ready for graduation when:
1. Occurrences ≥ 3
2. Impact is quantifiable
3. Resolution is actionable and testable
4. Someone is assigned to implement it
