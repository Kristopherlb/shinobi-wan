# Shinobi V3 — Test Suite Classification Index

This index classifies **every test file** in the Shinobi repo as **Invariant**, **Behavioral**, or **Implementation-only (drop)** under the V3 constraints (graph-native, backend-neutral).

Conventions:
- **Rationale** is written from a **V3 perspective** (what semantic expectation exists, if any).
- **Porting** indicates **KernelLaw**, **Pattern**, or **Legacy** alignment (see `README.md`).

## packages/core

| File | Classification | Rationale | Porting |
|---|---|---|---|
| `packages/core/src/services/tests/schema-validator.test.ts` | Invariant | Schema validation must be deterministic and actionable. | KernelLaw (KL-002, KL-006) |
| `packages/core/src/services/tests/manifest-schema-composer.test.ts` | Invariant | Schema discovery/composition forms the validation surface for manifests. | KernelLaw (KL-002) + Pattern (P-006) |
| `packages/core/src/services/tests/enhanced-schema-validator.test.ts` | Invariant | Enhanced validation must emit structured, path-addressable diagnostics. | KernelLaw (KL-002, KL-006) |
| `packages/core/src/services/tests/binding-directive-validator.test.ts` | Invariant | Binding directives must be validated against compatibility and allowed access levels. | KernelLaw (KL-003, KL-006) |
| `packages/core/src/services/tests/binding-directive-validation-integration.test.ts` | Invariant | Validation errors must be aggregated and human-actionable (paths, allowedValues). | KernelLaw (KL-006) |
| `packages/core/src/services/tests/manifest-synthesis-integration.test.ts` | Invariant | Unsupported component types must fail fast with informative diagnostics. | KernelLaw (KL-002, KL-006) |
| `packages/core/src/services/observability-ecs-integration.test.ts` | Behavioral | Observability injection should produce telemetry/logging intents and explainable outcomes (file contains CDK template assertions; treat those as legacy evidence only). | Pattern (P-005) + KernelLaw (KL-006, KL-008) |
| `packages/core/src/services/__tests__/plan-output-formatter.test.ts` | Implementation-only (drop) | Uses CDK construct metadata (`getAllConstructs`) to infer compliance recommendations; V3 must derive from graph/policy outputs instead. | Legacy (do not port) |
| `packages/core/src/resolver/__tests__/event-source-scanner.test.ts` | Behavioral | Event source references may auto-generate bindings with explicit opt-out and external reference rules. | Pattern (P-004) + KernelLaw (KL-003, KL-006) |
| `packages/core/src/resolver/__tests__/event-source-scanner-improvements.test.ts` | Behavioral | Event source scanning must be predictable and produce actionable diagnostics for unsupported cases. | Pattern (P-004) + KernelLaw (KL-006) |
| `packages/core/src/resolver/__tests__/iam-policy-post-processor.test.ts` | Implementation-only (drop) | Applies IAM to CDK constructs; V3 should lower IAM intents via adapters, not post-process constructs. | Legacy (do not port) |
| `packages/core/src/resolver/__tests__/security-group-rule-post-processor.test.ts` | Implementation-only (drop) | Creates CDK/CFN SG rule resources; V3 should emit network intents and let adapters apply them. | Legacy (do not port) |
| `packages/core/src/resolver/__tests__/resolver-engine-event-source-iam.test.ts` | Implementation-only (drop) | End-to-end CDK synthesis + template assertions; replace with graph/intent golden tests. | Legacy (do not port) |
| `packages/core/src/resolver/__tests__/resolver-engine-security-group-rules.integration.test.ts` | Implementation-only (drop) | End-to-end CDK synthesis + template assertions for SG rules; replace with graph/intent golden tests. | Legacy (do not port) |
| `packages/core/src/platform/services/feature-flags/__tests__/feature-flag.service.test.ts` | Invariant | Feature flag evaluation must be deterministic and policy-controllable. | KernelLaw (KL-001, KL-006) |
| `packages/core/src/platform/networking/__tests__/cross-stack-rule-manager.test.ts` | Behavioral | Cross-service SG rule aggregation/dedup/removal semantics are useful; CDK template assertions are legacy evidence. | Pattern (P-007) + KernelLaw (KL-001, KL-006) |
| `packages/core/src/platform/contracts/compliance/__tests__/rules.test.ts` | Invariant | Compliance rule loading/precedence must be deterministic and explainable. | KernelLaw (KL-008, KL-006) |
| `packages/core/src/platform/contracts/__tests__/directive-schema-validator.test.ts` | Invariant | Directive schemas must validate and produce consistent errors. | KernelLaw (KL-002, KL-006) |
| `packages/core/src/platform/contracts/__tests__/unified-binder-strategy-base.test.ts` | Invariant | Binder base contract must enforce compliance wrapper semantics and stable result shapes. | KernelLaw (KL-004, KL-006, KL-008) |
| `packages/core/src/platform/binders/registry/__tests__/unified-binder-registry-factory.test.ts` | Invariant | Registry creation should be deterministic and complete for supported strategies. | KernelLaw (KL-001, KL-003) |
| `packages/core/src/platform/binders/registry/__tests__/unified-registry-security-strategies.test.ts` | Invariant | Registry must include required security strategies and expose their compatibility. | KernelLaw (KL-003) |
| `packages/core/src/platform/binders/__tests__/resource-validator.test.ts` | Invariant | Resource/intent validation must enforce least-privilege and forbidden wildcard patterns. | KernelLaw (KL-005, KL-006) |
| `packages/core/src/platform/binders/__tests__/action-resolver.test.ts` | Invariant | Action resolution must be deterministic and validate supported actions/profiles. | KernelLaw (KL-001, KL-006) + Pattern (P-001) |
| `packages/core/src/platform/binders/__tests__/action-allow-lists.test.ts` | Invariant | Allow-list enforcement must be deterministic and auditable. | KernelLaw (KL-001, KL-006) |
| `packages/core/src/migration/__tests__/resource-mapper.spec.ts` | Implementation-only (drop) | CloudFormation-template dependency mapping (and currently skipped/stubbed). V3 should diff/relate graph IR instead. | Legacy (do not port) |

## packages/binders

All binder strategy tests primarily assert **backend-neutral binding results** (env injection, IAM intent, network intent, compliance result) and are therefore **portable** as V3 binder/kernel conformance.

| File | Classification | Rationale | Porting |
|---|---|---|---|
| `packages/binders/src/strategies/analytics/emr-binder-strategy.test.ts` | Invariant | Capability pairing → derived intents must be deterministic and validated. | KernelLaw (KL-004, KL-005, KL-006) |
| `packages/binders/src/strategies/analytics/kinesis-binder-strategy.test.ts` | Invariant | Same as above. | KernelLaw (KL-004, KL-005, KL-006) |
| `packages/binders/src/strategies/api/api-gateway-binder-strategy.test.ts` | Invariant | Binding to API gateway should emit correct invoke/config intents. | KernelLaw (KL-004, KL-006) + Pattern (P-001) |
| `packages/binders/src/strategies/api/appconfig-binder-strategy.test.ts` | Invariant | Config capability binding should inject runtime configuration deterministically. | KernelLaw (KL-004, KL-006) |
| `packages/binders/src/strategies/cdn/cloudfront-binder-strategy.test.ts` | Invariant | CDN binding emits endpoint/config and scoped IAM intents where applicable. | KernelLaw (KL-004, KL-005) |
| `packages/binders/src/strategies/compliance/auditmanager-binder-strategy.test.ts` | Invariant | Governance/compliance bindings emit appropriate intents and diagnostics. | KernelLaw (KL-004, KL-006, KL-008) |
| `packages/binders/src/strategies/compliance/config-binder-strategy.test.ts` | Invariant | Compliance bindings should be policy-pack driven and auditable. | KernelLaw (KL-008, KL-006) |
| `packages/binders/src/strategies/compute/app-runner-binder-strategy.test.ts` | Invariant | Compute bindings emit env/IAM/network intents deterministically. | KernelLaw (KL-004, KL-005, KL-006) |
| `packages/binders/src/strategies/compute/autoscaling-binder-strategy.test.ts` | Invariant | Same as above. | KernelLaw (KL-004, KL-005, KL-006) |
| `packages/binders/src/strategies/compute/batch-binder-strategy.test.ts` | Invariant | Same as above. | KernelLaw (KL-004, KL-005, KL-006) |
| `packages/binders/src/strategies/compute/ec2-binder-strategy.test.ts` | Invariant | Same as above. | KernelLaw (KL-004, KL-005, KL-006) |
| `packages/binders/src/strategies/compute/ecs-fargate-binder-strategy.test.ts` | Invariant | Same as above. | KernelLaw (KL-004, KL-005, KL-006) |
| `packages/binders/src/strategies/compute/eks-binder-strategy.test.ts` | Invariant | Same as above. | KernelLaw (KL-004, KL-005, KL-006) |
| `packages/binders/src/strategies/compute/elastic-beanstalk-binder-strategy.test.ts` | Invariant | Same as above. | KernelLaw (KL-004, KL-005, KL-006) |
| `packages/binders/src/strategies/compute/lambda-binder-strategy.test.ts` | Invariant | Lambda bindings must map access→actions; custom actions override must be validated. | KernelLaw (KL-004, KL-005, KL-006) + Pattern (P-001, P-002) |
| `packages/binders/src/strategies/compute/lightsail-binder-strategy.test.ts` | Invariant | Same as above. | KernelLaw (KL-004, KL-005, KL-006) |
| `packages/binders/src/strategies/database/dynamodb-binder-strategy.test.ts` | Invariant | Data bindings must emit least-privilege IAM + config identifiers. | KernelLaw (KL-004, KL-005, KL-006) |
| `packages/binders/src/strategies/database/neptune-binder-strategy.test.ts` | Invariant | Same as above. | KernelLaw (KL-004, KL-005, KL-006) |
| `packages/binders/src/strategies/database/rds-binder-strategy.test.ts` | Invariant | Same as above. | KernelLaw (KL-004, KL-005, KL-006) |
| `packages/binders/src/strategies/governance/backup-binder-strategy.test.ts` | Invariant | Governance bindings emit auditable intents. | KernelLaw (KL-008, KL-006) |
| `packages/binders/src/strategies/governance/budgets-binder-strategy.test.ts` | Invariant | Same as above. | KernelLaw (KL-008, KL-006) |
| `packages/binders/src/strategies/governance/cloudtrail-binder-strategy.test.ts` | Invariant | Same as above. | KernelLaw (KL-008, KL-006) |
| `packages/binders/src/strategies/governance/controltower-binder-strategy.test.ts` | Invariant | Same as above. | KernelLaw (KL-008, KL-006) |
| `packages/binders/src/strategies/governance/organizations-binder-strategy.test.ts` | Invariant | Same as above. | KernelLaw (KL-008, KL-006) |
| `packages/binders/src/strategies/governance/ram-binder-strategy.test.ts` | Invariant | Same as above. | KernelLaw (KL-008, KL-006) |
| `packages/binders/src/strategies/governance/servicecatalog-binder-strategy.test.ts` | Invariant | Same as above. | KernelLaw (KL-008, KL-006) |
| `packages/binders/src/strategies/iot/iot-core-binder-strategy.test.ts` | Invariant | IoT bindings emit least-privilege + config intents. | KernelLaw (KL-004, KL-005, KL-006) |
| `packages/binders/src/strategies/messaging/eventbridge-binder-strategy.test.ts` | Invariant | Messaging bindings map access→actions; secure access options add intents. | KernelLaw (KL-004, KL-005, KL-006) + Pattern (P-001, P-003) |
| `packages/binders/src/strategies/messaging/queue-binder-strategy.test.ts` | Invariant | Queue bindings inject queue identifiers and scoped IAM. | KernelLaw (KL-004, KL-005, KL-006) |
| `packages/binders/src/strategies/messaging/step-functions-binder-strategy.test.ts` | Invariant | Workflow bindings inject ARNs and scoped IAM. | KernelLaw (KL-004, KL-005, KL-006) |
| `packages/binders/src/strategies/ml/sagemaker-binder-strategy.test.ts` | Invariant | ML bindings inject endpoints/config and scoped IAM. | KernelLaw (KL-004, KL-005, KL-006) |
| `packages/binders/src/strategies/mobile/amplify-binder-strategy.test.ts` | Invariant | Mobile bindings inject endpoints/config and scoped IAM. | KernelLaw (KL-004, KL-005, KL-006) |
| `packages/binders/src/strategies/monitoring/cloudwatch-binder-strategy.test.ts` | Invariant | Monitoring bindings emit telemetry intents and scoped IAM. | KernelLaw (KL-004, KL-005, KL-006) |
| `packages/binders/src/strategies/networking/loadbalancer-binder-strategy.test.ts` | Invariant | Networking bindings emit network + config intents deterministically. | KernelLaw (KL-004, KL-006) |
| `packages/binders/src/strategies/networking/route53-binder-strategy.test.ts` | Invariant | DNS bindings inject names/IDs and validate access. | KernelLaw (KL-004, KL-006) |
| `packages/binders/src/strategies/networking/security-group-binder-strategy.test.ts` | Invariant | SG bindings emit network intents and relevant identifiers. | KernelLaw (KL-004, KL-006) |
| `packages/binders/src/strategies/networking/security-group-rule-binder-strategy.test.ts` | Invariant | SG rule bindings emit backend-neutral ingress/egress intents. | KernelLaw (KL-004, KL-006) + Pattern (P-007) |
| `packages/binders/src/strategies/networking/service-connect-binder-strategy.test.ts` | Invariant | Service-connect bindings inject service discovery endpoints/config. | KernelLaw (KL-004, KL-006) |
| `packages/binders/src/strategies/networking/vpc-binder-strategy.test.ts` | Invariant | VPC bindings inject network topology identifiers/config. | KernelLaw (KL-004, KL-006) |
| `packages/binders/src/strategies/ops/systemsmanager-binder-strategy.test.ts` | Invariant | Ops bindings inject managed identifiers + scoped IAM. | KernelLaw (KL-004, KL-005, KL-006) |
| `packages/binders/src/strategies/security/accessanalyzer-binder-strategy.test.ts` | Invariant | Security bindings emit governance/security intents and diagnostics. | KernelLaw (KL-008, KL-006) |
| `packages/binders/src/strategies/security/certificate-binder-strategy.test.ts` | Invariant | Certificate binding injects identifiers and scoped IAM. | KernelLaw (KL-004, KL-005, KL-006) |
| `packages/binders/src/strategies/security/cognito-user-pool-binder-strategy.test.ts` | Invariant | Auth bindings inject identifiers/config and validate access. | KernelLaw (KL-004, KL-006) |
| `packages/binders/src/strategies/security/firewallmanager-binder-strategy.test.ts` | Invariant | Security governance intent emission must be auditable. | KernelLaw (KL-008, KL-006) |
| `packages/binders/src/strategies/security/guardduty-binder-strategy.test.ts` | Invariant | Same as above. | KernelLaw (KL-008, KL-006) |
| `packages/binders/src/strategies/security/iamrole-binder-strategy.test.ts` | Invariant | Role bindings inject identifiers and produce assume/permission intents. | KernelLaw (KL-004, KL-005, KL-006) |
| `packages/binders/src/strategies/security/inspector-binder-strategy.test.ts` | Invariant | Security governance intent emission must be auditable. | KernelLaw (KL-008, KL-006) |
| `packages/binders/src/strategies/security/kms-binder-strategy.test.ts` | Invariant | KMS bindings enforce least-privilege, inject key identifiers. | KernelLaw (KL-005, KL-006) |
| `packages/binders/src/strategies/security/macie-binder-strategy.test.ts` | Invariant | Security governance intent emission must be auditable. | KernelLaw (KL-008, KL-006) |
| `packages/binders/src/strategies/security/secrets-manager-binder-strategy.test.ts` | Invariant | Secret bindings inject references and scope access; secure options add intents. | KernelLaw (KL-004, KL-005, KL-006) + Pattern (P-003) |
| `packages/binders/src/strategies/security/securityhub-binder-strategy.test.ts` | Invariant | Security governance intent emission must be auditable. | KernelLaw (KL-008, KL-006) |
| `packages/binders/src/strategies/security/waf-binder-strategy.test.ts` | Invariant | WAF bindings inject identifiers/config and validate access. | KernelLaw (KL-004, KL-006) |
| `packages/binders/src/strategies/storage/efs-binder-strategy.test.ts` | Invariant | Storage bindings inject identifiers and least-privilege IAM. | KernelLaw (KL-004, KL-005, KL-006) |
| `packages/binders/src/strategies/storage/parameterstore-binder-strategy.test.ts` | Invariant | Parameter bindings inject names/paths and scoped IAM. | KernelLaw (KL-004, KL-005, KL-006) |
| `packages/binders/src/strategies/storage/s3-binder-strategy.test.ts` | Invariant | Bucket bindings inject identifiers and least-privilege IAM; secure options add intents. | KernelLaw (KL-004, KL-005, KL-006) + Pattern (P-003) |
| `packages/binders/src/strategies/security/unified-security-strategies-integration.test.ts` | Behavioral | Multiple security strategies must compose deterministically in the registry/matrix. | KernelLaw (KL-001, KL-003) |

## packages/components

Component tests frequently mix **semantic expectations** (precedence, validation, capability contracts) with **CDK template assertions**. For V3:\n- treat CDK template assertions as **legacy evidence**,\n- preserve the semantic behavior as **graph inputs → derived intents/diagnostics**.

> Full per-file extraction is in `components.md`.

## packages/governance

| File | Classification | Rationale | Porting |
|---|---|---|---|
| `packages/governance/src/__tests__/risk-tier-sso.test.ts` | Invariant | Governance risk-tier logic must be deterministic and policy-driven. | KernelLaw (KL-001, KL-006, KL-008) |

## apps

### apps/svc CLI tests

| File | Classification | Rationale | Porting |
|---|---|---|---|
| `apps/svc/src/cli/__tests__/catalog.test.ts` | Behavioral | Catalog output contract and error handling should remain stable. | Pattern (P-008) |
| `apps/svc/src/cli/__tests__/composition-root.test.ts` | Behavioral | Composition root wiring should preserve command contracts and dependency injection expectations. | Pattern (P-008) |
| `apps/svc/src/cli/__tests__/console-logger.test.ts` | Invariant | Structured logging contract (human vs json modes) must be deterministic. | KernelLaw (KL-006) + Pattern (P-008) |
| `apps/svc/src/cli/__tests__/destroy-command.test.ts` | Implementation-only (drop) | Likely backend-specific destroy semantics; V3 should re-express as backend-neutral plan/apply/destroy via adapters. | Legacy (do not port) |
| `apps/svc/src/cli/__tests__/diff-command.test.ts` | Implementation-only (drop) | CloudFormation API + template diff (backend-specific). | Legacy (do not port) |
| `apps/svc/src/cli/__tests__/execution-context-manager.test.ts` | Behavioral | Context caching and structured output fields should remain stable. | Pattern (P-008) |
| `apps/svc/src/cli/__tests__/plan-command.test.ts` | Behavioral | Plan command returns resolved manifest + warnings + structuredData. | Pattern (P-008) |
| `apps/svc/src/cli/__tests__/synth-command.test.ts` | Behavioral | Manifest discovery + command result contract are useful; CDK account/region env gating is legacy. | Pattern (P-008) + Legacy notes |
| `apps/svc/src/cli/__tests__/template-diff.test.ts` | Implementation-only (drop) | CloudFormation template diff (backend-specific). | Legacy (do not port) |
| `apps/svc/src/cli/__tests__/up-command.test.ts` | Implementation-only (drop) | Likely backend deployment semantics; port only the command contract, not backend actions. | Legacy (do not port) |
| `apps/svc/src/cli/__tests__/utils/repo-root.test.ts` | Invariant | Repo-root resolution must be deterministic and diagnostic. | KernelLaw (KL-006) |
| `apps/svc/src/cli/__tests__/validate-command.test.ts` | Behavioral | Validate command exit codes, json mode, and human summary behavior should remain stable. | Pattern (P-008) |

### Sample app tests (not platform semantics)

| File | Classification | Rationale | Porting |
|---|---|---|---|
| `apps/api-s3-service/src/test/handler.test.ts` | Implementation-only (drop) | Application runtime behavior, not Shinobi kernel semantics. | Legacy (do not port) |
| `apps/api-s3-service/src/queue-processor/test/handler.test.ts` | Implementation-only (drop) | Application runtime behavior, not Shinobi kernel semantics. | Legacy (do not port) |

### Generated artifacts under cdk.out (drop)

| File | Classification | Rationale | Porting |
|---|---|---|---|
| `apps/api-s3-service/cdk.out/asset.9bdf656c07ed958e6443a06ebcbc0685b5079fdeafb9e9e2bd4a90d95cbf4b38/cli/__tests__/catalog.test.ts` | Implementation-only (drop) | Generated build artifact. | Legacy (do not port) |
| `apps/api-s3-service/cdk.out/asset.9bdf656c07ed958e6443a06ebcbc0685b5079fdeafb9e9e2bd4a90d95cbf4b38/cli/__tests__/composition-root.test.ts` | Implementation-only (drop) | Generated build artifact. | Legacy (do not port) |
| `apps/api-s3-service/cdk.out/asset.9bdf656c07ed958e6443a06ebcbc0685b5079fdeafb9e9e2bd4a90d95cbf4b38/cli/__tests__/console-logger.test.ts` | Implementation-only (drop) | Generated build artifact. | Legacy (do not port) |
| `apps/api-s3-service/cdk.out/asset.9bdf656c07ed958e6443a06ebcbc0685b5079fdeafb9e9e2bd4a90d95cbf4b38/cli/__tests__/destroy-command.test.ts` | Implementation-only (drop) | Generated build artifact. | Legacy (do not port) |
| `apps/api-s3-service/cdk.out/asset.9bdf656c07ed958e6443a06ebcbc0685b5079fdeafb9e9e2bd4a90d95cbf4b38/cli/__tests__/diff-command.test.ts` | Implementation-only (drop) | Generated build artifact. | Legacy (do not port) |
| `apps/api-s3-service/cdk.out/asset.9bdf656c07ed958e6443a06ebcbc0685b5079fdeafb9e9e2bd4a90d95cbf4b38/cli/__tests__/execution-context-manager.test.ts` | Implementation-only (drop) | Generated build artifact. | Legacy (do not port) |
| `apps/api-s3-service/cdk.out/asset.9bdf656c07ed958e6443a06ebcbc0685b5079fdeafb9e9e2bd4a90d95cbf4b38/cli/__tests__/plan-command.test.ts` | Implementation-only (drop) | Generated build artifact. | Legacy (do not port) |
| `apps/api-s3-service/cdk.out/asset.9bdf656c07ed958e6443a06ebcbc0685b5079fdeafb9e9e2bd4a90d95cbf4b38/cli/__tests__/synth-command.test.ts` | Implementation-only (drop) | Generated build artifact. | Legacy (do not port) |
| `apps/api-s3-service/cdk.out/asset.9bdf656c07ed958e6443a06ebcbc0685b5079fdeafb9e9e2bd4a90d95cbf4b38/cli/__tests__/template-diff.test.ts` | Implementation-only (drop) | Generated build artifact. | Legacy (do not port) |
| `apps/api-s3-service/cdk.out/asset.9bdf656c07ed958e6443a06ebcbc0685b5079fdeafb9e9e2bd4a90d95cbf4b38/cli/__tests__/up-command.test.ts` | Implementation-only (drop) | Generated build artifact. | Legacy (do not port) |
| `apps/api-s3-service/cdk.out/asset.9bdf656c07ed958e6443a06ebcbc0685b5079fdeafb9e9e2bd4a90d95cbf4b38/cli/__tests__/utils/repo-root.test.ts` | Implementation-only (drop) | Generated build artifact. | Legacy (do not port) |
| `apps/api-s3-service/cdk.out/asset.9bdf656c07ed958e6443a06ebcbc0685b5079fdeafb9e9e2bd4a90d95cbf4b38/cli/__tests__/validate-command.test.ts` | Implementation-only (drop) | Generated build artifact. | Legacy (do not port) |
| `apps/api-s3-service/cdk.out/api-s3-service/asset.9bdf656c07ed958e6443a06ebcbc0685b5079fdeafb9e9e2bd4a90d95cbf4b38/cli/__tests__/catalog.test.ts` | Implementation-only (drop) | Generated build artifact. | Legacy (do not port) |
| `apps/api-s3-service/cdk.out/api-s3-service/asset.9bdf656c07ed958e6443a06ebcbc0685b5079fdeafb9e9e2bd4a90d95cbf4b38/cli/__tests__/composition-root.test.ts` | Implementation-only (drop) | Generated build artifact. | Legacy (do not port) |
| `apps/api-s3-service/cdk.out/api-s3-service/asset.9bdf656c07ed958e6443a06ebcbc0685b5079fdeafb9e9e2bd4a90d95cbf4b38/cli/__tests__/console-logger.test.ts` | Implementation-only (drop) | Generated build artifact. | Legacy (do not port) |
| `apps/api-s3-service/cdk.out/api-s3-service/asset.9bdf656c07ed958e6443a06ebcbc0685b5079fdeafb9e9e2bd4a90d95cbf4b38/cli/__tests__/destroy-command.test.ts` | Implementation-only (drop) | Generated build artifact. | Legacy (do not port) |
| `apps/api-s3-service/cdk.out/api-s3-service/asset.9bdf656c07ed958e6443a06ebcbc0685b5079fdeafb9e9e2bd4a90d95cbf4b38/cli/__tests__/diff-command.test.ts` | Implementation-only (drop) | Generated build artifact. | Legacy (do not port) |
| `apps/api-s3-service/cdk.out/api-s3-service/asset.9bdf656c07ed958e6443a06ebcbc0685b5079fdeafb9e9e2bd4a90d95cbf4b38/cli/__tests__/execution-context-manager.test.ts` | Implementation-only (drop) | Generated build artifact. | Legacy (do not port) |
| `apps/api-s3-service/cdk.out/api-s3-service/asset.9bdf656c07ed958e6443a06ebcbc0685b5079fdeafb9e9e2bd4a90d95cbf4b38/cli/__tests__/plan-command.test.ts` | Implementation-only (drop) | Generated build artifact. | Legacy (do not port) |
| `apps/api-s3-service/cdk.out/api-s3-service/asset.9bdf656c07ed958e6443a06ebcbc0685b5079fdeafb9e9e2bd4a90d95cbf4b38/cli/__tests__/synth-command.test.ts` | Implementation-only (drop) | Generated build artifact. | Legacy (do not port) |
| `apps/api-s3-service/cdk.out/api-s3-service/asset.9bdf656c07ed958e6443a06ebcbc0685b5079fdeafb9e9e2bd4a90d95cbf4b38/cli/__tests__/template-diff.test.ts` | Implementation-only (drop) | Generated build artifact. | Legacy (do not port) |
| `apps/api-s3-service/cdk.out/api-s3-service/asset.9bdf656c07ed958e6443a06ebcbc0685b5079fdeafb9e9e2bd4a90d95cbf4b38/cli/__tests__/up-command.test.ts` | Implementation-only (drop) | Generated build artifact. | Legacy (do not port) |
| `apps/api-s3-service/cdk.out/api-s3-service/asset.9bdf656c07ed958e6443a06ebcbc0685b5079fdeafb9e9e2bd4a90d95cbf4b38/cli/__tests__/utils/repo-root.test.ts` | Implementation-only (drop) | Generated build artifact. | Legacy (do not port) |
| `apps/api-s3-service/cdk.out/api-s3-service/asset.9bdf656c07ed958e6443a06ebcbc0685b5079fdeafb9e9e2bd4a90d95cbf4b38/cli/__tests__/validate-command.test.ts` | Implementation-only (drop) | Generated build artifact. | Legacy (do not port) |
| `apps/api-s3-service/cdk.out/api-s3-service/asset.4fdcb3f34ce55c4464664090a3bd27bc17f72cc304aaf01d45e2c27ebd8f02a6/test/handler.test.js` | Implementation-only (drop) | Generated build artifact. | Legacy (do not port) |

