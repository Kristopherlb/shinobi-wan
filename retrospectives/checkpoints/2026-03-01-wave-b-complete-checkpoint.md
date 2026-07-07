# Checkpoint: Wave B Complete — 6 Blueprints (BP-I14, BP-A06, BP-A07, BP-I09, BP-A03, BP-I01)

**Date:** 2026-03-01
**Session:** Wave B implementation (Phases 7A + 7B + 7C)
**Scope:** 6 moderate-effort blueprints — OpenSearch ecosystem, database+ML, account bootstrap

## Progress

- [x] BP-I14: Centralized Logging — OpenSearch + Firehose + Log Subscription Filter lowerers, blueprint + golden test
- [x] BP-A06: RAG Pipeline — reuses OpenSearch + Bedrock + Lambda + DynamoDB + S3 + API GW, blueprint + golden test
- [x] BP-A07: Vector Database — OpenSearch Serverless lowerer, blueprint + golden test
- [x] BP-I09: Aurora Serverless v2 — RDS Cluster + RDS Proxy lowerers, blueprint + golden test
- [x] BP-A03: SageMaker Endpoint — SageMaker Endpoint lowerer, blueprint + golden test
- [x] BP-I01: Account Bootstrap — Config Recorder + Security Hub + GuardDuty + CloudTrail lowerers, blueprint + golden test
- [x] 11 new lowerers registered (index.ts, lowerer-registry.ts, PLATFORM_REF_MAP, OUTPUT_MAP, ACTION_MAP)
- [x] 7 new policy rules (RULE_CATALOG, SEVERITY_MAP ×3 packs, NODE_RULE_CHECKS)
- [x] ~45 new policy tests in compute-rules.test.ts
- [x] 7 rule ID assertions added to rules.test.ts
- [x] Full test suite green (policy, adapter-aws, conformance)
- [x] Blueprint catalog updated (docs/blueprints/catalog.md)

## Test Counts

| Suite                | Before Wave B | After Wave B | Delta    |
| -------------------- | ------------- | ------------ | -------- |
| adapter-aws          | 538           | 643          | +105     |
| policy               | 127           | 152          | +25      |
| conformance          | 261           | 323          | +62      |
| **Total (3 suites)** | ~926          | ~1,118       | **+192** |

## New Lowerers (11)

### Phase 7A — OpenSearch Ecosystem (4)

| Lowerer                      | Platform                    | Emits                                      | Key Detail                                        |
| ---------------------------- | --------------------------- | ------------------------------------------ | ------------------------------------------------- |
| OpenSearchDomainLowerer      | aws-opensearch              | Domain + LogGroup                          | Encryption at rest, node-to-node, VPC config      |
| KinesisFirehoseLowerer       | aws-kinesis-firehose        | FirehoseDeliveryStream                     | OpenSearch/S3 destinations, buffering, encryption |
| LogSubscriptionFilterLowerer | aws-log-subscription-filter | LogSubscriptionFilter                      | CWL → Firehose/Lambda/Kinesis glue                |
| OpenSearchServerlessLowerer  | aws-opensearch-serverless   | SecurityPolicy + AccessPolicy + Collection | Collection depends on both policies               |

### Phase 7B — Database + ML Endpoint (3)

| Lowerer                  | Platform               | Emits                                            | Key Detail                               |
| ------------------------ | ---------------------- | ------------------------------------------------ | ---------------------------------------- |
| RdsClusterLowerer        | aws-rds-cluster        | Cluster + ClusterInstance + optional SubnetGroup | Aurora PostgreSQL, serverless v2 scaling |
| RdsProxyLowerer          | aws-rds-proxy          | Proxy + DefaultTargetGroup + ProxyTarget         | TLS, SecretsManager auth                 |
| SageMakerEndpointLowerer | aws-sagemaker-endpoint | Model + EndpointConfiguration + Endpoint         | Production variant config, VPC support   |

### Phase 7C — Account Bootstrap (4)

| Lowerer               | Platform            | Emits                                       | Key Detail                                |
| --------------------- | ------------------- | ------------------------------------------- | ----------------------------------------- |
| ConfigRecorderLowerer | aws-config-recorder | Recorder + DeliveryChannel + RecorderStatus | Status depends on both recorder + channel |
| SecurityHubLowerer    | aws-securityhub     | Account + optional StandardsSubscription    | CIS v1.2.0 benchmark                      |
| GuardDutyLowerer      | aws-guardduty       | Detector                                    | S3/Kubernetes/malware datasources         |
| CloudTrailLowerer     | aws-cloudtrail      | Trail + optional LogGroup                   | Multi-region, log validation              |

## New Policy Rules (7)

| Rule                               | Platform                                  | Fires When                                 | Baseline | Moderate | High  |
| ---------------------------------- | ----------------------------------------- | ------------------------------------------ | -------- | -------- | ----- |
| opensearch-encryption-disabled     | aws-opensearch                            | !encryptionAtRest OR !nodeToNodeEncryption | info     | warning  | error |
| opensearch-public-access           | aws-opensearch, aws-opensearch-serverless | publicAccess === true                      | warning  | error    | error |
| firehose-encryption-disabled       | aws-kinesis-firehose                      | encryptionEnabled !== true                 | info     | warning  | error |
| rds-encryption-disabled            | aws-rds-cluster                           | storageEncrypted !== true                  | info     | error    | error |
| rds-public-access                  | aws-rds-cluster                           | publicAccess === true                      | warning  | error    | error |
| cloudtrail-log-validation-disabled | aws-cloudtrail                            | enableLogFileValidation !== true           | warning  | error    | error |
| guardduty-not-enabled              | aws-guardduty                             | enabled === false                          | info     | warning  | error |

Note: `sagemaker-vpc-disabled` reused via new NODE_RULE_CHECKS entry for `aws-sagemaker-endpoint` (no new rule needed).

## Learnings

### Mechanical lowerer process scales to 11 in one session

PAT-012 confirmed at larger scale. All 11 lowerers followed the same scaffold → implement → register → data-map pattern. Multi-resource lowerers (3 resources each for ConfigRecorder, RdsCluster, RdsProxy, SageMakerEndpoint, OpenSearchServerless) work identically — just emit an array.

### Phase batching by domain is efficient

Grouping OpenSearch-related lowerers (Phase 7A), database-related (7B), and security services (7C) minimized context switching. Shared patterns within each phase (e.g., encryption checks) transferred directly.

### Zero-edge blueprints work naturally

BP-I01 (Account Bootstrap) has 10 nodes and zero edges — a pure enablement blueprint. The kernel, binder, and conformance infrastructure handle this gracefully with no special casing. Golden test asserts `edges.toHaveLength(0)` and `intents.toHaveLength(0)`.

### Policy rule reuse via NODE_RULE_CHECKS is clean

`sagemaker-vpc-disabled` (originally for `aws-sagemaker-batch-transform`) was extended to `aws-sagemaker-endpoint` by adding a single NODE_RULE_CHECKS entry. No new rule, no severity changes — just a new platform check.

### opensearch-public-access needed dual platform entries

One rule checking two platforms (`aws-opensearch` + `aws-opensearch-serverless`) required two NODE_RULE_CHECKS entries but only one RULE_CATALOG/SEVERITY_MAP entry. The evaluator iterates all checks, so the same ruleId fires for either platform.

## Friction

### None observed

All 3 phases passed on first test run. No test failures, no cross-cutting drift, no plan deviations. The Wave A experience and established patterns eliminated friction entirely.

## Plan Alignment

### Delivered vs. planned

Plan specified: 11 lowerers, 7 policy rules, 6 blueprints, 6 golden tests, ~249 new tests.

- Actual: **11 lowerers** (exact), **7 policy rules** (exact), **6 blueprints** (exact), **6 golden tests** (exact)
- Test delta: **+192** (3 gated suites; estimate of ~249 included tests in other suites)
- Files created: 29 (exact match)
- Files updated: 11 shared files (exact match)
- 0 bug fixes — zero friction
- No scope drift

## Wave B Summary

| Metric              | Before Wave B    | After Wave B                                                                                                                                           | Delta |
| ------------------- | ---------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------ | ----- |
| Blueprints complete | 11/38 (29%)      | 17/38 (45%)                                                                                                                                            | +6    |
| Node lowerers       | 29               | 40                                                                                                                                                     | +11   |
| Intent lowerers     | 4                | 4                                                                                                                                                      | +0    |
| Policy rules        | 25               | 32                                                                                                                                                     | +7    |
| Tests (3 suites)    | ~926             | ~1,118                                                                                                                                                 | +192  |
| Lowerer inventory   | (29 from Wave A) | +OpenSearch, Firehose, LogSubFilter, OpenSearchServerless, RdsCluster, RdsProxy, SageMakerEndpoint, ConfigRecorder, SecurityHub, GuardDuty, CloudTrail | +11   |
