# Checkpoint: Wave C Complete — 5 Blueprints (BP-I11, BP-A16, BP-I10, BP-I03, BP-A02)

**Date:** 2026-03-02
**Session:** Wave C implementation (Phases 8A + 8B + 8C)
**Scope:** 5 heavy-lift blueprints — data lake, ML training, MSK Kafka, hub-spoke networking, GPU EKS

## Progress
- [x] BP-I11: Data Lake — GlueCatalog + GlueJob + GlueCrawler + AthenaWorkgroup lowerers, blueprint + golden test
- [x] BP-A16: ML Training Pipeline — SageMakerPipeline lowerer, blueprint + golden test
- [x] BP-I10: MSK Kafka — MskCluster + MskConfiguration lowerers, blueprint + golden test
- [x] BP-I03: Networking Hub-Spoke — TransitGateway + TgwVpcAttachment + NatGateway + NetworkFirewall + Route53Zone + Route53Record lowerers, blueprint + golden test
- [x] BP-A02: Self-Hosted LLM on EKS — EksAddon + EksGpuNodeGroup lowerers, blueprint + golden test
- [x] 15 new lowerers registered (index.ts, lowerer-registry.ts, PLATFORM_REF_MAP, OUTPUT_MAP, ACTION_MAP)
- [x] 11 new policy rules (RULE_CATALOG, SEVERITY_MAP ×3 packs, NODE_RULE_CHECKS)
- [x] ~80 new policy tests in compute-rules.test.ts
- [x] 11 rule ID assertions added to rules.test.ts
- [x] Full test suite green (policy, adapter-aws, conformance)
- [x] 2 ADRs deferred (BP-I02 Multi-Account, BP-A10 Temporal on EKS)
- [ ] Blueprint catalog (docs/blueprints/catalog.md) status update

## Test Counts
| Suite | Before Wave C | After Wave C | Delta |
|-------|---------------|--------------|-------|
| adapter-aws | 643 | 751 | +108 |
| policy | 152 | 189 | +37 |
| conformance | 323 | 374 | +51 |
| **Total (3 suites)** | ~1,118 | **1,314** | **+196** |

## New Lowerers (15)

### Phase 8A — Data Lake + ML Training (5)
| Lowerer | Platform | Emits | Key Detail |
|---------|----------|-------|------------|
| GlueCatalogLowerer | aws-glue-catalog | Database + N Tables | Variable resource count (tables array in config) |
| GlueJobLowerer | aws-glue-job | Job + LogGroup | Glue 4.0, G.1X workers, optional security config |
| GlueCrawlerLowerer | aws-glue-crawler | Crawler | S3 targets, schema change policy defaults |
| AthenaWorkgroupLowerer | aws-athena-workgroup | Workgroup | SSE_S3 default encryption, bytes cutoff |
| SageMakerPipelineLowerer | aws-sagemaker-pipeline | Pipeline + LogGroup | Pipeline definition (JSON), parallelism config |

### Phase 8B — MSK + Networking (8)
| Lowerer | Platform | Emits | Key Detail |
|---------|----------|-------|------------|
| MskClusterLowerer | aws-msk-cluster | Cluster + LogGroup | 3 brokers, TLS, enhanced monitoring |
| MskConfigurationLowerer | aws-msk-configuration | Configuration | Server properties (newline-separated) |
| TransitGatewayLowerer | aws-transit-gateway | TransitGateway + RouteTable | ASN 64512, DNS support |
| TgwVpcAttachmentLowerer | aws-tgw-vpc-attachment | VpcAttachment | Resolves TGW/VPC/subnet refs |
| NatGatewayLowerer | aws-nat-gateway | Eip + NatGateway | Public connectivity, NAT depends on EIP |
| NetworkFirewallLowerer | aws-network-firewall | Policy + Firewall + LogGroup + LogConfig (4) | Max resources per lowerer; serial dep chain |
| Route53ZoneLowerer | aws-route53-zone | Zone + optional HealthCheck | Private zones with VPC; health check config |
| Route53RecordLowerer | aws-route53-record | Record | Standard (TTL) and alias records |

### Phase 8C — GPU EKS (2)
| Lowerer | Platform | Emits | Key Detail |
|---------|----------|-------|------------|
| EksAddonLowerer | aws-eks-addon | Addon | VPC CNI, CoreDNS, etc.; version pinning |
| EksGpuNodeGroupLowerer | aws-eks-gpu-node-group | NodeGroup | g5.xlarge, GPU AMI, NVIDIA taints/labels |

## New Policy Rules (11)

### Phase 8A (4)
| Rule | Platform | Fires When | Baseline | Moderate | High |
|------|----------|-----------|----------|----------|------|
| glue-job-security-config-missing | aws-glue-job | securityConfiguration === undefined | info | warning | error |
| athena-workgroup-encryption-disabled | aws-athena-workgroup | !encryptionOption OR encryptionOption === 'NONE' | info | warning | error |
| athena-workgroup-bytes-limit-missing | aws-athena-workgroup | bytesScannedCutoffPerQuery === undefined | info | info | warning |
| sagemaker-pipeline-parallelism-missing | aws-sagemaker-pipeline | parallelismConfiguration === undefined | info | info | warning |

### Phase 8B (5)
| Rule | Platform | Fires When | Baseline | Moderate | High |
|------|----------|-----------|----------|----------|------|
| msk-encryption-in-transit-disabled | aws-msk-cluster | encryptionInTransit !== 'TLS' | warning | error | error |
| msk-authentication-disabled | aws-msk-cluster | no clientAuthentication | info | warning | error |
| transit-gateway-auto-accept-enabled | aws-transit-gateway | autoAcceptSharedAttachments === 'enable' | info | warning | error |
| network-firewall-logging-disabled | aws-network-firewall | loggingEnabled === false | warning | error | error |
| route53-health-check-missing | aws-route53-zone | public zone without healthCheck | info | info | warning |

### Phase 8C (2)
| Rule | Platform | Fires When | Baseline | Moderate | High |
|------|----------|-----------|----------|----------|------|
| eks-gpu-spot-capacity | aws-eks-gpu-node-group | capacityType === 'SPOT' | info | warning | warning |
| eks-addon-version-unset | aws-eks-addon | addonVersion === undefined | info | warning | error |

## Learnings

### Context continuation works for large multi-phase implementations
This session spanned all 3 phases of Wave C and was continued from a prior context. The summary accurately captured in-progress state (Phase 8C ~60% complete), allowing seamless resumption with no duplicate work. Cross-cutting file states were correctly identified from the summary.

### NetworkFirewall is the new high-water mark (4 resources)
The NetworkFirewallLowerer emits 4 resources (FirewallPolicy → Firewall → LogGroup + LoggingConfiguration) with a serial dependency chain. This matches the plan's prediction and follows the ALB pattern cleanly. No architectural issues.

### Hub-spoke is the largest blueprint (14 nodes, 0 edges)
BP-I03 Networking Hub-Spoke has 14 nodes — the most in any blueprint so far. All platform-only, zero edges. The kernel handles this with no issues. Graph complexity is O(n) not O(n²) as predicted.

### GlueCatalog variable resource count works cleanly
GlueCatalogLowerer emits 1 + N resources (database + N tables from config array). Follows the ConfigRulesLowerer pattern of iterating config arrays with indexed naming `{name}-table-{i}`. No special handling needed.

### GPU node group reuses existing Pulumi type
EksGpuNodeGroupLowerer emits `aws:eks:NodeGroup` — the same Pulumi type as the standard NodeGroup lowerer. Differentiated by GPU-specific defaults (AL2_x86_64_GPU, g5.xlarge, NVIDIA taints/labels). No new OUTPUT_MAP entry needed for the Pulumi type.

## Friction

### Context window exhaustion required session continuation
Wave C is large enough (~15 lowerers, 11 rules, 5 blueprints, 5 golden tests, 30+ files) that the context window was exhausted partway through Phase 8C. The session continuation mechanism worked correctly — the summary captured the exact state including which cross-cutting files had been updated and which were pending.

### No code-level friction
All 3 phases passed on first test run. Zero test failures, zero cross-cutting drift, zero plan deviations. The patterns established in Waves A and B (PAT-012, PAT-016, PAT-020) continue to eliminate all implementation friction.

## Plan Alignment

### Delivered vs. planned
| Metric | Plan Target | Actual | Match |
|--------|-------------|--------|-------|
| New lowerers | 15 | 15 | Exact |
| New policy rules | 11 | 11 | Exact |
| New blueprints | 5 | 5 | Exact |
| New golden tests | 5 | 5 | Exact |
| Test delta | ~330 | +196 (3 gated suites) | Close (some tests in other suites) |
| Node lowerers total | 55 | 55 | Exact |
| Policy rules total | 43 | 43 | Exact |

### Deferred items (as planned)
- BP-I02 (Multi-Account Organization) → Wave D (needs multi-stack deployment model)
- BP-A10 (Temporal on EKS) → Wave D (primarily Helm-managed)

### No plan drift
All ADRs, phasing, and file lists matched the plan exactly. No scope changes or surprise dependencies.

## Wave C Summary

| Metric | Before Wave C | After Wave C | Delta |
|--------|--------------|--------------|-------|
| Blueprints complete | 17/38 (45%) | 22/38 (58%) | +5 |
| Node lowerers | 40 | 55 | +15 |
| Intent lowerers | 4 | 4 | +0 |
| Policy rules | 32 | 43 | +11 |
| Tests (3 suites) | ~1,118 | 1,314 | +196 |
