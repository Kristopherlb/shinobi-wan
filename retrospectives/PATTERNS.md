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

#### PAT-013: Nx Cache Masks Test Failures After Source Changes
**Occurrences:** 1
**Sessions:** 2026-02-15-phase-8a-utility-extraction-conformance-sns

**Description:** When a test expectation doesn't match the implementation (e.g., deployer `classifyError` returns `retryable: true` for unknown errors but the test expects `false`), the Nx cache can mask the failure if the test file itself wasn't modified. The failure only surfaces when the cache is invalidated.

**Impact:** ~2 minutes diagnosing a "new" failure that was always there.

**Proposed Resolution:** Run `--skip-nx-cache` for affected packages after modifying source files that tests depend on. See IMP-021.

---

#### PAT-014: Hardcoded Rule Counts Break When Adding Policy Rules
**Occurrences:** 2
**Sessions:** 2026-02-28-compute-blueprints-phase1-checkpoint, 2026-02-28-compute-blueprints-phase2-checkpoint

**Description:** `rules.test.ts` asserted `RULE_CATALOG.toHaveLength(4)`. Adding 3 new compute rules (sqs-dlq-missing, lambda-timeout-excessive, telemetry-tracing-disabled) broke this test. Similarly, golden-triad-resources expected rule IDs didn't account for the new `telemetry-tracing-disabled` rule firing on Lambda components without tracing.

**Impact:** ~3 minutes debugging and fixing test expectations across 2 files

**Proposed Resolution:** Use dynamic assertions (e.g., `>= expected`) for catalog counts, or add rules to a known-rules constant. For conformance tests, re-verify expected rule sets after adding any new policy rule.

---

#### PAT-015: New Policy Rules Ripple Through Conformance Golden Tests
**Occurrences:** 1
**Sessions:** 2026-02-28-compute-blueprints-phase1-checkpoint

**Description:** Adding `telemetry-tracing-disabled` caused the `apigw-trigger` scenario in `golden-triad-resources.test.ts` to fire an additional rule (Lambda without tracing). This is correct behavior — conformance tests caught the change as expected. However, the developer must manually identify which existing golden tests are affected by new rules.

**Impact:** ~2 minutes finding affected tests and updating expectations

**Proposed Resolution:** When adding a new policy rule, run full conformance suite immediately. The failures show exactly which golden tests need updated expectations.

---

#### PAT-017: Platform-to-Platform Edges Produce Zero Intents
**Occurrences:** 1
**Sessions:** 2026-02-28-compute-blueprints-phase2-checkpoint

**Description:** BP-008 (Static Site + CDN + WAF) has only `platform:*` nodes and `platform→platform` bindsTo edges. `ComponentPlatformBinder` only fires for `component→platform` edges, so these blueprints produce zero intents at compile time. Infrastructure relationships (CDN→S3, WAF→CDN) are resolved by lowerers instead. Golden tests must assert `intents.toHaveLength(0)` rather than copying intent assertions from component-based blueprints.

**Impact:** ~3 minutes debugging a failing golden test (copied intent assertion from BP-004)

**Proposed Resolution:** When writing golden tests for infrastructure-only blueprints, check whether any component nodes exist. If not, expect zero intents.

---

### 🟢 Success

#### PAT-012: Pattern-Following Lowerer Implementation
**Occurrences:** 2
**Sessions:** 2026-02-13-resource-expansion-dynamodb-s3-apigateway, 2026-02-15-phase-8a-utility-extraction-conformance-sns

**Description:** Adding new node lowerers (DynamoDB, S3, API Gateway) was ~95% mechanical copy-edit from existing Lambda/SQS patterns. The `NodeLowerer` interface, test helpers, and Pulumi mock patterns all transfer directly. Average: ~3 minutes per lowerer including tests.

**Impact:** Extremely fast expansion of resource coverage.

**Proposed Resolution:** Document as "Resource Lowerer Checklist" in plan templates for future additions.

---

#### PAT-016: Node-Level Policy Checks Scale Cleanly
**Occurrences:** 2
**Sessions:** 2026-02-28-compute-blueprints-phase1-checkpoint, 2026-02-28-compute-blueprints-phase2-checkpoint

**Description:** Adding `checkComputeNodes()` to the evaluator introduced a new pattern: policy rules that inspect `snapshot.nodes` directly (not just intents). The contracts `ViolationTarget` interface already supported `type: 'node'`, so no contracts changes were needed. This pattern will scale for Phase 2+ node-level rules (CloudFront SSL, WAF attachment, S3 public access).

**Impact:** Positive — clean extension point for compute/resource-level policy rules.

**Proposed Resolution:** Document as the "node-level policy check" pattern in memory. Use for all future rules that inspect node properties rather than intents.

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

### PAT-010: Utility Function Duplication Across Lowerers (GRADUATED)
**Occurrences:** 2
**Sessions:** 2026-02-13-resource-expansion-dynamodb-s3-apigateway, 2026-02-15-phase-8a-utility-extraction-conformance-sns

**Resolution:** `shortName()` extracted to `packages/adapters/aws/src/lowerers/utils.ts` and imported by all 9 files that used local copies. IMP-018 implemented. The SNS lowerer (added in the same phase) used the shared utility directly — zero duplication.

---

### PAT-011: Platform-Specific If-Chain in resolveConfigValue (GRADUATED)
**Occurrences:** 2
**Sessions:** 2026-02-13-resource-expansion-dynamodb-s3-apigateway, 2026-02-15-phase-8a-utility-extraction-conformance-sns

**Resolution:** `PLATFORM_REF_MAP` data map in `reference-utils.ts` and `OUTPUT_MAP` in `program-generator.ts` replaced if-chains and switch statements. IMP-019 implemented. Adding SNS was a 1-line map entry per file — O(1) instead of a new if-branch.

---

## Pattern Graduation Criteria

A pattern is ready for graduation when:
1. Occurrences ≥ 3
2. Impact is quantifiable
3. Resolution is actionable and testable
4. Someone is assigned to implement it
