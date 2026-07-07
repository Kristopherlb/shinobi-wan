# Checkpoint: Compute Blueprints — Phase 5 (BP-005 EKS Managed Cluster)

**Date:** 2026-02-28
**Session:** Phase 5 implementation
**Phase:** 5 of 5 (final)

## Progress

- [x] EKS Cluster lowerer (`eks-cluster-lowerer.ts`) — EKS Cluster + CloudWatch LogGroup
- [x] EKS Node Group lowerer (`eks-node-group-lowerer.ts`) — EKS NodeGroup
- [x] Data map updates (PLATFORM_REF_MAP, OUTPUT_MAP)
- [x] Lowerer registry, adapter, index updates
- [x] 29 lowerer unit tests (eks-lowerers.test.ts) — all pass
- [x] 2 policy rules: eks-endpoint-public-access, eks-logging-disabled
- [x] SEVERITY_MAP entries for 2 rules × 3 packs
- [x] NODE_RULE_CHECKS entries for 2 rules
- [x] 7 policy rule tests (compute-rules.test.ts) — all pass
- [x] Blueprint manifest (blueprints/compute/eks-managed-cluster.yaml)
- [x] Golden conformance test (golden-blueprint-eks-managed-cluster.test.ts) — 11 tests pass
- [x] Full test suite green (all 9 projects)

## Test Counts

| Suite                    | Before Phase 5 | After Phase 5 | Delta   |
| ------------------------ | -------------- | ------------- | ------- |
| adapter-aws              | 425            | 454           | +29     |
| policy                   | 90             | 98            | +8      |
| conformance              | 187            | 198           | +11     |
| **Total (all packages)** | ~1,269         | ~1,317        | **+48** |

## Learnings

### NODE_RULE_CHECKS pattern continues to scale cleanly

Adding 2 EKS policy rules required exactly 2 data entries (~15 lines each) in `NODE_RULE_CHECKS`. Zero boilerplate, zero evaluator logic changes. The `eks-logging-disabled` rule uses a slightly more complex `failsWhen` (checks array emptiness), which the data-driven pattern handles naturally.

### VPC/Subnet/SG reuse from Phase 4 works seamlessly

The EKS blueprint reuses the same VPC, Subnet, and SecurityGroup node patterns from the ECS blueprint (BP-006). No lowerer changes were needed — the existing infrastructure lowerers handle these identically. This validates the composability of the platform node model.

### EKS lowerer follows the established pattern exactly

The EKS Cluster lowerer closely mirrors the ECS Cluster lowerer pattern (single resource + supporting resource). The Node Group lowerer is simpler (single resource). Both use `createStandardTags()` and `makeResourceName()` from utils.ts. Total implementation time was minimal due to the mature patterns.

### Platform-to-platform edge pattern (PAT-017) reconfirmed

The `eks-nodes → eks-cluster` bindsTo edge produces zero intents (PAT-017). The golden test correctly asserts `intents.toHaveLength(0)`. This is the 3rd blueprint (BP-005, BP-006, BP-008) using platform-only architecture.

## Friction

### None significant

Phase 5 had zero friction points. All patterns from Phases 1–4 transferred directly:

- Lowerer implementation: copy-edit from ECS cluster pattern
- Policy rules: data entries in existing arrays
- Golden test: copy-edit from ECS golden test
- Data map updates: 1-line additions

## Plan Alignment

### Delivered vs. planned

Plan specified: 2 lowerers, 2 policy rules, 1 blueprint, 1 golden test, ~30 lowerer tests, ~7 policy tests, ~12 golden tests.

- Actual: **2 lowerers** (exact), **2 policy rules** (exact), **1 blueprint** (exact), **1 golden test** (exact)
- Test counts: **29 lowerer tests** (close to 30), **8 policy tests** (1 over), **11 golden tests** (1 under — FedRAMP escalation test required a variant cluster node, counted as 1 test)
- Files created: 5 (exact match)
- Files updated: 8 (exact match)
- No scope drift, no surprises

### Observations for future phases

- The compute blueprints framework is mature. Adding new platform types is now fully mechanical:
  1. Write lowerer (copy pattern from similar resource)
  2. Add data map entries (PLATFORM_REF_MAP, OUTPUT_MAP)
  3. Register in lowerer-registry, adapter, index
  4. Add NODE_RULE_CHECKS entries for policy rules
  5. Add SEVERITY_MAP entries
  6. Write blueprint YAML
  7. Write golden test (copy pattern from similar blueprint)

## Compute Blueprints Summary (All 5 Phases Complete)

| Phase     | Blueprint                  | Lowerers                               | Policy Rules         | Tests Added |
| --------- | -------------------------- | -------------------------------------- | -------------------- | ----------- |
| 1         | BP-004 Serverless ETL      | +1 (Telemetry)                         | +3                   | ~60         |
| 2         | BP-008 Static Site + CDN   | +4 (CloudFront, WAF, ACM, CF Function) | +3                   | ~75         |
| 3         | BP-007 Scheduled Batch     | +2 (EventBridge, StepFunctions)        | +2                   | ~69         |
| 4         | BP-006 ECS Fargate + ALB   | +8 (VPC, Subnet, SG, ECR, ECS×3, ALB)  | +3                   | ~165        |
| 5         | BP-005 EKS Managed Cluster | +2 (EKS Cluster, EKS NodeGroup)        | +2                   | ~48         |
| **Total** | **5 blueprints**           | **+17 lowerers**                       | **+13 policy rules** | **~417**    |

Final totals: 20 lowerers, 17 policy rules, 5 blueprints, ~1,317 tests.
