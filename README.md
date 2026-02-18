# Shinobi V3

Shinobi V3 is a deterministic infrastructure kernel that compiles manifest-defined relationships into backend-neutral intents, evaluates compliance policy, and lowers the result to deployable AWS resources through Pulumi.

## What You Get

- Deterministic graph compilation with stable IDs and canonical ordering
- Explicit edge-to-intent derivation through binders
- Policy-pack-driven compliance evaluation before deployment
- AWS adapter lowering for practical plan and deploy workflows
- Auditable, structured outputs suitable for automation and CI

## Why Shinobi Exists

Infrastructure code often combines architecture intent, provider specifics, and compliance rules in one place. Shinobi separates those concerns:

- **Manifest + graph model** define system structure and relationships
- **Binders** convert relationships into backend-neutral intents
- **Policy evaluators** assess compliance by selected policy pack
- **Adapters** lower intents to provider resources (AWS in MVP)

This keeps intent portable and behavior easier to test, reason about, and audit.

## Platform Flow

```mermaid
flowchart LR
  manifest[Service Manifest] --> parser[Manifest Parser]
  parser --> graph[Graph Mutations]
  graph --> kernel[Kernel Compile]
  kernel --> binders[Binders]
  binders --> intents[Intents]
  intents --> policy[Policy Evaluation]
  policy --> adapter[AWS Adapter Lowering]
  adapter --> plan[Resource Plan]
  plan --> pulumi[Pulumi Automation]
```

## MVP Support Matrix

Currently deployable resource families:

- `aws-lambda`
- `aws-sqs`
- `aws-sns`
- `aws-dynamodb`
- `aws-s3`
- `aws-apigateway` (v2)
- IAM resources and SSM parameters

Current limitations:

- Network intents are accepted but emit warning-only diagnostics (no network resource emission yet)
- Telemetry intents are currently skipped by adapter lowering

## Quick Start

### Prerequisites

- Node.js and `pnpm`
- Pulumi CLI in `PATH`
- AWS credentials in your shell environment

### 1) Install dependencies

```bash
pnpm install
```

### 2) Build the CLI

```bash
pnpm nx build cli
```

### 3) Validate a manifest

```bash
node packages/cli/dist/main.js validate examples/lambda-sqs.yaml
```

### 4) Generate a plan

```bash
node packages/cli/dist/main.js plan examples/lambda-sqs.yaml --region us-east-1
```

### 5) Preview changes (safe default)

```bash
node packages/cli/dist/main.js up examples/lambda-sqs.yaml --region us-east-1 --code-path /absolute/path/to/lambda.zip
```

### 6) Apply deployment

```bash
node packages/cli/dist/main.js up examples/lambda-sqs.yaml --region us-east-1 --code-path /absolute/path/to/lambda.zip --no-dry-run
```

## CLI Commands

- `validate <manifest>`: Parse, compile, and policy-check a manifest
- `plan <manifest>`: Validate and produce a deployment plan
- `up <manifest>`: Preview or deploy the generated plan

For command flags, JSON/envelope outputs, and examples:
- `docs/user/cli-reference.md`

## Authoring Manifests

Start from:

- `examples/lambda-sqs.yaml`
- `examples/lambda-sns.yaml`
- `docs/cookbook/manifest-patterns.md`

For a practical authoring workflow and validation checklist:
- `docs/user/manifest-authoring-guide.md`

## Repository Layout

- `packages/contracts`: shared contracts and types
- `packages/ir`: graph model, IDs, canonicalization
- `packages/kernel`: compile orchestration
- `packages/binder`: edge compilers that emit intents
- `packages/policy`: policy evaluation and severity mapping
- `packages/validation`: schema/semantic/determinism validation
- `packages/adapters/aws`: AWS lowering and deployment runtime
- `packages/cli`: user commands (`validate`, `plan`, `up`)
- `examples`: copy-ready manifest examples

## Testing

Run all tests:

```bash
pnpm nx run-many -t test
```

Run without cache:

```bash
pnpm nx run-many -t test --skipNxCache
```

## Documentation Map

- `docs/getting-started.md`: conceptual and operational onboarding
- `docs/user/cli-reference.md`: command-level user reference
- `docs/user/manifest-authoring-guide.md`: authoring and validation workflow
- `docs/cookbook/manifest-patterns.md`: copy-ready manifest patterns
- `docs/operations/runbook.md`: operator runbook
- `docs/operations/environment-matrix.md`: environment expectations
- `docs/architecture/adr-log.md`: architecture decision records
