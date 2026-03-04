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

**Description:** `rules.test.ts` asserted `RULE_CATALOG.toHaveLength(4)`. Adding 3 new compute rules (sqs-dlq-missing, lambda-timeout-excessive, telemetry-tracing-disabled) broke this test. Similarly, golden-triad-resources expected rule IDs didn't account for the new `telemetry-tracing-disabled` rule firing on Lambda components without tracing. Continued through Waves A-C as catalog grew from 4 → 43 rules.

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

---

#### PAT-018: Triggers Edges Require bindingConfig (Not Empty Metadata)
**Occurrences:** 1
**Sessions:** 2026-03-01-wave-a-complete

**Description:** The cost-optimization golden test crashed because the config-rule→lambda triggers edge had `metadata: {}`. TriggersBinder at `triggers-binder.ts:36` accesses `bindingConfig.resourceType`, causing `TypeError: Cannot read properties of undefined`. This is a variant of PAT-009 (plan doesn't verify binder input shape), but applies specifically to non-standard trigger sources (config rules, not just API Gateway).

**Impact:** ~3 minutes debugging + fixing golden test and blueprint YAML

**Proposed Resolution:** Add to plan checklist: "every triggers edge must include `metadata.bindingConfig.resourceType`". Consider adding runtime validation in TriggersBinder to throw a clear error when bindingConfig is missing.

---

### 🟢 Success

#### PAT-012: Pattern-Following Lowerer Implementation
**Occurrences:** 38
**Sessions:** 2026-02-13-resource-expansion-dynamodb-s3-apigateway, 2026-02-15-phase-8a-utility-extraction-conformance-sns, 2026-02-28-compute-blueprints-phases-2-3-4-5, 2026-03-01-wave-a-complete, 2026-03-01-wave-b-complete, 2026-03-02-wave-c-complete

**Description:** Adding new node lowerers was ~95% mechanical copy-edit from existing patterns. The `NodeLowerer` interface, test helpers, and Pulumi mock patterns all transfer directly. Wave C added 15 lowerers (including 4-resource NetworkFirewall, variable-count GlueCatalog) with zero friction. Total: 55 lowerers, 0 implementation-level friction across all waves.

**Impact:** Extremely fast expansion of resource coverage.

**Proposed Resolution:** Document as "Resource Lowerer Checklist" in plan templates for future additions.

---

#### PAT-016: Node-Level Policy Checks Scale Cleanly
**Occurrences:** 30
**Sessions:** 2026-02-28-compute-blueprints-phase1-checkpoint, 2026-02-28-compute-blueprints-phase2-checkpoint, 2026-02-28-compute-blueprints-phases-3-4-5, 2026-03-01-wave-a-complete, 2026-03-01-wave-b-complete, 2026-03-02-wave-c-complete

**Description:** Adding `checkComputeNodes()` to the evaluator introduced a new pattern: policy rules that inspect `snapshot.nodes` directly (not just intents). Wave C added 11 more rules (11 NODE_RULE_CHECKS entries) with zero friction. Total: 43 policy rules, all data-driven via NODE_RULE_CHECKS. The pattern handles diverse rule shapes: simple boolean checks, nested object inspection (MSK auth), enum comparisons (TLS), and conditional checks (private zone).

**Impact:** Positive — clean extension point for compute/resource-level policy rules.

**Proposed Resolution:** Document as the "node-level policy check" pattern in memory. Use for all future rules that inspect node properties rather than intents.

---

#### PAT-019: Policy Rule Reuse Across Platforms via NODE_RULE_CHECKS
**Occurrences:** 2
**Sessions:** 2026-03-01-wave-b-complete

**Description:** A single RULE_CATALOG entry can apply to multiple platforms by adding separate NODE_RULE_CHECKS entries. `opensearch-public-access` checks both `aws-opensearch` and `aws-opensearch-serverless`. `sagemaker-vpc-disabled` checks both `aws-sagemaker-batch-transform` and `aws-sagemaker-endpoint`. No new rule, no severity duplication — just a new check entry.

**Impact:** Positive — clean multi-platform rule extension without rule proliferation.

---

#### PAT-020: Zero-Friction Phase Execution via Established Patterns
**Occurrences:** 2
**Sessions:** 2026-03-01-wave-b-complete, 2026-03-02-wave-c-complete

**Description:** All phases of Waves B and C passed on first test run with zero friction. Wave C added 15 lowerers (including 4-resource and variable-count patterns), 11 policy rules, 5 blueprints, and 5 golden tests across 3 phases — all passing on first run. The combination of data-driven registries (PAT-011 graduated), mechanical lowerer pattern (PAT-012), and node-level policy checks (PAT-016) eliminated all sources of friction.

**Impact:** Positive — Wave C's "heavy lift" blueprints (networking, streaming, GPU) were no harder to implement than Wave A's simpler ones.

---

#### PAT-021: Context Continuation Preserves Cross-Cutting State
**Occurrences:** 1
**Sessions:** 2026-03-02-wave-c-complete

**Description:** When a large implementation exhausts the context window mid-phase, the session continuation summary accurately captures which cross-cutting files (barrel exports, registry, ref map, output map, IAM action map, ARN patterns, policy rules, severity map, evaluator checks, test assertions) have been updated and which remain pending. This enables seamless resumption with no duplicate work or missed updates.

**Impact:** Positive — Wave C Phase 8C was split across context boundaries with zero state loss or duplicate edits.

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

### PAT-017: Platform-to-Platform Edges Produce Zero Intents (GRADUATED)
**Occurrences:** 3
**Sessions:** 2026-02-28-compute-blueprints-phase2-checkpoint, 2026-02-28-compute-blueprints-phase4 (BP-006), 2026-02-28-compute-blueprints-phase5 (BP-005)

**Resolution:** Fully internalized into plan/memory guidance. Platform-only blueprints (BP-005, BP-006, BP-008) all use `platform:*` nodes with `platform→platform` edges. `ComponentPlatformBinder` only fires for `component→platform` edges, so these blueprints produce zero intents. Infrastructure relationships are resolved by lowerers at adapter time. Golden tests always assert `intents.toHaveLength(0)` for platform-only blueprints. This is now documented in MEMORY.md and all Phase 4/5 golden tests were written correctly on first pass.

---

## Pattern Graduation Criteria

A pattern is ready for graduation when:
1. Occurrences ≥ 3
2. Impact is quantifiable
3. Resolution is actionable and testable
4. Someone is assigned to implement it
