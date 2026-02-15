# Retrospective: Resource Expansion — DynamoDB, S3, API Gateway + TriggersBinder

**Date:** 2026-02-13
**Session Duration:** ~15 minutes
**Artifacts Produced:**
- 3 new node lowerers (DynamoDB, S3, API Gateway) in `@shinobi/adapter-aws`
- 1 new binder (TriggersBinder) in `@shinobi/binder`
- API Gateway → Lambda integration post-processor in adapter
- 8 new Pulumi resource constructor registrations
- 1 example manifest (`examples/apigw-dynamodb.yaml`)
- 45 new tests (753 total, up from 708)

---

## What Went Well

### 1. Existing Patterns Made Implementation Mechanical (~95%)
The Lambda/SQS lowerer pair provided a perfect template for all 3 new lowerers. Each new lowerer was nearly copy-edit: change the platform string, resource type, and property mapping. The `NodeLowerer` interface, `shortName()` utility, and test-helper conventions (`makeNode`, `makeContext`, `ResolvedDeps`) were all reusable without modification.

### 2. Test Helpers Were Already Cross-Package Ready
The adapter test-helpers (`test-helpers.ts`) with `makeNode()`, `makeEdge()`, `makeContext()`, and `DEFAULT_ADAPTER_CONFIG` worked directly for all new lowerer tests. No new test infrastructure was needed for the adapter package.

### 3. Binder Pattern Transferred Cleanly to TriggersBinder
The `IBinder` interface, `BindingContext`, `BinderOutput` types, and `createIamIntent()`/`createConfigIntent()` factories from `ComponentPlatformBinder` mapped directly. The TriggersBinder was ~70 lines and produced 3 intents per edge — matching the existing pattern without introducing new abstractions.

### 4. API Gateway Integration Followed EventSourceMapping Pattern
The existing `generateEventSourceMappings()` function for Lambda→SQS provided the exact pattern for `generateApiGatewayIntegrations()` for API GW→Lambda. Both iterate over edges, check platform types, and emit post-processing resources. The adapter's 5-phase `lower()` orchestrator accommodated a 6th phase (API GW integrations) with a single added call.

### 5. Zero Test Infrastructure Changes
All new tests used existing Vitest configs, test helpers, and mock patterns. The Pulumi constructor mock pattern (`makeConstructor` with `function` syntax for `new` support) extended cleanly to 8 new resource types.

### 6. IAM ACTION_MAP Was Pre-Wired
The `iam-lowerer.ts` already had `table` and `bucket` entries in `ACTION_MAP`. Only `api` needed to be added for the TriggersBinder's `invoke` action. This shows good anticipatory design in the original IAM lowerer.

### 7. Integration Test Validated Triggers Binder in Context
The existing binder integration test had a test case with `component→component` triggers edge (unbound). After registering the TriggersBinder, the same test still works (unbound for wrong types), and the new `platform→component` test case produces 3 intents. This validates the registry's pattern-matching selectivity.

---

## What Could Have Been Better

### 1. `shortName()` Duplicated Across 5 Lowerer Files
The utility function `shortName(nodeId: string): string` is now duplicated in: `lambda-lowerer.ts`, `sqs-lowerer.ts`, `dynamodb-lowerer.ts`, `s3-lowerer.ts`, `apigateway-lowerer.ts`, and `adapter.ts` (6 copies total, 3 pre-existing + 3 new). This should be extracted to a shared utility.

**Impact:** No bugs yet, but violates DRY and risks drift.

**Proposed Fix:** Extract to `packages/adapters/aws/src/lowerers/utils.ts` and import from there. See IMP-018.

### 2. `resolveConfigValue()` Requires Manual Platform Case Extension
Each new platform type (aws-dynamodb, aws-s3, aws-apigateway) needed a new `if (platform === '...')` branch in `resolveConfigValue()`. This is a maintenance burden and will grow linearly with each new platform.

**Impact:** ~1 minute per new platform type.

**Proposed Fix:** Create a `PLATFORM_REF_MAP` constant that maps platform → (resource suffix, output field), replacing the if-chain. See IMP-019.

### 3. Plan Was Comprehensive but Very Long
The plan was ~200 lines covering 7 steps, 19 files, and detailed design for each component. While accurate, it was more detailed than needed — most implementation was pattern-following. A shorter plan with "follow Lambda/SQS pattern" references would have been sufficient for the 3 lowerers.

**Impact:** No implementation impact, but plan creation time could be reduced for pattern-following work.

### 4. No Conformance Tests for New Resources
The conformance package's golden tests and triad matrix still only cover the Lambda+SQS scenario. DynamoDB, S3, and API Gateway aren't exercised in conformance. This is acceptable for now but should be tracked.

**Impact:** Lower confidence in end-to-end determinism for new resource types.

---

## The Golden Path

```
+------------------------------------------------------------------+
|  Step 1: DynamoDB Lowerer + Tests (3 min)                         |
|  Pattern: Copy SqsLowerer, change platform/resourceType/props    |
|  Unique: keySchema parsing, attribute definitions, PAY_PER_REQUEST|
|  Tests: 11 (platform ID, table resource, hash/range keys, etc.)  |
+------------------------------------------------------------------+
                              |
                              v
+------------------------------------------------------------------+
|  Step 2: S3 Lowerer + Tests (3 min)                               |
|  Pattern: Copy SqsLowerer, add optional versioning resource      |
|  Unique: BucketVersioningV2 as conditional second resource        |
|  Tests: 9 (bucket, versioning on/off, ref dependency chain)      |
+------------------------------------------------------------------+
                              |
                              v
+------------------------------------------------------------------+
|  Step 3: TriggersBinder + Tests (3 min)                           |
|  Pattern: Copy ComponentPlatformBinder, simplify to IAM + config |
|  Unique: invoke action, API_GATEWAY_URL + API_ROUTE config keys  |
|  Tests: 11 (intents, frozen, schemaVersion, missing resourceType)|
+------------------------------------------------------------------+
                              |
                              v
+------------------------------------------------------------------+
|  Step 4: API Gateway Lowerer + Integration (4 min)                |
|  Unique: Api + Stage (2 resources per node)                      |
|  Integration: generateApiGatewayIntegrations() → 3 resources     |
|  Tests: 13 (unit lowerer + adapter integration)                  |
+------------------------------------------------------------------+
                              |
                              v
+------------------------------------------------------------------+
|  Step 5: Wire + Pulumi Constructors + Exports (2 min)             |
|  FILES: lowerers/index.ts, adapter.ts, pulumi-program.ts,        |
|         binder/index.ts, cli/validate.ts, iam-lowerer ACTION_MAP |
|  Tests: Update pulumi-program.test.ts (8 new types in allTypes)  |
+------------------------------------------------------------------+
                              |
                              v
+------------------------------------------------------------------+
|  Step 6: Example Manifest + Full Suite (1 min)                    |
|  FILE: examples/apigw-dynamodb.yaml                               |
|  Verify: 753 tests pass, 0 lint errors                           |
+------------------------------------------------------------------+
```

**Estimated time with golden path:** ~16 minutes (actual was ~15 minutes)

---

## Recommendations

### Immediate (This Sprint)

| ID | Action | Effort | Impact |
|----|--------|--------|--------|
| IMP-018 | Extract `shortName()` to shared lowerer utility | 10 min | Eliminates 6-way duplication in adapter lowerers |
| IMP-019 | Create `PLATFORM_REF_MAP` for `resolveConfigValue()` | 15 min | Replaces growing if-chain with data-driven lookup |

### Near-Term (Next 2 Sprints)

| ID | Action | Effort | Impact |
|----|--------|--------|--------|
| IMP-020 | Add DynamoDB/S3/API GW scenarios to conformance triad matrix | 2 hours | End-to-end determinism verification for new resource types |
| IMP-003 | Package generator with Vitest config (still open) | 2 hours | Eliminates setup for future packages |

### Strategic (Roadmap)

| ID | Action | Effort | Impact |
|----|--------|--------|--------|
| — | Additional lowerers: SNS, EventBridge, CloudFront, RDS | 2-3 hours | Broader AWS resource coverage following same pattern |
| — | `dependsOn` binder | 1 hour | Complete edge type coverage beyond bindsTo and triggers |
| — | Adapter plugin system | 4+ hours | Replace hardcoded NODE_LOWERERS with registrable plugins |

---

## Metrics

| Metric | Value | Notes |
|--------|-------|-------|
| Files created | 9 | 3 lowerers, 1 binder, 4 test files, 1 example manifest |
| Files modified | 10 | Exports, registrations, Pulumi constructors, tests |
| New tests | 45 | DynamoDB(11) + S3(9) + ApiGW(13) + Triggers(11) + integration(1) |
| Total tests | 753 | Up from 708 |
| New source lines | ~500 | Lowerers + binder + integration code |
| Lint errors | 0 | 0 new errors; pre-existing warnings unchanged |
| Test failures during dev | 0 | All tests passed on first run |
| Session duration | ~15 min | Fastest phase — entirely pattern-following |
| Packages touched | 3 | adapter-aws, binder, cli |

---

## Key Takeaway

> **Pattern-following work is dramatically faster than novel implementation. The 3 lowerers + 1 binder + integration code + 45 tests were completed in ~15 minutes because every piece had an existing analog to copy from. The biggest ROI improvements are now structural: extracting `shortName()` to eliminate duplication, and data-driving `resolveConfigValue()` to eliminate the platform if-chain. Both are ~10 minute fixes with compounding benefit as more platforms are added.**

---

## Plan Alignment

### Drift Analysis

1. **No significant drift.** The plan was executed almost exactly as written. All 19 files in the plan were created/modified.
2. **Plan could have been shorter.** For pattern-following work, a ~50 line plan referencing existing patterns would have been sufficient. The detailed design sections for each lowerer were mostly redundant with the existing Lambda/SQS code.
3. **Conformance was correctly deferred.** The plan didn't include conformance tests for new resources, which was the right call — golden tests should be a separate phase.

### Plan Updates for Future Phases

```markdown
## Resource Lowerer Implementation Checklist (for pattern-following additions)

When adding a new node lowerer:
1. Copy closest existing lowerer (Lambda for compute, SQS for messaging, DynamoDB for storage)
2. Change: platform string, resourceType, property mapping, resource name suffix
3. Register in: NODE_LOWERERS (adapter.ts), lowerers/index.ts, index.ts (adapter)
4. Add Pulumi constructor to RESOURCE_CONSTRUCTORS (pulumi-program.ts)
5. Add platform case to resolveConfigValue() if config intents reference this platform
6. Add ACTION_MAP entry if IAM intents target this resource type
7. Add stack outputs to generatePlan() switch statement
8. Update "handles all supported types" test in pulumi-program.test.ts
9. Tests: ~8-12 per lowerer following existing test patterns
```

---

## Improvements / Capabilities That Would Help Next

| Type | Proposal | Effort | Expected Impact |
|------|----------|--------|-----------------|
| Refactor | IMP-018: Extract `shortName()` to `lowerers/utils.ts` | 10 min | Eliminates 6x duplication, single source of truth |
| Refactor | IMP-019: Data-driven `resolveConfigValue()` with PLATFORM_REF_MAP | 15 min | O(1) platform addition instead of growing if-chain |
| Testing | IMP-020: Conformance golden tests for DynamoDB/S3/API GW | 2 hours | End-to-end determinism coverage for new resources |
| Skill | Update plan templates with "Resource Lowerer Checklist" | 15 min | Makes future lowerer additions even more mechanical |

---

## Files Created/Modified

### Created
```
packages/adapters/aws/src/lowerers/dynamodb-lowerer.ts
packages/adapters/aws/src/lowerers/s3-lowerer.ts
packages/adapters/aws/src/lowerers/apigateway-lowerer.ts
packages/adapters/aws/src/__tests__/dynamodb-lowerer.test.ts
packages/adapters/aws/src/__tests__/s3-lowerer.test.ts
packages/adapters/aws/src/__tests__/apigateway-lowerer.test.ts
packages/binder/src/binders/triggers-binder.ts
packages/binder/src/__tests__/triggers-binder.test.ts
examples/apigw-dynamodb.yaml
```

### Modified
```
packages/adapters/aws/src/adapter.ts (register lowerers + API GW integration + resolveConfigValue)
packages/adapters/aws/src/lowerers/index.ts (export new lowerers)
packages/adapters/aws/src/index.ts (export new lowerers)
packages/adapters/aws/src/pulumi-program.ts (8 new RESOURCE_CONSTRUCTORS)
packages/adapters/aws/src/program-generator.ts (stack outputs for DynamoDB/S3/API GW)
packages/adapters/aws/src/lowerers/iam-lowerer.ts (ACTION_MAP: api entry)
packages/adapters/aws/src/__tests__/pulumi-program.test.ts (mock + allTypes list)
packages/binder/src/binders/index.ts (export TriggersBinder)
packages/binder/src/index.ts (re-export TriggersBinder)
packages/cli/src/commands/validate.ts (register TriggersBinder)
packages/binder/src/__tests__/integration.test.ts (register TriggersBinder + new test)
```
