# Component Support Matrix

This is the honest coverage map for the AWS adapter. Every entry below is a
registered node lowerer (`packages/adapters/aws/src/lowerer-registry.ts`) —
nothing here is aspirational — but coverage comes in two confidence tiers, and
consumers should plan accordingly.

## Confidence Tiers

| Tier                 | Meaning                                                                                                                                                                                         |
| -------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Deploy-confident** | Exercised end-to-end through plan/preview/apply paths and covered by the reality audit as substantial concrete resource coverage. Safe to use in real deployments.                              |
| **Shape-tested**     | Lowering emits deterministic, correctly shaped resource plans validated by tests — but deploy-time behavior against real AWS has not been hardened. Validate in a sandbox before relying on it. |

Optional live-cloud smoke tests exist behind `SHINOBI_RUN_PULUMI_SMOKE=true`;
they currently exercise the deploy-confident tier.

## Node Types by Family

### Compute & Containers

| Platform type                                                                      | Tier             |
| ---------------------------------------------------------------------------------- | ---------------- |
| `aws-lambda`                                                                       | Deploy-confident |
| `aws-ecs-cluster`, `aws-ecs-task-definition`, `aws-ecs-service`                    | Shape-tested     |
| `aws-ecr`, `aws-alb`                                                               | Shape-tested     |
| `aws-eks-cluster`, `aws-eks-node-group`, `aws-eks-gpu-node-group`, `aws-eks-addon` | Shape-tested     |

### Messaging & Events

| Platform type                                       | Tier             |
| --------------------------------------------------- | ---------------- |
| `aws-sqs`, `aws-sns`                                | Deploy-confident |
| `aws-eventbridge-scheduler`, `aws-kinesis-firehose` | Shape-tested     |
| `aws-msk-cluster`, `aws-msk-configuration`          | Shape-tested     |

### Data & Storage

| Platform type                                                                  | Tier             |
| ------------------------------------------------------------------------------ | ---------------- |
| `aws-dynamodb`, `aws-s3`                                                       | Deploy-confident |
| `aws-rds-cluster`, `aws-rds-proxy`                                             | Shape-tested     |
| `aws-elasticache`                                                              | Shape-tested     |
| `aws-opensearch`, `aws-opensearch-serverless`                                  | Shape-tested     |
| `aws-glue-catalog`, `aws-glue-crawler`, `aws-glue-job`, `aws-athena-workgroup` | Shape-tested     |

### AI / ML & Orchestration

| Platform type                                                                       | Tier         |
| ----------------------------------------------------------------------------------- | ------------ |
| `aws-bedrock`                                                                       | Shape-tested |
| `aws-sagemaker-endpoint`, `aws-sagemaker-pipeline`, `aws-sagemaker-batch-transform` | Shape-tested |
| `aws-stepfunctions`                                                                 | Shape-tested |

### API & Edge

| Platform type                               | Tier             |
| ------------------------------------------- | ---------------- |
| `aws-apigateway` (HTTP API v2)              | Deploy-confident |
| `aws-cloudfront`, `aws-cloudfront-function` | Shape-tested     |
| `aws-wafv2`, `aws-acm`                      | Shape-tested     |
| `aws-route53-zone`, `aws-route53-record`    | Shape-tested     |

### Networking

| Platform type                                   | Tier         |
| ----------------------------------------------- | ------------ |
| `aws-vpc`, `aws-subnet`, `aws-security-group`   | Shape-tested |
| `aws-nat-gateway`                               | Shape-tested |
| `aws-transit-gateway`, `aws-tgw-vpc-attachment` | Shape-tested |
| `aws-network-firewall`                          | Shape-tested |

### Security & Governance

| Platform type                                               | Tier             |
| ----------------------------------------------------------- | ---------------- |
| IAM roles/policies, SSM parameters (via intents)            | Deploy-confident |
| `aws-kms`, `aws-secretsmanager`                             | Shape-tested     |
| `aws-cloudtrail`, `aws-config-recorder`, `aws-config-rules` | Shape-tested     |
| `aws-guardduty`, `aws-securityhub`, `aws-budgets`           | Shape-tested     |

### Observability

| Platform type                 | Tier         |
| ----------------------------- | ------------ |
| `aws-log-subscription-filter` | Shape-tested |

## Relationship (Edge) Coverage

Only edges with a registered binder compile into intents. If a manifest uses
any other edge shape, `shinobi validate` reports it — an edge never silently
compiles to nothing.

| Edge pattern                        | Emits                                              |
| ----------------------------------- | -------------------------------------------------- |
| `bindsTo` — `component → platform`  | IAM intents, config injection, network (see below) |
| `triggers` — `platform → component` | IAM invoke permissions, config                     |
| `dependsOn` — any                   | Ordering only; no security or config intents       |

## Intent Behavior Notes

- **Network intents** lower to security-group rules only when both endpoints
  are modeled `aws-security-group` nodes. API-level connectivity (e.g.
  Lambda → SQS) has no security-group enforcement point and is governed by the
  IAM intents for the same edge; an info diagnostic explains this.
- **Telemetry intents**: `traces` emit X-Ray IAM permissions; `logs`/`metrics`
  emit no standalone resources (logging configuration is handled by node
  lowerers).

## Promoting a Component to Deploy-Confident

A shape-tested lowerer graduates when it has: (1) a runnable example or
blueprint deployed against real AWS, (2) live smoke coverage under
`SHINOBI_RUN_PULUMI_SMOKE`, and (3) diagnostics for its known
deploy-time failure modes. Track promotions in
`../operations/current-roadmap.md`.
