# Checkpoint: Wave A Complete — 5 Blueprints (BP-I15, BP-I12, BP-I18, BP-A01, BP-A05)

**Date:** 2026-03-01
**Session:** Wave A implementation (Phases 6A + 6B)
**Scope:** 5 remaining Wave A blueprints — lowest-friction batch

## Progress

- [x] BP-I15: WAF + Shield + Secrets — SecretsManager + KMS lowerers, 2 policy rules, blueprint + golden test
- [x] BP-I12: ElastiCache Redis — ElastiCache lowerer, 2 policy rules, blueprint + golden test
- [x] BP-I18: Cost Optimization — Budgets + ConfigRules lowerers, 1 policy rule, blueprint + golden test
- [x] BP-A01: Bedrock Gateway — Bedrock lowerer, 1 policy rule, blueprint + golden test
- [x] BP-A05: Batch Inference Pipeline — SageMaker Batch Transform lowerer, 1 policy rule, blueprint + golden test
- [x] 7 new lowerers registered (index.ts, lowerer-registry.ts, PLATFORM_REF_MAP, OUTPUT_MAP, ACTION_MAP)
- [x] 7 new policy rules (RULE_CATALOG, SEVERITY_MAP ×3 packs, NODE_RULE_CHECKS)
- [x] ~28 new policy tests in compute-rules.test.ts (4 per rule)
- [x] 7 rule ID assertions added to rules.test.ts
- [x] FedRAMP audit: all 11 blueprints Baseline clean
- [x] Full test suite green (all 9 projects)

## Test Counts

| Suite                    | Before Wave A | After Wave A | Delta    |
| ------------------------ | ------------- | ------------ | -------- |
| adapter-aws              | 454           | 538          | +84      |
| policy                   | 98            | 127          | +29      |
| conformance              | 198           | 261          | +63      |
| **Total (all packages)** | ~1,317        | ~1,500       | **+183** |

## New Lowerers (7)

| Lowerer                        | Platform                      | Emits                            | Key Detail                                        |
| ------------------------------ | ----------------------------- | -------------------------------- | ------------------------------------------------- |
| SecretsManagerLowerer          | aws-secretsmanager            | Secret + optional SecretRotation | KMS key ref, rotation config                      |
| KmsLowerer                     | aws-kms                       | Key + Alias                      | Rotation only for SYMMETRIC_DEFAULT               |
| ElastiCacheLowerer             | aws-elasticache               | SubnetGroup + ReplicationGroup   | Uses ReplicationGroup (not Cluster)               |
| BudgetsLowerer                 | aws-budgets                   | Budget                           | Threshold notification via SNS ref                |
| ConfigRulesLowerer             | aws-config-rules              | cfg:Rule                         | aws:cfg namespace (not aws:config)                |
| BedrockLowerer                 | aws-bedrock                   | Guardrail + optional LogGroup    | IAM-only service, no model resources              |
| SageMakerBatchTransformLowerer | aws-sagemaker-batch-transform | sagemaker:Model                  | Model definition only; transform jobs are runtime |

## New Policy Rules (7)

| Rule                            | Platform                      | Fires When                       | Baseline | Moderate | High  |
| ------------------------------- | ----------------------------- | -------------------------------- | -------- | -------- | ----- |
| secrets-rotation-disabled       | aws-secretsmanager            | rotationEnabled !== true         | info     | warning  | error |
| kms-key-rotation-disabled       | aws-kms                       | !enableKeyRotation AND symmetric | warning  | error    | error |
| elasticache-encryption-disabled | aws-elasticache               | !atRest OR !transit              | info     | warning  | error |
| elasticache-auth-disabled       | aws-elasticache               | !transit OR no authToken         | info     | warning  | error |
| budget-threshold-missing        | aws-budgets                   | no threshold AND no topic        | info     | warning  | error |
| bedrock-guardrails-disabled     | aws-bedrock                   | guardrailEnabled !== true        | info     | warning  | error |
| sagemaker-vpc-disabled          | aws-sagemaker-batch-transform | no vpcConfig or empty subnets    | info     | warning  | error |

## Learnings

### 7-step mechanical process confirmed at scale

Wave A added 7 lowerers in a single session using the pattern established in Phases 1–5: scaffold → implement → register → add data map entries → add policy → write blueprint → generate golden test. Each lowerer averaged ~3 minutes including tests. PAT-012 reconfirmed.

### Batch cross-cutting updates are more efficient

Updating shared files (RULE_CATALOG, SEVERITY_MAP, NODE_RULE_CHECKS, rules.test.ts) atomically for all 7 rules at once was faster than per-blueprint updates. RULE_CATALOG/SEVERITY_MAP consistency tests caught any drift immediately.

### Triggers edges require bindingConfig (not empty metadata)

The cost-optimization golden test initially failed because the config-rule→lambda triggers edge had `metadata: {}`. TriggersBinder requires `metadata.bindingConfig.resourceType`. This is already documented in PAT-009 but manifested in a new way for non-component trigger sources. Blueprint YAML was also updated.

### AI service lowerers are simpler than infrastructure

Bedrock and SageMaker lowerers are thinner than infrastructure lowerers (ElastiCache, KMS). AI services primarily need IAM permissions — the lowerer creates configuration resources (guardrails, model definitions) rather than heavy infrastructure. This bodes well for Wave B AI blueprints.

### Mixed blueprints (component+platform) produce intents; platform-only don't

Reconfirmed PAT-017. ElastiCache Redis (component→platform edge) produces intents. WAF+Shield+Secrets (platform-only) produces zero intents. The pattern is now internalized across all 11 blueprints.

## Friction

### TriggersBinder bindingConfig requirement (1 occurrence)

Golden test crash from empty metadata on triggers edge. Fix: 2-line metadata addition. Root cause: blueprint YAML config-rule→lambda edge didn't specify bindingConfig. Should add to plan checklist: "verify all triggers edges have bindingConfig.resourceType".

## Plan Alignment

### Delivered vs. planned

Plan specified: 7 lowerers, 7 policy rules, 5 blueprints, 5 golden tests, ~162 new tests.

- Actual: **7 lowerers** (exact), **7 policy rules** (exact), **5 blueprints** (exact), **5 golden tests** (exact)
- Test delta: **+183** (exceeded estimate of ~162 by +21)
- Files created: 19 (exact match)
- Files updated: 11 shared files (exact match)
- 1 bug fix mid-implementation (triggers edge metadata)
- No scope drift

## FedRAMP Audit Results

All 11 blueprints audited. Key results:

- **Baseline**: All 11 COMPLIANT (0 errors)
- **FedRAMP-Moderate**: All 11 COMPLIANT (0 errors, warnings only from iam-missing-conditions)
- **FedRAMP-High**: Expected NON-COMPLIANT for blueprints with component→platform edges (iam-missing-conditions escalates to error). Platform-only blueprints (EKS, WAF+Secrets) are FedRAMP-High compliant.

## Wave A Summary

| Metric              | Before Wave A                                                                                                                                  | After Wave A                                                                | Delta |
| ------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------- | ----- |
| Blueprints complete | 6/38 (16%)                                                                                                                                     | 11/38 (29%)                                                                 | +5    |
| Node lowerers       | 22                                                                                                                                             | 29                                                                          | +7    |
| Intent lowerers     | 4                                                                                                                                              | 4                                                                           | +0    |
| Policy rules        | 18                                                                                                                                             | 25                                                                          | +7    |
| Tests               | ~1,317                                                                                                                                         | ~1,500                                                                      | +183  |
| Lowerer inventory   | Lambda, SQS, DynamoDB, S3, API GW, SNS, CloudFront, WAF, ACM, CF Function, EventBridge, StepFunctions, VPC, Subnet, SG, ECR, ECS×3, ALB, EKS×2 | +SecretsManager, KMS, ElastiCache, Budgets, ConfigRules, Bedrock, SageMaker | +7    |
