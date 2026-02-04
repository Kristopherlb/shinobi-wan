## Contracts Index (machine-checkable contract surfaces)

This index inventories **machine-checkable contract surfaces** in this repo: schemas, typed envelopes, structured outputs, artifact layouts, and other deterministic data shapes that are intended to be validated by code (AJV/JSON Schema/TypeScript) or by audit rule engines.

For each contract, this index captures:
- **Contract name**
- **File path(s)**
- **Versioning signals** (if any)
- **What consumes it** (CLI/tool/tests)
- **Backend coupling notes** (if any)

---

## JSON Schemas

### Platform service manifest schema (base)
- **Contract name**: Platform Service Manifest (base schema)
- **File path(s)**:
  - `packages/core/src/services/service-manifest.schema.json`
- **Versioning signals**:
  - JSON Schema draft: `$schema: "http://json-schema.org/draft-07/schema#"`
  - No explicit schema version field (version is implied by file history + draft)
- **What consumes it**:
  - `packages/core/src/services/schema-manager.ts` (loads base schema)
  - `packages/core/src/services/manifest-schema-composer.ts` (loads base schema, composes master schema)
  - `packages/core/src/services/schema-validator.ts` and `packages/core/src/services/enhanced-schema-validator.ts` (AJV validation)
  - CLI: `apps/svc/src/cli/validate-command.ts` (validation pipeline)
- **Backend coupling notes**:
  - **No backend calls** required for schema validation; used offline.
  - Couples to repo component schema layout via schema composition (see “Manifest schema composition”).

### Component configuration schemas (`Config.schema.json`)
These schemas define the **machine-checkable** shape of `components[].config` per component type. They are discovered and composed into a master schema by `ManifestSchemaComposer`.

- **Contract name**: Component Config Schema Family (`Config.schema.json`)
- **File path(s)** (authoritative list from repo scan):
  - `packages/components/ai-provider/Config.schema.json` (**has `$id`**)
  - `packages/components/api-gateway-http/Config.schema.json` (**has `$id`**)
  - `packages/components/api-gateway-rest/Config.schema.json`
  - `packages/components/application-load-balancer/Config.schema.json`
  - `packages/components/auto-scaling-group/Config.schema.json`
  - `packages/components/certificate-manager/Config.schema.json`
  - `packages/components/cloudfront-distribution/Config.schema.json`
  - `packages/components/cognito-user-pool/Config.schema.json`
  - `packages/components/container-application/Config.schema.json`
  - `packages/components/dagger-engine-pool/Config.schema.json` (**has `$id`**)
  - `packages/components/dagger-engine-pool/src/schema/Config.schema.json` (**has `$id`**, preferred by composer)
  - `packages/components/deployment-bundle-pipeline/Config.schema.json`
  - `packages/components/dynamodb-table/Config.schema.json`
  - `packages/components/ec2-instance/Config.schema.json`
  - `packages/components/ecr-repository/Config.schema.json`
  - `packages/components/ecs-cluster/Config.schema.json`
  - `packages/components/ecs-ec2-service/Config.schema.json`
  - `packages/components/ecs-fargate-service/Config.schema.json` (**has `$id`**)
  - `packages/components/efs-filesystem/Config.schema.json` (**has `$id`**)
  - `packages/components/elasticache-redis/Config.schema.json`
  - `packages/components/eventbridge-rule-cron/Config.schema.json`
  - `packages/components/eventbridge-rule-pattern/Config.schema.json` (**has `$id`**)
  - `packages/components/feature-flag/Config.schema.json`
  - `packages/components/glue-job/Config.schema.json`
  - `packages/components/iam-policy/Config.schema.json`
  - `packages/components/iam-role/Config.schema.json`
  - `packages/components/kinesis-stream/Config.schema.json` (**has `$id`**)
  - `packages/components/lambda-api/Config.schema.json`
  - `packages/components/lambda-worker/Config.schema.json` (**has `$id`**)
  - `packages/components/network-rules-stack/Config.schema.json` (**has `$id`**)
  - `packages/components/openfeature-provider/Config.schema.json` (**has `$id`**)
  - `packages/components/opensearch-domain/Config.schema.json` (**has `$id`**)
  - `packages/components/rds-postgres/Config.schema.json`
  - `packages/components/route53-hosted-zone/Config.schema.json` (**has `$id`**)
  - `packages/components/route53-record/Config.schema.json` (**has `$id`**)
  - `packages/components/s3-bucket/Config.schema.json`
  - `packages/components/sagemaker-notebook-instance/Config.schema.json` (**has `$id`**)
  - `packages/components/secrets-manager/Config.schema.json` (**has `$id`**)
  - `packages/components/security-group-import/Config.schema.json` (**has `$id`**)
  - `packages/components/sns-topic/Config.schema.json` (**has `$id`**)
  - `packages/components/sqs-queue/Config.schema.json` (**has `$id`**)
  - `packages/components/ssm-parameter/Config.schema.json` (**has `$id`**)
  - `packages/components/static-website/Config.schema.json` (**has `$id`**)
  - `packages/components/step-functions-statemachine/Config.schema.json` (**has `$id`**)
  - `packages/components/vpc/Config.schema.json` (**has `$id`**)
  - `packages/components/waf-web-acl/Config.schema.json` (**has `$id`**)
- **Versioning signals**:
  - JSON Schema draft: typically `$schema: "http://json-schema.org/draft-07/schema#"`
  - **Some** include `$id` URLs with version-like segments (commonly `v1.0.0`); **many do not**.
  - **Composition note**: `packages/core/src/services/manifest-schema-composer.ts` deletes each component schema’s `$id` during normalization before composing into `$defs`. So `$id` is a versioning signal for humans/tools at rest, but not necessarily preserved in the composed master schema.
- **What consumes it**:
  - `packages/core/src/services/manifest-schema-composer.ts` (discovers and loads these schemas)
  - `packages/core/src/services/enhanced-schema-validator.ts` (AJV validation of each `components[].config`)
  - `packages/core/src/services/schema-validator.ts` (enhanced validation path and fallback basic validation)
  - CLI: `apps/svc/src/cli/validate-command.ts` (manifest validation) and other CLI commands via shared execution context/planning/synthesis flows
- **Backend coupling notes**:
  - Schema validation is offline, but the **meaning** of fields is coupled to component implementations (CDK constructs, AWS services) in each component package.

### Universal Capability Manifest (UCM) schema
- **Contract name**: Universal Capability Manifest (UCM)
- **File path(s)**:
  - `packages/api/src/schemas/capability.schema.json`
  - Generated TS type: `packages/api/src/types/capability.ts`
  - Generator script: `packages/api/scripts/generate-capability-types.mjs`
  - Runtime schema path export: `packages/api/src/index.ts` (`CAPABILITY_SCHEMA_PATH`)
- **Versioning signals**:
  - JSON Schema draft: `$schema: "http://json-schema.org/draft-07/schema#"`
  - Explicit `version` property with SemVer pattern
- **What consumes it**:
  - Type generation (build-time): `packages/api/scripts/generate-capability-types.mjs`
  - Governance tests enforce shared enum sources of truth: `packages/governance/src/__tests__/risk-tier-sso.test.ts`
  - Used conceptually as the contract for tool capability definitions (input/output schemas embedded as JSON Schema objects)
- **Backend coupling notes**:
  - Decouples tool callers from providers; no direct backend calls required to validate the schema itself.

### Governance audit record schema
- **Contract name**: Audit Record (immutable governance record)
- **File path(s)**:
  - `packages/governance/src/schemas/audit-record.schema.json`
  - Runtime schema path export: `packages/governance/src/index.ts` (`AUDIT_RECORD_SCHEMA_PATH`)
- **Versioning signals**:
  - JSON Schema draft: `$schema: "http://json-schema.org/draft-07/schema#"`
  - `additionalProperties: false` (strict schema lock)
  - No explicit schema version field
- **What consumes it**:
  - Exported for runtime tooling: `packages/governance/src/index.ts`
  - Referenced as a platform standard/invariant in docs: `extraction/invariants.md` (INV-020) and `extracted-kb/shinobi-v3-required-standards-inventory.md`
- **Backend coupling notes**:
  - Designed to record tool/governance actions; links conceptually to tool envelope via `action.tool_name` and `context.trace_id`.

### Test metadata schema (Platform Testing Standard)
- **Contract name**: Test Metadata Schema (PTS-1.0)
- **File path(s)**:
  - `packages/core/src/services/tests/test-metadata-schema.json`
  - Validator: `packages/core/src/services/tests/test-metadata-validator.ts` (AJV + business rules)
  - Audit ruleset (machine-checkable YAML): `.cursor/audit/platform-testing.yaml`
  - Example sidecars (instances): `apps/svc/src/cli/__tests__/*.test.meta.json`, `packages/components/**/tests/**/*.test.meta.json`, `packages/core/src/resolver/__tests__/*.test.meta.json` (53 files discovered)
- **Versioning signals**:
  - JSON Schema draft: `$schema: "http://json-schema.org/draft-07/schema#"`
  - Human version signal in description: “Platform Testing Standard v1.0”
  - Audit ruleset has top-level `version: 1` in `.cursor/audit/platform-testing.yaml`
- **What consumes it**:
  - Programmatic validation: `packages/core/src/services/tests/test-metadata-validator.ts`
  - Audit compliance checks: `.cursor/audit/platform-testing.yaml` rules `PTS-101`… (e.g., required fields, sidecar presence)
- **Backend coupling notes**:
  - No backend calls required; enforcement is CI/local validation.

### Nx generator option schemas
- **Contract name**: Nx generator input schema: `new-binder`
- **File path(s)**:
  - `packages/generators/src/generators/new-binder/schema.json`
  - Registry: `packages/generators/generators.json` (schema path reference)
- **Versioning signals**:
  - `$schema: "http://json-schema.org/schema"`
  - Generator id: `id: "new-binder"`
- **What consumes it**:
  - Nx generator runtime (via `packages/generators/generators.json`)
- **Backend coupling notes**:
  - None.

- **Contract name**: Nx generator input schema: `new-agent-skill`
- **File path(s)**:
  - `packages/generators/src/generators/new-agent-skill/schema.json`
  - Registry: `packages/generators/generators.json`
- **Versioning signals**:
  - `$schema: "http://json-schema.org/schema"`
  - Generator id: `id: "new-agent-skill"`
- **What consumes it**:
  - Nx generator runtime (via `packages/generators/generators.json`)
- **Backend coupling notes**:
  - None.

---

## Manifest schema composition & validation pipeline (schema “consumers”)

### Service manifest file naming & discovery (instance contract surface)
- **Contract name**: Service manifest file discovery (`service.yml` / `service.yaml`)
- **File path(s)**:
  - Discovery logic is used in multiple CLI commands, including:
    - `apps/svc/src/cli/validate-command.ts`
    - `apps/svc/src/cli/synth-command.ts`
    - `apps/svc/src/cli/up-command.ts`
    - `apps/svc/src/cli/diff-command.ts`
    - `apps/svc/src/cli/destroy-command.ts`
- **Versioning signals**:
  - None (convention-based).
- **What consumes it**:
  - CLI workflows that walk up directories and/or resolve paths to locate the manifest.
- **Backend coupling notes**:
  - Validation/parsing is offline; synthesis/deploy/diff/destroy may couple to AWS depending on command.

### Base schema loader
- **Contract name**: Base schema discovery contract (manifest base schema path resolution)
- **File path(s)**:
  - `packages/core/src/services/schema-manager.ts`
- **Versioning signals**:
  - Implicit; uses ordered candidate path list (moduleDir/src/dist)
- **What consumes it**:
  - `packages/core/src/services/schema-validator.ts` (basic validation fallback path)
- **Backend coupling notes**:
  - Couples to build output layout (`dist/services/service-manifest.schema.json`) and repo structure.

### Master schema composer (base + component schemas → composed schema)
- **Contract name**: Master manifest schema composition contract
- **File path(s)**:
  - `packages/core/src/services/manifest-schema-composer.ts`
- **Versioning signals**:
  - Implicit; composition behavior is the contract (glob patterns + priority rules)
- **What consumes it**:
  - `packages/core/src/services/enhanced-schema-validator.ts` (AJV compile of composed schema)
  - `packages/core/src/services/schema-validator.ts` (creates composer if missing)
- **Backend coupling notes**:
  - Couples to repo root inference and schema file layout:
    - Globs: `packages/components/**/Config.schema.json`, `packages/components/**/src/schema/Config.schema.json`
    - Priority: prefers `/src/schema/` then `/src/` then root
  - Explicitly relaxes `additionalProperties` for platform-injected fields and test fixtures.

### Schema validation entrypoint (Stage 2)
- **Contract name**: Manifest schema validation service contract
- **File path(s)**:
  - `packages/core/src/services/schema-validator.ts`
  - `packages/core/src/services/enhanced-schema-validator.ts`
- **Versioning signals**:
  - Feature flags are version-like toggles:
    - `SHINOBI_DISABLE_ENHANCED_VALIDATION=true` (forces basic validation)
    - `SHINOBI_STRICT_SCHEMA_VALIDATION=true` (AJV strict mode behavior)
- **What consumes it**:
  - Validation orchestrators and CLI flows (directly/indirectly), including `apps/svc/src/cli/validate-command.ts`
- **Backend coupling notes**:
  - Validation itself is offline; but enhanced validation can reference binder registry if present.

---

## Binding/trigger directive contracts & schema-locked directive options

### Platform binding & trigger spec (TypeScript contract)
- **Contract name**: Platform Binding & Trigger Specification v1.0
- **File path(s)**:
  - `packages/core/src/platform/contracts/platform-binding-trigger-spec.ts`
- **Versioning signals**:
  - Header declares “v1.0” and “Status: Published”
  - Types are versioned through TypeScript source control
- **What consumes it**:
  - Platform binder/trigger interfaces and implementations across `packages/core` and `packages/binders`
  - Directive schema validation uses `BindingDirective` type: `packages/core/src/platform/contracts/directive-schema-validator.ts`
- **Backend coupling notes**:
  - This is a core “in-process” contract; backend coupling depends on binder implementations (CDK/AWS).

### Directive options schema registry (per capability)
- **Contract name**: Directive `options` JSON Schema registry (capability-keyed)
- **File path(s)**:
  - `packages/core/src/platform/contracts/schemas/directive-schemas.ts`
- **Versioning signals**:
  - No explicit version; the registry keys (capability strings) and schema contents are the contract.
- **What consumes it**:
  - `packages/core/src/platform/contracts/directive-schema-validator.ts` (`getDirectiveSchema`, `getEnvAllowList`)
  - Resolver engine validates directives before execution: `packages/core/src/resolver/resolver-engine.ts` (calls `DirectiveSchemaValidator.validate`)
- **Backend coupling notes**:
  - No backend calls for validation; designed as a security boundary against injection.

### Directive schema validator (AJV runtime validation)
- **Contract name**: Directive validation contract (options/env allow-list + deep-freeze)
- **File path(s)**:
  - `packages/core/src/platform/contracts/directive-schema-validator.ts`
- **Versioning signals**:
  - No explicit version; behavior is locked by code.
- **What consumes it**:
  - Resolver validation flows (e.g., `packages/core/src/resolver/resolver-engine.ts`)
- **Backend coupling notes**:
  - None for validation; used pre-execution.

---

## Tool protocol & structured tool envelopes

### Tool call envelope (structured tool invocation)
- **Contract name**: Tool Call Envelope (`ToolCallEnvelope<T>`)
- **File path(s)**:
  - `packages/api/src/contracts/tool-envelope.ts`
  - Re-export: `packages/api/src/index.ts`
- **Versioning signals**:
  - No explicit version field; the TypeScript interface shape is the versioning mechanism.
- **What consumes it**:
  - Orchestration plan contract references it: `packages/orchestration/src/contracts/frozen-plan.ts`
  - Tooling that treats “tool calls” as structured events (protocol referenced in `extracted-kb/skills/agent-tooling-discipline-structured-outputs.md`)
- **Backend coupling notes**:
  - Intended to decouple tool call transport from backend execution.
  - Semantic coupling: `tool_name` is intended to match a capability manifest id (UCM).

### Frozen plan (immutable plan steps)
- **Contract name**: Frozen Plan (`FrozenPlan`)
- **File path(s)**:
  - `packages/orchestration/src/contracts/frozen-plan.ts`
- **Versioning signals**:
  - No explicit version; TypeScript interface is the contract.
- **What consumes it**:
  - Orchestration systems that serialize a plan with tool calls as immutable steps.
- **Backend coupling notes**:
  - Indirect coupling via `PlanStep.tool_call: ToolCallEnvelope` (capability/tool id naming).

---

## CLI structured outputs (result envelopes + JSON mode)

These are machine-checkable **structured outputs** emitted by CLI commands when `--json` is used. They are designed for CI/CD and programmatic consumption.

### `shinobi plan` result contract
- **Contract name**: PlanResult (CLI structured output)
- **File path(s)**:
  - `apps/svc/src/cli/plan-command.ts`
- **Versioning signals**:
  - No explicit version field; TypeScript interface is the contract.
- **What consumes it**:
  - CLI factory `apps/svc/src/cli/commands/plan.ts` (prints JSON to stdout in JSON mode)
  - CI/CD pipelines parsing JSON output
- **Backend coupling notes**:
  - Explicitly **no AWS calls** (offline planning/validation).

### `shinobi validate` result contract
- **Contract name**: ValidateResult (CLI structured output)
- **File path(s)**:
  - `apps/svc/src/cli/validate-command.ts`
- **Versioning signals**:
  - No explicit version field.
- **What consumes it**:
  - CLI factory `apps/svc/src/cli/commands/validate.ts` (prints JSON)
  - CI/CD validation checks
- **Backend coupling notes**:
  - Explicitly **no AWS calls**; validates file content and references.

### `shinobi synth` result contract
- **Contract name**: SynthResult (CLI structured output)
- **File path(s)**:
  - `apps/svc/src/cli/synth-command.ts`
- **Versioning signals**:
  - No explicit version field.
- **What consumes it**:
  - CLI factory `apps/svc/src/cli/commands/synth.ts` (prints JSON)
  - Tooling that consumes stack/template locations
- **Backend coupling notes**:
  - Synthesizes CDK locally; does not deploy. Coupled to CDK output conventions (`cdk.out`).

### `shinobi diff` result contract + template diff shape
- **Contract name**: DiffResult + TemplateDiff (structured diff)
- **File path(s)**:
  - `apps/svc/src/cli/diff-command.ts` (`DiffResult`)
  - `apps/svc/src/cli/utils/template-diff.ts` (`TemplateDiff`, `ResourceDiff`)
- **Versioning signals**:
  - No explicit version field.
- **What consumes it**:
  - CLI factory `apps/svc/src/cli/commands/diff.ts` (prints JSON)
  - CI/CD drift detection parsing `TemplateDiff`
- **Backend coupling notes**:
  - **Coupled to AWS** CloudFormation APIs (fetches deployed template).

### `shinobi up` result contract
- **Contract name**: UpResult (deployment structured output)
- **File path(s)**:
  - `apps/svc/src/cli/up-command.ts`
- **Versioning signals**:
  - No explicit version field.
- **What consumes it**:
  - CLI factory `apps/svc/src/cli/commands/up.ts` (prints JSON)
  - CI/CD pipelines and deployment tooling
- **Backend coupling notes**:
  - **Coupled to AWS** via CDK deploy and service calls (deployment is a side-effecting command).

### `shinobi destroy` result contract
- **Contract name**: DestroyResult (destructive command output)
- **File path(s)**:
  - `apps/svc/src/cli/destroy-command.ts`
- **Versioning signals**:
  - No explicit version field.
- **What consumes it**:
  - CLI factory `apps/svc/src/cli/commands/destroy.ts` (prints JSON)
- **Backend coupling notes**:
  - **Coupled to AWS** CloudFormation delete operations.

### `shinobi catalog` result contract
- **Contract name**: CatalogResult (component catalog output)
- **File path(s)**:
  - `apps/svc/src/cli/catalog.ts`
- **Versioning signals**:
  - No explicit version field.
- **What consumes it**:
  - CLI invocation / JSON output to stdout
  - Tooling that enumerates components and their capabilities
- **Backend coupling notes**:
  - Offline; coupled to local registry/catalog loading.

### `shinobi network-rules` result contract
- **Contract name**: NetworkRulesResult
- **File path(s)**:
  - `apps/svc/src/cli/network-rules-command.ts`
- **Versioning signals**:
  - No explicit version field.
- **What consumes it**:
  - CLI invocation / JSON output (when `--json`)
- **Backend coupling notes**:
  - **Coupled to AWS** SSM Parameter Store (reads rule specs) and optional deploy.

---

## Artifact contracts (plan/deploy/migrate) + on-disk layouts

### Artifact interfaces (machine-readable artifact types)
- **Contract name**: CLI Artifact Contracts (`PlanArtifact`, `DeploymentArtifact`, `MigrationArtifact`)
- **File path(s)**:
  - `packages/core/src/platform/contracts/artifacts.ts`
- **Versioning signals**:
  - `BaseArtifact.version: string` (explicit)
- **What consumes it**:
  - Artifact serialization/writing services
  - CI/CD and audit systems that ingest artifacts
- **Backend coupling notes**:
  - Pure data contracts; writing/reading is local filesystem.

### Artifact serializer (JSON/YAML)
- **Contract name**: Artifact serialization formats
- **File path(s)**:
  - `packages/core/src/platform/services/artifact-serializer.ts`
- **Versioning signals**:
  - Implicit; JSON vs YAML format is part of the contract (factory `create('json'|'yaml')`)
- **What consumes it**:
  - `packages/core/src/platform/services/artifact-writer.ts`
- **Backend coupling notes**:
  - None.

### Artifact writer (file layout contract)
- **Contract name**: Artifact filesystem layout (file names & directory structure)
- **File path(s)**:
  - `packages/core/src/platform/services/artifact-writer.ts` (`StandardArtifactWriter`)
- **Versioning signals**:
  - Implicit; filenames/paths are the contract.
- **What consumes it**:
  - Artifact-producing flows (writer exists as service). Also referenced in standards inventory: `extracted-kb/shinobi-v3-required-standards-inventory.md`.
  - Some components expect presence of `plan.json` as an artifact input (e.g., `packages/components/deployment-bundle-pipeline/src/deployment-bundle-pipeline.component.ts` references `planJson: 'plan.json'`).
- **Backend coupling notes**:
  - None for layout itself; downstream consumers may couple artifacts to deployment systems.

**Plan artifact layout** (`outputDir/`):

- `plan.json`
- `summary.json`
- `validation.json`
- `compliance.json`
- `components/{componentId}/component.plan.json`
- `components/{componentId}/compliance.plan.json` (if `ComponentPlanArtifact.compliancePlan` exists)

**Deployment artifact layout** (`outputDir/`):

- `deployment.json`
- `resources.json`
- `changes.json`
- `outputs.json`
- `stacks/{stackName}.json`

**Migration artifact layout** (`outputDir/`):

- `migration.json`
- `logical-id-map.json`
- `MIGRATION_REPORT.md`
- `components/{componentId}.json`
- `service.yml` (copied in, if present)
- `patches.js` (copied in, if present)

---

## Validation & error/diagnostic contracts

### Standard error envelope
- **Contract name**: Platform Error Standard v1.0 (`StandardError`)
- **File path(s)**:
  - `packages/core/src/services/error-message-utils.ts`
- **Versioning signals**:
  - Header declares “Platform Error Standard v1.0”
  - Error code set `ErrorCodes` and shape `StandardError` are the machine-checkable contract
- **What consumes it**:
  - Platform services generating standardized errors and suggestions
  - CLI/user-facing formatting and logs (stringified)
- **Backend coupling notes**:
  - None.

### Enhanced schema validation result types
- **Contract name**: Enhanced schema validation result contracts (`ValidationResult`, `ValidationError`)
- **File path(s)**:
  - `packages/core/src/services/enhanced-schema-validator.ts`
- **Versioning signals**:
  - No explicit version field.
- **What consumes it**:
  - `packages/core/src/services/schema-validator.ts` (generates error report and throws)
  - CLI validation flows (indirectly)
- **Backend coupling notes**:
  - None; driven by AJV validation + additional semantic checks.

---

## Test metadata conventions (instance-level contract surface)

Even though the schema is centralized, the **file naming/layout convention** is itself a contract surface enforced by audit rules.

### Metadata sidecar convention
- **Contract name**: Test metadata sidecar convention
- **File path(s)**:
  - Audit ruleset: `.cursor/audit/platform-testing.yaml`
  - Instance patterns:
    - `**/?(*.)+(spec|test).[tj]s?(x)` with adjacent `*.meta.(json|yaml|yml)` (audit rule `PTS-101`)
    - Repo instances include `**/*.test.meta.json` (53 files discovered)
- **Versioning signals**:
  - `.cursor/audit/platform-testing.yaml` has `version: 1`
- **What consumes it**:
  - Audit checks and CI enforcement
  - Test review processes (human + automated)
- **Backend coupling notes**:
  - None.

---

## Audit/evidence artifacts

### OSCAL component audit artifacts
- **Contract name**: OSCAL assessment results artifacts (static JSON snapshots)
- **File path(s)** (11 discovered):
  - `packages/components/waf-web-acl/audit/waf-web-acl.oscal.json`
  - `packages/components/vpc/audit/vpc.oscal.json`
  - `packages/components/lambda-api/audit/lambda-api.oscal.json`
  - `packages/components/ecs-cluster/audit/ecs-cluster.oscal.json`
  - `packages/components/ec2-instance/audit/ec2-instance.oscal.json`
  - `packages/components/deployment-bundle-pipeline/audit/deployment-bundle-pipeline.oscal.json`
  - `packages/components/dagger-engine-pool/audit/dagger-engine-pool.oscal.json`
  - `packages/components/auto-scaling-group/audit/auto-scaling-group.oscal.json`
  - `packages/components/application-load-balancer/audit/application-load-balancer.oscal.json`
  - `packages/components/api-gateway-rest/audit/api-gateway-rest.oscal.json`
  - `packages/components/api-gateway-http/audit/api-gateway-http.oscal.json`
- **Versioning signals**:
  - `oscal-version` field (commonly `1.0.4`; one file observed with `1.0.0`)
  - `metadata.version` typically present (component/doc version)
- **What consumes it**:
  - Compliance/audit evidence bundle processes (referenced in standards inventory and PR templates)
  - Human audit review and evidence attachment (see `.github/PULL_REQUEST_TEMPLATE.md` for checklist references)
- **Backend coupling notes**:
  - These are static artifacts; no runtime coupling unless a pipeline ingests them.

---

## Other machine-checkable contracts (non-schema, typed structures)

### Cross-stack network rule spec (SSM JSON contract)
- **Contract name**: Cross-stack security group rule specification (`CrossStackRuleSpec`)
- **File path(s)**:
  - `packages/core/src/platform/networking/cross-stack-rule-manager.ts` (`CrossStackRuleSpec`)
  - CLI consumer (parses JSON): `apps/svc/src/cli/network-rules-command.ts`
- **Versioning signals**:
  - No explicit version field; schema is TypeScript interface.
- **What consumes it**:
  - Runtime writes/reads JSON blobs stored in SSM path `/shinobi/network-rules/...`
  - `shinobi network-rules` parses JSON to synthesize a rules stack
- **Backend coupling notes**:
  - **Coupled to AWS SSM** storage and to CDK constructs for security group rules.

