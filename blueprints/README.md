# Shinobi Blueprints

YAML manifests for common infrastructure patterns. Every blueprint in this
directory passes `shinobi validate` and produces a resource plan with
`shinobi plan`; CI enforces this via `pnpm blueprints:check`.

## AI Blueprints

| Blueprint | Description                          | File                               |
| --------- | ------------------------------------ | ---------------------------------- |
| BP-A01    | Bedrock Gateway + Cost Controls      | `ai/bedrock-gateway.yaml`          |
| BP-A02    | Self-Hosted LLM on EKS               | `ai/self-hosted-llm-eks.yaml`      |
| BP-A03    | SageMaker Endpoint                   | `ai/sagemaker-endpoint.yaml`       |
| BP-A05    | Batch Inference Pipeline             | `ai/batch-inference-pipeline.yaml` |
| BP-A06    | RAG Pipeline                         | `ai/rag-pipeline.yaml`             |
| BP-A07    | Vector Database                      | `ai/vector-database.yaml`          |
| BP-A09    | Agent Orchestration (Step Functions) | `ai/agent-orchestration-sfn.yaml`  |
| BP-A16    | ML Training Pipeline (SageMaker)     | `ai/ml-training-pipeline.yaml`     |

## Compute Blueprints

| Blueprint | Description                       | File                               |
| --------- | --------------------------------- | ---------------------------------- |
| BP-004    | Serverless API → Queue → ETL → S3 | `compute/serverless-api-etl.yaml`  |
| BP-005    | EKS Managed Cluster               | `compute/eks-managed-cluster.yaml` |
| BP-006    | ECS Fargate + ALB                 | `compute/ecs-fargate-alb.yaml`     |
| BP-007    | Scheduled Batch Processing        | `compute/scheduled-batch.yaml`     |
| BP-008    | Static Site + CDN + WAF           | `compute/static-site-cdn-waf.yaml` |

## Infrastructure Blueprints

| Blueprint | Description                                              | File                              |
| --------- | -------------------------------------------------------- | --------------------------------- |
| BP-I01    | Account Bootstrap (Config, Security Hub, GuardDuty)      | `infra/account-bootstrap.yaml`    |
| BP-I03    | Hub-Spoke Networking (Transit Gateway, Network Firewall) | `infra/networking-hub-spoke.yaml` |
| BP-I09    | Aurora Serverless v2                                     | `infra/aurora-serverless-v2.yaml` |
| BP-I10    | MSK Kafka (multi-AZ, TLS)                                | `infra/msk-kafka.yaml`            |
| BP-I11    | Data Lake (Glue ETL, crawlers, Athena)                   | `infra/data-lake.yaml`            |
| BP-I12    | ElastiCache Redis                                        | `infra/elasticache-redis.yaml`    |
| BP-I14    | Centralized Logging                                      | `infra/centralized-logging.yaml`  |
| BP-I15    | WAF + Shield + Secrets Management                        | `infra/waf-shield-secrets.yaml`   |
| BP-I18    | Cost Optimization (Budgets, alerts)                      | `infra/cost-optimization.yaml`    |

## Usage

```bash
# Validate a blueprint
node packages/cli/dist/main.js validate blueprints/compute/serverless-api-etl.yaml

# Generate a plan
node packages/cli/dist/main.js plan blueprints/compute/serverless-api-etl.yaml --region us-east-1

# Deploy (requires Pulumi + AWS credentials)
node packages/cli/dist/main.js up blueprints/compute/serverless-api-etl.yaml --region us-east-1

# Validate every blueprint and example (same check CI runs)
pnpm blueprints:check
```

## Template

Use `_template.yaml` as a starting point for custom manifests.
