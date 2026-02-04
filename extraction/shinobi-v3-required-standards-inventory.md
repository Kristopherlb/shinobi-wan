# Shinobi V3 — Required Standards & Specifications Inventory (Extracted)

**Purpose**: Identify the *standards and specifications that must exist in Shinobi V3*, inferred from the Shinobi repository as evidence.

**This is an extraction/definition artifact**:
- No full standards text.
- Only: Name, Scope, normative requirement headings (headings only), validation/enforcement mechanism, and evidence sources.
- CDK/CloudFormation semantics are treated as **historical evidence only** and **must not** be preserved in V3 design. Any CDK-coupled types in evidence are called out as “legacy coupling to replace with backend-neutral intent”.

**Target architecture**: agentic, graph-native kernel compiling to Pulumi (backend-neutral IR at the kernel boundary).

---

## Standard 1 — Graph IR Schema & Serialization

- **Name**: Graph IR Schema & Canonical Serialization Standard
- **Scope**: Kernel in-memory graph model (nodes/edges/derived artifacts) and its deterministic, versioned serialization for caching, diff/explain, and replay.
- **Normative requirement headings only**:
  - IR_Versioning_And_Evolution
  - Node_Identity_And_Stable_Ids
  - Node_Types_And_Metadata
  - Edge_Types_And_Semantics
  - Capability_Data_Registry_And_Contracts
  - Constraint_And_Violation_Model
  - Provenance_And_Traceability
  - Canonicalization_And_Deterministic_Serialization
  - Backend_Neutrality_And_Adapter_Boundaries
  - Schema_Compatibility_And_Migration
- **Validation/enforcement mechanism**:
  - JSON Schema (or equivalent) validation for persisted IR and tool outputs.
  - Determinism tests (snapshot/golden) ensuring byte-for-byte stable serialization for identical inputs.
  - Canonical serializer implementation constraints (stable key ordering, stable formatting).
  - CI gate(s) exercising determinism and conformance (see testing/conformance standard).
- **Evidence (source files/tests)**:
  - `extraction/skill-list.md` (graph-native kernel + determinism requirements)
  - `packages/core/src/platform/services/artifact-serializer.ts` (canonical JSON/YAML serialization config)
  - `packages/core/src/platform/contracts/deprecation-interfaces.ts` (`DependencyGraph` interface: nodes/edges/versioned structure)
  - MCP resource descriptor: `.cursor/projects/.../mcps/user-shinobi/resources/Dependency_Graph.json` (graph resource exists at protocol boundary)

---

## Standard 2 — Component SDK Contract

- **Name**: Component SDK Contract Standard
- **Scope**: Component authoring API (node creation), component lifecycle, capability publication, and constraints on component isolation for graph compilation.
- **Normative requirement headings only**:
  - Component_Identity_And_Type_System
  - Component_Context_Contract
  - Component_Spec_Input_Contract
  - Lifecycle_And_Synthesis_Phases
  - Capability_Publication_And_Data_Contracts
  - Validation_Hooks_And_Error_Model
  - Isolation_And_Internal_Dependency_Graph_Rules
  - Discovery_And_Registration_Contract
  - Observability_And_Governance_Integration_Points
  - Versioning_And_Compatibility
- **Validation/enforcement mechanism**:
  - Compile-time contract enforcement via TypeScript interfaces.
  - Runtime component class validation on registration (required methods).
  - Pattern validation via MCP tool(s) (component pattern conformance).
  - Schema validation of manifest inputs and component config schemas (see validation pipeline standard).
- **Evidence (source files/tests)**:
  - `packages/core/src/platform/contracts/component-interfaces.ts` (`IComponent`, `IComponentCreator`, `ComponentContext`)
  - `packages/core/src/platform/contracts/components/component-registry.ts` (runtime method checks for required component methods)
  - `docs/platform-standards/platform-component-api-spec.md` (published component contract)
  - MCP tool schema: `.cursor/projects/.../mcps/user-shinobi/tools/validate_component_patterns.json`
  - `AUDIT-SUMMARY.md` (component standards baseline includes “MCP Contract”, isolation, versioning, etc.)

---

## Standard 3 — Binder Contract & Determinism

- **Name**: Binder Contract & Deterministic Edge Compilation Standard
- **Scope**: Edge compilation (binding/trigger directives) producing backend-neutral derived artifacts and compliance signals deterministically.
- **Normative requirement headings only**:
  - Binder_Interface_And_Purity
  - Inputs_BindingContext_And_Directives
  - Outputs_EnhancedBindingResult_Envelope
  - Compatibility_Matrix_Declaration
  - Determinism_And_Idempotency
  - Access_Level_And_Action_Profile_Semantics
  - Derived_Artifacts_Emission_Contracts
  - Diagnostics_And_Error_Model
  - Observability_And_Metrics_Reporting
  - Forbidden_Backend_Handles_In_Kernel_Output
- **Validation/enforcement mechanism**:
  - Contract enforcement via `IUnifiedBinderStrategy` and `EnhancedBindingResult`.
  - Manifest-level binding directive validation (compatibility, access level, action profiles).
  - Determinism conformance tests (golden outputs / snapshot).
  - CI checks for binder-related conformance (via workflows / audits).
- **Evidence (source files/tests)**:
  - `packages/core/src/platform/contracts/platform-binding-trigger-spec.ts` (`IUnifiedBinderStrategy`, `CompatibilityEntry`, `EnhancedBindingResult`)
  - `packages/core/src/services/binding-directive-validator.ts` (compatibility matrix validation; access level checks; action profile validation)
  - `extraction/skill-list.md` (Determinism Engineering; binder/graph constraints)
  - Example binder tests: `packages/binders/src/strategies/networking/__tests__/vpc-binder-strategy.test.ts`

---

## Standard 4 — Policy Engine Lifecycle

- **Name**: Policy Engine Lifecycle & Policy-Pack Loading Standard
- **Scope**: How policy packs are selected, loaded, evaluated, and reported as machine-readable violations/actions during planning/edge compilation.
- **Normative requirement headings only**:
  - Policy_Pack_Format_And_Versioning
  - Framework_Selection_And_Precedence
  - Rule_Catalog_Loading_And_Resolution
  - Evaluation_Phases_And_When_Policy_Runs
  - Violation_Model_And_Severity_Tiers
  - Compliance_Status_Block_Contract
  - Override_And_Escape_Hatch_Restrictions
  - Audit_And_Explainability_Requirements
- **Validation/enforcement mechanism**:
  - Central wrapper enforcing “compliance block always populated”.
  - Rule loading precedence and restrictions (e.g., overrides denied in higher-assurance frameworks).
  - CI gates that run conformance suites across framework triad.
- **Evidence (source files/tests)**:
  - `packages/core/src/platform/contracts/unified-binder-strategy-base.ts` (framework resolution; rule loading precedence; evaluation; override restriction)
  - `packages/core/src/platform/contracts/platform-binding-trigger-spec.ts` (mandatory compliance block in `EnhancedBindingResult`)
  - `config/commercial.yml`, `config/fedramp-moderate.yml`, `config/fedramp-high.yml` (policy packs as configuration)
  - `AUDIT-SUMMARY.md` (policy/config-driven compliance expectations; “no framework branching”)

---

## Standard 5 — Exception / Suppression Model

- **Name**: Exception & Suppression (Governance) Standard
- **Scope**: First-class exception records that allow bounded, expiring deviations from policy/conformance checks with ownership and justification; independent of IaC engine.
- **Normative requirement headings only**:
  - Exception_Record_Schema
  - Scope_And_Targeting_Model
  - Justification_And_Ownership
  - Expiry_TTL_And_Renewal
  - Approval_Workflow_Hooks
  - Reporting_And_Audit_Trail
  - Enforcement_Of_Required_Fields
  - Mapping_From_Legacy_Suppressions
- **Validation/enforcement mechanism**:
  - Manifest semantic validation enforcing required suppression fields and date format.
  - CI/audit checks to ensure exceptions are registered and time-bounded.
- **Evidence (source files/tests)**:
  - `packages/core/src/services/reference-validator.ts` (validates `governance.cdkNag.suppress[]` required fields: `id`, `justification`, `owner`, `expiresOn` + ISO date validation)
  - `packages/components/**/tests/security/cdk-nag.test.ts` (legacy suppression footprint; evidence to map into a backend-neutral exception model)
  - `AUDIT-SUMMARY.md` (references “CDK-Nag tests” as a conformance area; treat as legacy signal)

---

## Standard 6 — Security Derivation (IAM / Network Intent)

- **Name**: Security Derivation Standard (IAM Intent + Network Intent)
- **Scope**: Backend-neutral security intent emitted by binders/graph compilation, validated for least privilege and safe networking, then lowered by backend adapters.
- **Normative requirement headings only**:
  - IAM_Intent_Schema
  - Least_Privilege_Validation
  - Action_Profile_And_Access_Level_Mapping
  - Resource_Scoping_And_Wildcard_Restrictions
  - Network_Intent_Schema
  - Ingress_Egress_Rule_Model
  - Cross_Stack_And_Cross_Service_Networking
  - Provenance_And_Audit_Metadata_For_Security_Derivations
  - Forbidden_Direct_Grants_In_Components
- **Validation/enforcement mechanism**:
  - Binder wrapper validates IAM resources (anti-wildcard).
  - Post-processing applies security derivations consistently (legacy evidence; becomes adapter responsibility in V3).
  - Integration/unit tests around derivation behavior.
- **Evidence (source files/tests)**:
  - `packages/core/src/platform/contracts/platform-binding-trigger-spec.ts` (`EnhancedBindingResult.iamPolicies` and `.securityGroupRules`)
  - `packages/core/src/platform/contracts/unified-binder-strategy-base.ts` (resource wildcard validation; least-privilege checks)
  - `packages/core/src/platform/contracts/bindings.ts` (`SecurityGroupRule` schema; `IamPolicy` is CDK-coupled—legacy coupling to replace in V3)
  - `packages/core/src/resolver/iam-policy-post-processor.ts` (explicit rule: binder is source of truth; components must not directly grant permissions)
  - `packages/core/src/resolver/security-group-rule-post-processor.ts` (network rules applied via post-processing; cross-stack handling)

---

## Standard 7 — Plan Artifact Structure

- **Name**: Plan Artifact & Output Contract Standard
- **Scope**: Machine-readable plan artifacts emitted by the kernel (and supporting files) for CI, audit, and explain; independent of IaC backend.
- **Normative requirement headings only**:
  - Artifact_Envelope_And_Versioning
  - Component_Plan_Entries
  - Validation_Result_Schema
  - Compliance_Summary_Schema
  - Deterministic_File_Layout
  - Serialization_Formats_And_Canonicalization
  - Human_Readable_Presentation_Contract
  - Replay_And_Idempotency_Metadata
- **Validation/enforcement mechanism**:
  - Artifact schema definitions (types/contracts).
  - Standard writer enforcing output directory structure.
  - Serializer enforcing stable formatting.
  - CLI commands producing/consuming artifacts (validate/plan/up/migrate).
- **Evidence (source files/tests)**:
  - `packages/core/src/platform/contracts/artifacts.ts` (`PlanArtifact`, `ValidationResult`, `ComplianceSummary`, etc.)
  - `packages/core/src/platform/services/artifact-writer.ts` (file layout: `plan.json`, `components/{id}/component.plan.json`, `summary.json`, `validation.json`, `compliance.json`)
  - `packages/core/src/platform/services/artifact-serializer.ts` (canonical JSON/YAML serialization parameters)
  - `apps/svc/src/cli/validate-command.ts` (standardized, machine-consumable validate result + exit codes)

---

## Standard 8 — Observability & Audit Schema

- **Name**: Observability (OTel) + Structured Logging + Audit Record Standard
- **Scope**: Telemetry intents and runtime injection contracts; structured logging schema; governance/audit record schema for tool calls and enforcement.
- **Normative requirement headings only**:
  - Telemetry_Descriptor_Schema
  - OTel_Environment_Injection_Contract
  - Tracing_Config_And_Propagation
  - Metrics_Alarms_Dashboards_Descriptors
  - Structured_Log_Event_Schema
  - Correlation_TraceId_SpanId_Requirements
  - PII_Detection_And_Redaction
  - Audit_Required_Rules_By_Framework
  - Governance_Metadata_Derivation
  - Immutable_Audit_Record_Schema
- **Validation/enforcement mechanism**:
  - Runtime libraries enforce shape/behavior (structured JSON logs; redaction; correlation).
  - Tool/audit record schemas validate governance records.
  - CI/audit workflows validate conformance and generate evidence.
- **Evidence (source files/tests)**:
  - `packages/core/src/platform/observability/src/index.ts` (telemetry descriptor schema + OTel env contract)
  - `packages/core/src/platform/logger/src/index.ts` (`LogEvent` schema; redaction; audit-required logic; MCP stdio log routing)
  - `packages/core/src/platform/services/governance/governance.service.ts` (governance metadata derivation; classification/retention/auditRequired signals)
  - `packages/governance/src/schemas/audit-record.schema.json` (immutable audit record schema)
  - `.cursor/rules/00-core.mdc` (OTel/logging/tagging requirements; “no console.log”)

---

## Standard 9 — Testing & Conformance Standard

- **Name**: Platform Testing & Conformance Standard
- **Scope**: Required test types, metadata, determinism rules, triad coverage, and CI gating for platform kernel/components/binders/tools.
- **Normative requirement headings only**:
  - Test_Level_Definitions
  - Determinism_Fixtures_Clock_Rng_Io
  - Oracle_Types_And_Single_Oracle_Rule
  - Test_Metadata_Schema_And_Validation
  - Test_Naming_Convention
  - Snapshot_Masking_And_Stability
  - Triad_Matrix_Coverage_Frameworks
  - Contract_Tests_And_Mocks
  - Conformance_Gating_In_CI
  - Evidence_Collection_And_Indexing
- **Validation/enforcement mechanism**:
  - Test metadata schema validation (adjacent `.meta.json` expectations).
  - CI workflows running audit/conformance and component test suites.
  - Triad matrix checks (commercial/fedramp-moderate/fedramp-high).
  - Contract tests for protocol schemas (JSON Schema/OpenAPI).
- **Evidence (source files/tests)**:
  - `docs/platform-standards/platform-testing-standard.md` (PTS-1.0)
  - `packages/core/src/services/tests/test-metadata-schema.json` (machine schema)
  - `.github/workflows/audit-platform.yml` (platform governance audit in CI)
  - `.github/workflows/compliance-check.yml` (component test execution in CI)
  - `.cursor/rules/54-triad-tests.mdc` (triad matrix expectation)
  - `.cursor/rules/52-contracts.mdc` (API contracts/mocks expectation)
  - MCP tool schema: `.cursor/projects/.../mcps/user-shinobi/tools/run_component_tests.json`

---

## Standard 10 — Agent Tool Protocol (JSON)

- **Name**: Agent Tool Protocol Standard (JSON)
- **Scope**: Agent↔platform tool-call envelope, capability manifests, tool schemas, and audit hooks for safe replay and governance.
- **Normative requirement headings only**:
  - Tool_Call_Envelope_Schema
  - Correlation_Trace_Causation_Model
  - Idempotency_And_Retry_Semantics
  - Capability_Manifest_Schema_And_Versioning
  - Risk_Tiers_And_Ownership_Metadata
  - Tool_Schema_Validation_And_Unknown_Field_Policy
  - Audit_Record_Emission_And_Immutability
  - Structured_Error_Schema
  - Contract_Tests_For_Tool_Schemas
- **Validation/enforcement mechanism**:
  - Compile-time contract for envelope type.
  - JSON Schema validation for capability manifests and tool argument shapes.
  - Audit record schema validation and persistence rules.
- **Evidence (source files/tests)**:
  - `packages/api/src/contracts/tool-envelope.ts` (`ToolCallEnvelope<T>`)
  - `packages/api/src/schemas/capability.schema.json` (Universal Capability Manifest schema; risk tier; owner; input/output schemas)
  - `packages/governance/src/schemas/audit-record.schema.json` (audit record contract)
  - MCP tool schemas under `.cursor/projects/.../mcps/user-shinobi/tools/*.json` (tool argument contracts exist and are versionable inputs to agents)

---

## Standard 11 — Manifest Validation Pipeline (Schema + Semantic + Reference)

- **Name**: Manifest Validation Pipeline Standard
- **Scope**: Validation stages for manifest parsing, schema validation, context hydration, and semantic/reference checks before planning/execution.
- **Normative requirement headings only**:
  - Manifest_Discovery_And_Parsing
  - Schema_Validation_And_Schema_Composition
  - Binder_Matrix_Compatibility_Validation
  - Context_Hydration_And_Environment_Resolution
  - Reference_Validation_Model
  - Ordering_Constraints_And_Determinism
  - Error_Report_Schema_And_Actionable_Messages
  - Exit_Codes_And_Machine_Output
- **Validation/enforcement mechanism**:
  - Orchestrated stage pipeline (parse → schema validate → hydrate → references).
  - AJV schema validation with enhanced validation and explicit “no silent fallback on invalid results”.
  - Directive/binder compatibility checks and action profile checks.
- **Evidence (source files/tests)**:
  - `apps/svc/src/cli/validate-command.ts` (validate command, exit codes, JSON output mode)
  - `packages/core/src/services/validation-orchestrator.ts` (4-stage pipeline)
  - `packages/core/src/services/schema-validator.ts` (AJV + enhanced validation; strict failure reporting)
  - `packages/core/src/services/binding-directive-validator.ts` (compatibility/action validation)
  - `packages/core/src/services/reference-validator.ts` (`${ref:...}` validation, `@component:` ordering checks, governance suppression field validation)

---

## Standard 12 — Escape Hatch / Patch Registration & Controls

- **Name**: Escape Hatch (Patch) Registration & Governance Standard
- **Scope**: Controlled mechanism for programmatic overrides (“escape hatches”) with mandatory registration and expiry, for auditability and bounded risk.
- **Normative requirement headings only**:
  - Patch_Registration_Schema
  - Justification_Minimums
  - Ownership_And_Expiry
  - Validation_And_Enforcement
  - Plan_And_Audit_Reporting
  - Sunset_And_Remediation_Workflow
- **Validation/enforcement mechanism**:
  - Schema validation enforcing registration fields and minimum justification length.
  - Conformance tests requiring registration/justification and snapshotting patch effects.
- **Evidence (source files/tests)**:
  - `packages/core/src/services/service-manifest.schema.json` (`extensions.patches[]` with required fields and constraints)
  - `.cursor/rules/00-core.mdc` (“patches.ts as escape hatch last”; validate with `svc validate`)
  - `.cursor/rules/53-patches.mdc` (escape hatch test expectations)

---

## Standard 13 — Determinism & Stable Identity (Cross-Cutting)

- **Name**: Determinism & Stable Identity Standard
- **Scope**: Deterministic compilation and stable identity across kernel graph, artifacts, and tool outputs; includes stable ID generation and canonical ordering rules.
- **Normative requirement headings only**:
  - Stable_Node_And_Edge_Identifiers
  - Canonical_Ordering_Rules
  - Deterministic_Hashing_And_Name_Derivation
  - Deterministic_Serialization_And_Snapshot_Stability
  - Conflict_Detection_And_Reporting
  - Non_Determinism_Source_Control
  - Replayability_And_Idempotency
- **Validation/enforcement mechanism**:
  - Determinism tests (golden artifacts / snapshot).
  - Explicit canonical serializers and ordering rules.
  - CI gates rejecting nondeterministic diffs.
- **Evidence (source files/tests)**:
  - `extraction/skill-list.md` (Determinism Engineering requirements)
  - `packages/core/src/platform/services/artifact-serializer.ts` (canonical formatting constraints)
  - `packages/core/src/platform/logical-id/logical-id-manager.ts` (legacy drift-avoidance + deterministic naming evidence; CDK-coupled)
  - `packages/core/src/platform/logical-id/drift-avoidance.ts` (legacy deterministic naming strategies evidence; CDK-coupled)

---

## Cross-cutting V3 adaptation notes (derived from evidence)

- **Backend neutrality is mandatory at the kernel boundary**:
  - Evidence includes CDK-coupled types (e.g., `PolicyStatement` in `packages/core/src/platform/contracts/bindings.ts`); V3 must replace these with backend-neutral intent schemas.
- **Compliance must be policy/config-driven (no framework branching in component/binder logic)**:
  - Enforced by the binder base class posture and repo governance expectations.
- **Structured outputs and deterministic replay are mandatory for agent tooling**:
  - Tool envelope, capability manifests, and audit records imply a contract-first, schema-validated agent protocol.

---

## Appendix A — Evidence Index (high-signal pointers)

- **Graph_IR_Schema_And_Serialization**:
  - `extraction/skill-list.md`
  - `packages/core/src/platform/services/artifact-serializer.ts`
  - `packages/core/src/platform/contracts/deprecation-interfaces.ts`
  - `.cursor/projects/.../mcps/user-shinobi/resources/Dependency_Graph.json`
- **Component_SDK_Contract**:
  - `packages/core/src/platform/contracts/component-interfaces.ts`
  - `packages/core/src/platform/contracts/components/component-registry.ts`
  - `docs/platform-standards/platform-component-api-spec.md`
  - `.cursor/projects/.../mcps/user-shinobi/tools/validate_component_patterns.json`
- **Binder_Contract_And_Determinism**:
  - `packages/core/src/platform/contracts/platform-binding-trigger-spec.ts`
  - `packages/core/src/services/binding-directive-validator.ts`
  - `packages/core/src/platform/contracts/unified-binder-strategy-base.ts`
- **Policy_Engine_Lifecycle**:
  - `packages/core/src/platform/contracts/unified-binder-strategy-base.ts`
  - `config/fedramp-moderate.yml`, `config/fedramp-high.yml`, `config/commercial.yml`
- **Exception_And_Suppression_Model**:
  - `packages/core/src/services/reference-validator.ts`
  - `packages/components/**/tests/security/cdk-nag.test.ts` (legacy input model)
- **Security_Derivation_IAM_And_Network**:
  - `packages/core/src/platform/contracts/platform-binding-trigger-spec.ts`
  - `packages/core/src/platform/contracts/bindings.ts` (note CDK-coupled IAM)
  - `packages/core/src/resolver/iam-policy-post-processor.ts`
  - `packages/core/src/resolver/security-group-rule-post-processor.ts`
- **Plan_Artifact_Structure**:
  - `packages/core/src/platform/contracts/artifacts.ts`
  - `packages/core/src/platform/services/artifact-writer.ts`
  - `packages/core/src/platform/services/artifact-serializer.ts`
- **Observability_And_Audit_Schema**:
  - `packages/core/src/platform/logger/src/index.ts`
  - `packages/core/src/platform/observability/src/index.ts`
  - `packages/governance/src/schemas/audit-record.schema.json`
- **Testing_And_Conformance**:
  - `docs/platform-standards/platform-testing-standard.md`
  - `packages/core/src/services/tests/test-metadata-schema.json`
  - `.github/workflows/audit-platform.yml`
  - `.cursor/rules/54-triad-tests.mdc`
- **Agent_Tool_Protocol_JSON**:
  - `packages/api/src/contracts/tool-envelope.ts`
  - `packages/api/src/schemas/capability.schema.json`
  - `.cursor/projects/.../mcps/user-shinobi/tools/*.json`
- **Manifest_Validation_Pipeline**:
  - `packages/core/src/services/validation-orchestrator.ts`
  - `packages/core/src/services/schema-validator.ts`
  - `packages/core/src/services/reference-validator.ts`
  - `apps/svc/src/cli/validate-command.ts`
- **Escape_Hatch_Patch_Governance**:
  - `packages/core/src/services/service-manifest.schema.json` (`extensions.patches[]`)
  - `.cursor/rules/53-patches.mdc`

---

## Appendix B — Legacy Coupling Ledger (evidence → required V3 replacement artifact)

> This is a **mapping list** only (no implementation, no full spec).

| Legacy coupling in repo evidence | Where it appears | V3 replacement artifact (name only) |
|---|---|---|
| IAM policies embed CDK `PolicyStatement` | `packages/core/src/platform/contracts/bindings.ts` (`IamPolicy.statement: PolicyStatement`) | IAM_Intent_Schema (backend-neutral) |
| IAM application performed by CDK post-processor | `packages/core/src/resolver/iam-policy-post-processor.ts` | Adapter_Lowering_Contract_For_IAM_Intents |
| Network rules applied via CDK `CfnSecurityGroupIngress/Egress` | `packages/core/src/resolver/security-group-rule-post-processor.ts` | Network_Intent_Schema + Adapter_Lowering_Contract_For_Network_Intents |
| CloudFormation logical-id preservation and drift avoidance | `packages/core/src/platform/logical-id/*` | Stable_Identity_And_Deterministic_Naming_Spec (IR-level) |
| Capability naming/data shapes reference CDK sources | `docs/platform-standards/platform-capability-naming-standard.md` | Capability_Data_Contract_Registry (backend-neutral) |
| CDK-Nag suppressions model | `packages/components/**/tests/security/cdk-nag.test.ts`, manifest governance suppressions | Exception_Record_Schema (backend-neutral) |

---

## Appendix C — Gaps & Unknowns to resolve for V3 (headings only)

- Graph_IR_Diff_And_Explain_Contract
- Graph_Snapshot_Storage_And_Addressing
- Policy_Evaluation_Placement (GraphTime_vs_PlanTime_vs_Both)
- Backend_Adapter_Interface (Pulumi_Target) And_Artifact_Boundaries
- Unified_Error_Schema_For_Agent_Tools (Codes_Categories_Remediation)
- Capability_Taxonomy_Governance_And_Versioning
- Deterministic_Ordering_Rules_For_Graph_Traversal_And_Compilation
- Evidence_Bundle_Contract (OSCAL_And_CI_Evidence_Integration)
