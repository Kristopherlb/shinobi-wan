# Shinobi Blueprint Catalog

Canonical catalog of all target blueprints. This is the "what we're building" reference for the Shinobi product surface.

**Current progress**: 22/38 complete | 55 node lowerers | 43 policy rules | ~1,750 tests

---

## General Infrastructure Blueprints (18)

| #   | ID     | Blueprint                  | Description                                                  | Status      |
| --- | ------ | -------------------------- | ------------------------------------------------------------ | ----------- |
| 1   | BP-I01 | Account Bootstrap          | AWS Config, Security Hub, GuardDuty, CloudTrail, Budgets     | **DONE**    |
| 2   | BP-I02 | Multi-Account Organization | AWS Organizations, SCPs, centralized logging                 | NOT STARTED |
| 3   | BP-I03 | Networking Hub-Spoke       | Transit Gateway, NAT Gateway, Network Firewall, Route53      | **DONE**    |
| 4   | BP-004 | Serverless API + ETL       | Lambda, SQS, DynamoDB, API Gateway, S3, SNS                  | **DONE**    |
| 5   | BP-005 | EKS Managed Cluster        | EKS Cluster, Node Groups, VPC, Subnets, Security Groups      | **DONE**    |
| 6   | BP-006 | ECS Fargate + ALB          | ECS Cluster, Task Definition, Service, ALB, VPC, ECR         | **DONE**    |
| 7   | BP-007 | Scheduled Batch Processing | EventBridge, Step Functions, Lambda                          | **DONE**    |
| 8   | BP-008 | Static Site + CDN + WAF    | CloudFront, S3, WAF, ACM, CloudFront Functions               | **DONE**    |
| 9   | BP-I09 | Aurora Serverless v2       | RDS Cluster, RDS Proxy, Secrets Manager                      | **DONE**    |
| 10  | BP-I10 | MSK Kafka                  | MSK Cluster, Schema Registry, MSK Connect                    | **DONE**    |
| 11  | BP-I11 | Data Lake                  | Glue Catalog, Glue Job, Glue Crawler, Athena, Lake Formation | **DONE**    |
| 12  | BP-I12 | ElastiCache Redis          | ElastiCache cluster, encryption, auth                        | **DONE**    |
| 13  | BP-I13 | OTel Observability Stack   | ECS/EKS deployments + managed observability services         | NOT STARTED |
| 14  | BP-I14 | Centralized Logging        | Kinesis Firehose, OpenSearch, CWL Subscription Filters       | **DONE**    |
| 15  | BP-I15 | WAF + Shield + Secrets     | Secrets Manager, KMS (WAF lowerer exists)                    | **DONE**    |
| 16  | BP-I16 | GitHub Actions + OIDC      | CI/CD template, OIDC provider, IAM roles                     | NOT STARTED |
| 17  | BP-I17 | CodePipeline               | CodePipeline, CodeBuild, deployment stages                   | NOT STARTED |
| 18  | BP-I18 | Cost Optimization          | Budgets, AWS Config Rules, cost alerts                       | **DONE**    |

## AI / ML / Agentic Blueprints (20)

| #   | ID     | Blueprint                       | Description                                               | Status      |
| --- | ------ | ------------------------------- | --------------------------------------------------------- | ----------- |
| 1   | BP-A01 | Bedrock Gateway + Cost Controls | Bedrock invocation via Lambda + API GW, cost guardrails   | **DONE**    |
| 2   | BP-A02 | Self-Hosted LLM on EKS          | EKS GPU nodes, Karpenter, model serving                   | **DONE**    |
| 3   | BP-A03 | SageMaker Endpoint              | SageMaker Model, EndpointConfig, Endpoint                 | **DONE**    |
| 4   | BP-A04 | Prompt Management Service       | DynamoDB + Lambda + API GW for prompt versioning          | NOT STARTED |
| 5   | BP-A05 | Batch Inference Pipeline        | SageMaker Batch Transform, S3 I/O                         | **DONE**    |
| 6   | BP-A06 | RAG Pipeline                    | OpenSearch, Bedrock embeddings, ingestion flow            | **DONE**    |
| 7   | BP-A07 | Vector Database                 | OpenSearch Serverless, vector index management            | **DONE**    |
| 8   | BP-A08 | AI Safety + Guardrails          | Bedrock Guardrails, content filtering, audit logging      | NOT STARTED |
| 9   | BP-A09 | Agent Orchestration (SFN)       | Step Functions + Lambda + DynamoDB for multi-step agents  | **DONE**    |
| 10  | BP-A10 | Temporal on EKS                 | Temporal Helm deployment on EKS                           | NOT STARTED |
| 11  | BP-A11 | Feature Store                   | SageMaker Feature Store, offline/online storage           | NOT STARTED |
| 12  | BP-A12 | Experiment Tracking             | MLflow on ECS/EKS, artifact storage                       | NOT STARTED |
| 13  | BP-A13 | Data Labeling Pipeline          | SageMaker Ground Truth, annotation workflows              | NOT STARTED |
| 14  | BP-A14 | Model Registry                  | SageMaker Model Registry, approval workflows              | NOT STARTED |
| 15  | BP-A15 | A/B Testing for Models          | Traffic splitting, canary inference endpoints             | NOT STARTED |
| 16  | BP-A16 | ML Training Pipeline            | SageMaker Pipelines, Training Jobs, hyperparameter tuning | **DONE**    |
| 17  | BP-A17 | Fine-Tuning Pipeline            | SageMaker Training, custom containers, dataset management | NOT STARTED |
| 18  | BP-A18 | Model Monitoring                | SageMaker Model Monitor, drift detection, alerts          | NOT STARTED |
| 19  | BP-A19 | Multi-Model Endpoint            | SageMaker multi-model serving, dynamic loading            | NOT STARTED |
| 20  | BP-A20 | Edge Inference                  | SageMaker Neo, IoT Greengrass, edge deployment            | NOT STARTED |

---

## Wave Prioritization

### Wave A — Lowest friction (reuses 80%+ existing lowerers)

| Blueprint                        | New Lowerers Needed       | New Policy Rules                                           |
| -------------------------------- | ------------------------- | ---------------------------------------------------------- |
| BP-I15 WAF + Shield + Secrets    | Secrets Manager, KMS      | secrets-rotation-disabled, kms-key-rotation-disabled       |
| BP-I12 ElastiCache Redis         | ElastiCache               | elasticache-encryption-disabled, elasticache-auth-disabled |
| BP-A01 Bedrock Gateway + Cost    | Bedrock                   | bedrock-guardrails-disabled                                |
| BP-A09 Agent Orchestration (SFN) | None (all exist)          | sfn-max-recursion                                          |
| BP-A05 Batch Inference           | SageMaker Batch Transform | sagemaker-vpc-disabled                                     |
| BP-I18 Cost Optimization         | Budgets, Config Rules     | budget-threshold-missing                                   |

### Wave B — Moderate effort (3-6 new lowerers each)

| Blueprint                   | New Lowerers Needed                                      |
| --------------------------- | -------------------------------------------------------- |
| BP-I09 Aurora Serverless v2 | RDS Cluster, RDS Proxy, Secrets Manager (shared)         |
| BP-I14 Centralized Logging  | Kinesis Firehose, OpenSearch, CWL Subscription           |
| BP-A06 RAG Pipeline         | OpenSearch (shared), Bedrock (shared)                    |
| BP-A07 Vector Database      | OpenSearch Serverless (shared)                           |
| BP-I01 Account Bootstrap    | AWS Config, Security Hub, GuardDuty, CloudTrail, Budgets |
| BP-A03 SageMaker Endpoint   | SageMaker Model, EndpointConfig, Endpoint                |

### Wave C — Heavy lift (6+ new lowerers or complex orchestration) — COMPLETE

| Blueprint                     | New Lowerers Added                                                                               | Status   |
| ----------------------------- | ------------------------------------------------------------------------------------------------ | -------- |
| BP-I11 Data Lake              | Glue Catalog, Glue Job, Glue Crawler, Athena Workgroup                                           | **DONE** |
| BP-A16 ML Training Pipeline   | SageMaker Pipeline                                                                               | **DONE** |
| BP-I10 MSK Kafka              | MSK Cluster, MSK Configuration                                                                   | **DONE** |
| BP-I03 Networking Hub-Spoke   | Transit Gateway, TGW VPC Attachment, NAT Gateway, Network Firewall, Route53 Zone, Route53 Record | **DONE** |
| BP-A02 Self-Hosted LLM on EKS | EKS Addon, EKS GPU Node Group                                                                    | **DONE** |
| BP-I02 Multi-Account Org      | Deferred to Wave D (fundamentally different model)                                               | —        |
| BP-A10 Temporal on EKS        | Deferred to Wave D (Helm chart integration)                                                      | —        |

### Wave D — CI/CD, cross-cutting & deferred items

| Blueprint                        | Nature                                        |
| -------------------------------- | --------------------------------------------- |
| BP-I02 Multi-Account Org         | Deferred from Wave C — Organizations, SCPs    |
| BP-A10 Temporal on EKS           | Deferred from Wave C — Helm chart integration |
| BP-I16 GitHub Actions + OIDC     | CI/CD template, not traditional lowerer       |
| BP-I17 CodePipeline              | CodePipeline, CodeBuild (AWS CI/CD)           |
| BP-I13 OTel Observability Stack  | ECS/EKS deployments + managed services        |
| BP-A04 Prompt Management Service | DynamoDB + Lambda + API GW                    |
| BP-A08 AI Safety + Guardrails    | Bedrock Guardrails, content filtering         |
| BP-A11 Feature Store             | SageMaker Feature Store                       |
| BP-A12 Experiment Tracking       | MLflow on ECS/EKS                             |
| BP-A13 Data Labeling Pipeline    | SageMaker Ground Truth                        |
| BP-A14 Model Registry            | SageMaker Model Registry                      |
| BP-A15 A/B Testing for Models    | Traffic splitting, canary endpoints           |
| BP-A17 Fine-Tuning Pipeline      | SageMaker Training, custom containers         |
| BP-A18 Model Monitoring          | SageMaker Model Monitor                       |
| BP-A19 Multi-Model Endpoint      | SageMaker multi-model serving                 |
| BP-A20 Edge Inference            | SageMaker Neo, IoT Greengrass                 |

---

## Existing Lowerer Inventory

**55 node lowerers**: Lambda, SQS, DynamoDB, S3, API Gateway, SNS, CloudFront, WAF, ACM, CloudFront Function, EventBridge, StepFunctions, VPC, Subnet, SecurityGroup, ECR, ECS Cluster, ECS TaskDef, ECS Service, ALB, EKS Cluster, EKS NodeGroup, SecretsManager, KMS, ElastiCache, Budgets, ConfigRules, Bedrock, SageMaker Batch Transform, OpenSearch Domain, Kinesis Firehose, Log Subscription Filter, OpenSearch Serverless, RDS Cluster, RDS Proxy, SageMaker Endpoint, Config Recorder, Security Hub, GuardDuty, CloudTrail, Transit Gateway, TGW VPC Attachment, NAT Gateway, Network Firewall, Route53 Zone, Route53 Record, MSK Cluster, MSK Configuration, Glue Catalog, Glue Job, Glue Crawler, Athena Workgroup, SageMaker Pipeline, EKS Addon, EKS GPU Node Group

**4 intent lowerers**: IAM, Network, Config, Telemetry

## Blueprint Development Pattern

Each blueprint follows the proven pattern:

1. Write YAML manifest: `blueprints/{category}/{name}.yaml`
2. Generate lowerer stubs: `scripts/generate-lowerer.ts`
3. Implement lowerer + tests
4. Add policy rules: `scripts/generate-policy-rule.ts`
5. Generate golden test: `scripts/generate-golden-test.ts`
6. Verify with FedRAMP audit: `scripts/audit-fedramp.ts`
