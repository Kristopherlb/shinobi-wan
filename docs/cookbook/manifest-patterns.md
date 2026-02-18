# Manifest Pattern Cookbook

This cookbook provides practical, copy-ready manifest patterns for the current Shinobi MVP surface.

## How to Use This Cookbook

1. Copy a pattern.
2. Customize IDs, platform config, and binding config.
3. Run:
   - `validate`
   - `plan`
   - `up` (preview first)

Use TDD when extending pattern behavior in code:
- Red: add failing tests for new binder/lowerer behavior.
- Green: implement minimum to pass.
- Refactor: improve structure without behavior drift.

## Compatibility Matrix

| Pattern | Platform Nodes | Binding Types | Deployable Today | Notes |
|---|---|---|---|---|
| Lambda -> SQS | `aws-lambda`, `aws-sqs` | `bindsTo` | yes | Includes IAM, SSM, and event source mapping where applicable |
| API GW -> Lambda -> DynamoDB | `aws-apigateway`, `aws-lambda`, `aws-dynamodb` | `bindsTo`, `triggers` | yes | Includes API integrations, route, permission, IAM, and SSM |
| Lambda -> S3 | `aws-lambda`, `aws-s3` | `bindsTo` | yes | S3 versioning optional via platform config |
| Network-constrained bindsTo | any | `bindsTo` with `network` config | partial | Network intent accepted, adapter emits warning; no deployable network resource emission in MVP |
| Telemetry-enabled pattern | any | telemetry intents | partial | Telemetry intents are currently skipped by adapter lowering |

## Pattern 1: Lambda -> SQS

Use when a Lambda component consumes/uses an SQS queue.

```yaml
service: my-lambda-sqs
components:
  - id: api-handler
    type: component
    platform: aws-lambda
    config:
      runtime: nodejs20.x
      handler: index.handler
      memorySize: 256
      timeout: 30
  - id: work-queue
    type: platform
    platform: aws-sqs
    config:
      visibilityTimeout: 300
bindings:
  - source: api-handler
    target: work-queue
    type: bindsTo
    config:
      resourceType: queue
      accessLevel: write
      configKeys:
        - key: QUEUE_URL
          valueSource:
            type: reference
            nodeRef: work-queue
            field: url
policyPack: Baseline
```

Expected resource classes:
- Lambda Function
- SQS Queue
- IAM role/policy/attachments
- SSM parameter(s)
- Lambda event source mapping (for supported bind relationship)

## Pattern 2: API Gateway -> Lambda -> DynamoDB

Use when exposing a Lambda-backed API that reads/writes DynamoDB.

```yaml
service: apigw-dynamodb-api
components:
  - id: api-gateway
    type: platform
    platform: aws-apigateway

  - id: handler
    type: component
    platform: aws-lambda
    config:
      runtime: nodejs20.x
      handler: index.handler
      memorySize: 256
      timeout: 30

  - id: data-table
    type: platform
    platform: aws-dynamodb
    config:
      keySchema:
        hashKey:
          name: pk
          type: S
        rangeKey:
          name: sk
          type: S

bindings:
  - source: handler
    target: data-table
    type: bindsTo
    config:
      resourceType: table
      accessLevel: write
      configKeys:
        - key: TABLE_NAME
          valueSource:
            type: reference
            nodeRef: data-table
            field: name

  - source: api-gateway
    target: handler
    type: triggers
    config:
      resourceType: api
      route: /items
      method: GET
```

Expected resource classes:
- API Gateway API/Stage/Integration/Route
- Lambda Function + Permission
- DynamoDB Table
- IAM role/policy/attachments
- SSM parameter(s)

## Pattern 3: Lambda -> S3

Use when Lambda needs bucket access and bucket name injection.

```yaml
service: lambda-s3-worker
components:
  - id: worker
    type: component
    platform: aws-lambda
    config:
      runtime: nodejs20.x
      handler: index.handler

  - id: assets
    type: platform
    platform: aws-s3
    config:
      versioning: true

bindings:
  - source: worker
    target: assets
    type: bindsTo
    config:
      resourceType: bucket
      accessLevel: write
      configKeys:
        - key: BUCKET_NAME
          valueSource:
            type: reference
            nodeRef: assets
            field: bucket
```

Expected resource classes:
- S3 Bucket (+ optional versioning)
- Lambda + IAM
- SSM parameter for injected config

## Pattern 4: Least-Privilege Safer IAM

When possible:
- prefer `accessLevel: read` over `write/admin`
- avoid pattern-scope wildcard resources unless required
- keep policy pack strictness aligned to target environment

## Pattern Validation Checklist

- Every binding has `resourceType`.
- `source` and `target` map to declared component IDs.
- Reference keys (`nodeRef` + `field`) match intended platform outputs.
- Preview output matches expected resource classes before apply.

## Known MVP Caveats

- Network config in `bindsTo` produces network intent, but adapter currently emits warning diagnostics instead of deployable network resources.
- Telemetry intents are currently skipped by adapter lowering.

## Test-First Extension Workflow (For New Patterns)

When adding a new platform or binding pattern in code:

1. Add failing binder/lowerer tests for the new behavior.
2. Implement minimum binder/lowerer changes.
3. Add or update conformance tests for determinism and policy behavior.
4. Update this cookbook with a validated manifest example.
