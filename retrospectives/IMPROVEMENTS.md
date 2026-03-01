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
4. Currently covered: G-001/2/3, G-004, G-020/21/22/23, G-040/41 (10 of 12)
5. Missing: G-005, G-042

### IMP-018: Extract `shortName()` to Shared Lowerer Utility
**Status:** 🟢 Implemented
**Source:** 2026-02-13-resource-expansion-dynamodb-s3-apigateway
**Implemented:** 2026-02-15-phase-8a-utility-extraction-conformance-sns
**Effort:** 10 min (actual: ~3 min)
**Impact:** Eliminated 9-way duplication of `shortName()` across adapter lowerers (was 6 at proposal, grew to 9 by implementation)

**Action:** Created `packages/adapters/aws/src/lowerers/utils.ts` and replaced all 9 local copies. 6 unit tests added. SNS lowerer used shared utility directly.

---

### IMP-019: Data-Driven resolveConfigValue with PLATFORM_REF_MAP
**Status:** 🟢 Implemented
**Source:** 2026-02-13-resource-expansion-dynamodb-s3-apigateway
**Implemented:** 2026-02-15-phase-8a-utility-extraction-conformance-sns
**Effort:** 15 min (actual: ~5 min)
**Impact:** Replaced if-chain in `reference-utils.ts` with `PLATFORM_REF_MAP` and switch in `program-generator.ts` with `OUTPUT_MAP`. Adding SNS was 1-line per map.

---

### IMP-020: Conformance Golden Tests for New Resources
**Status:** 🟢 Implemented (adapter-level)
**Source:** 2026-02-13-resource-expansion-dynamodb-s3-apigateway
**Implemented:** 2026-02-15-phase-8a-utility-extraction-conformance-sns
**Effort:** 2 hours (actual: ~5 min — adapter golden tests, not full conformance triad)
**Impact:** 14 adapter-level golden determinism tests covering DynamoDB, S3, API GW, and multi-resource scenarios

**Action:** Created `golden-adapter.test.ts` in adapter-aws with 4 scenarios. Kernel-level triad matrix expansion deferred to future phase.

---

### IMP-021: Skip Nx Cache After Deployer Source Changes
**Status:** 🟡 Proposed
**Source:** 2026-02-15-phase-8a-utility-extraction-conformance-sns
**Effort:** 0 min (process change)
**Impact:** Prevents stale Nx cache from masking test failures when deployer.ts is modified

**Action:** After modifying `deployer.ts` or its tests, run `pnpm nx test adapter-aws --skip-nx-cache` to ensure fresh results.

---

### IMP-022: Conformance Gate G-005 — Component Capability Schema
**Status:** 🟡 Proposed
**Source:** 2026-02-15-phase-8a-utility-extraction-conformance-sns
**Effort:** 1 hour
**Impact:** 11/12 conformance gates covered

**Action:** Create `packages/conformance/src/__tests__/golden-capability.test.ts` testing that component capability declarations validate against the schema defined in Standard S4.

---

### IMP-023: Conformance Gate G-042 — Policy Severity Escalation Matrix
**Status:** 🟡 Proposed
**Source:** 2026-02-15-phase-8a-utility-extraction-conformance-sns
**Effort:** 1 hour
**Impact:** 12/12 conformance gates covered

**Action:** Create conformance tests verifying that the same policy rules fire across all 3 packs with escalating severity (info → warning → error). Expands the existing triad matrix.

---

## Impact Tracking

_Record actual impact after implementation._

| ID | Expected Impact | Actual Impact | Validated |
|----|-----------------|---------------|-----------|
| IMP-001 | Enables lint checks | Lint now runs on ir (15 warnings) and contracts (8 warnings) | ✅ |
| IMP-002 | TypeScript compilation | IR package type-checks; lint and test pass | ✅ |
| IMP-018 | Eliminates 6-way shortName duplication | Eliminated 9 copies → 1. SNS lowerer used shared utility directly. | ✅ |
| IMP-019 | O(1) platform addition | SNS required 1-line per data map. No if-branch or switch case needed. | ✅ |
| IMP-020 | E2E determinism for new resources | 14 adapter golden tests verify DynamoDB, S3, API GW, multi-resource plans are byte-stable. | ✅ |
| IMP-024 | Blueprint FedRAMP compliance auditing | BP-004 validates clean under Baseline (0 errors), expected escalation under FedRAMP-High. | ✅ |

---

### IMP-024: FedRAMP Audit Script
**Status:** 🟢 Implemented
**Source:** 2026-02-28-compute-blueprints-phase1-checkpoint
**Effort:** 15 min
**Impact:** Validates every blueprint against all 3 policy packs, reports compliance status and violation details

**Action:** Created `scripts/audit-fedramp.ts`. Runs against individual blueprints or scans `blueprints/*/` automatically. Outputs both console report and `audit-fedramp-report.json`. Exit code 1 if Baseline has errors.

---

### IMP-025: Rule Catalog Completeness Helper
**Status:** 🟡 Proposed
**Source:** 2026-02-28-compute-blueprints-phase1-checkpoint
**Effort:** 15 min
**Impact:** Prevents RULE_CATALOG / SEVERITY_MAP drift — ensures every rule has severity entries for all 3 packs

**Action:** Create `assertRuleCatalogComplete()` test helper that:
1. Verifies every rule in RULE_CATALOG has entries in SEVERITY_MAP for all 3 packs
2. Verifies every rule in SEVERITY_MAP exists in RULE_CATALOG
3. Add as a test in `rules.test.ts`

---

### IMP-026: Generator Scripts Auto-Modify Source Files
**Status:** 🟡 Proposed
**Source:** 2026-02-28-compute-blueprints-phase1-checkpoint
**Effort:** 2 hours
**Impact:** Currently `generate-lowerer.ts` and `generate-policy-rule.ts` only print boilerplate that must be manually pasted. AST-based transforms would auto-add to index.ts, registry, ACTION_MAP, PLATFORM_REF_MAP, OUTPUT_MAP.

**Action:** Extend generators with `ts-morph` or simple regex transforms to modify source files directly.

---

### IMP-027: Document Node-Level Policy Check Pattern
**Status:** 🟡 Proposed
**Source:** 2026-02-28-compute-blueprints-phase1-checkpoint
**Effort:** 10 min
**Impact:** Phase 2+ rules (cloudfront-ssl, waf-not-attached, s3-public-access) use same pattern

**Action:** Add to memory: "Node-level checks use `checkComputeNodes()` pattern — iterate `snapshot.nodes`, filter by platform, check properties, emit violation with `target: { type: 'node', id: node.id }`."

---

### IMP-028: Blueprint Golden Test Generator
**Status:** 🟡 Proposed
**Source:** 2026-02-28-compute-blueprints-phase2-checkpoint
**Effort:** 30 min
**Impact:** Prevents copy-paste errors when creating golden tests from blueprint manifests. Auto-detects component vs platform-only architectures for correct intent assertions.

**Action:** Create a script that reads a YAML manifest and generates a golden test scaffold with correct node/edge counts, platform types, and intent expectations.

---

### IMP-029: WAF Attachment via Binder
**Status:** 🟡 Proposed
**Source:** 2026-02-28-compute-blueprints-phase2-checkpoint
**Effort:** 1 hour
**Impact:** Makes `waf-not-attached` policy rule work with edge-based WAF attachment (currently checks node properties only)

**Action:** Consider a `WafBinder` that processes WAF→CDN bindsTo edges and sets `wafAclArn` on the CDN node metadata, making the property visible to policy rules at compile time. Alternative: modify the policy rule to inspect edges.

---

## Archived

_Improvements that are obsolete or superseded._

(None yet)
