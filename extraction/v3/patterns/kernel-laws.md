Kernel Laws (V3) — Backend-neutral extraction
Scope
Backend-neutral kernel/pipeline laws extracted from tests, validators, and docs.
Excluded oracles: CDK construct-tree assertions, CloudFormation template shape assertions, and CDK-nag rule execution.
ID stability
Preserve existing canonical IDs when present (e.g., KL-001… from extracted-kb/test-cases/README.md).
New laws append the next available ID (do not renumber).
Evidence rule (applies to every law)
≥ 2 evidence paths, including ≥ 1 validator/contract/service file.
Include ≥ 1 test/CLI/workflow reference when available.
Evidence must be backend-neutral (legacy may be mentioned only as a legacy note).
Conformance hook rule
Must be phrased as: Given <fixture path>, assert <structured output fields>.
If no fixture exists yet: use fixture TBD and name where it should live (repo-relative).
KL-001 — DeterministicCompilation
Class: pipeline
Summary: Identical conceptual inputs must yield byte-stable, repeatable machine outputs (stable serialization settings + deterministic artifact layout) to prevent reorder-only drift and enable replay. Ordering scope: stability requires deterministic key insertion order (no key-sorting is applied by the current serializers).
Evidence:
packages/core/src/platform/services/artifact-serializer.ts
packages/core/src/platform/services/artifact-writer.ts
packages/core/src/platform/contracts/artifacts.ts
V3 standard it supports:
Canonicalization_And_Deterministic_Serialization
Deterministic_File_Layout
Serialization_Formats_And_Canonicalization
Conformance hook: Given fixture TBD at extraction/v3/fixtures/artifacts/plan-artifact.sample.json, assert JSONArtifactSerializer.serialize() emits normalized whitespace (2-space indent) and is byte-stable across runs for identical inputs, and StandardArtifactWriter.writePlanArtifact() always writes the same file set (plan.json, summary.json, validation.json, compliance.json, plus components/<id>/component.plan.json) with identical bytes for identical inputs.
KL-002 — SchemaAndSpecValidation
Class: kernel
Summary: Inputs validate against a composed schema surface; failures produce deterministic, structured errors with stable paths and allowed-values guidance (no silent fallback).
Evidence:
packages/core/src/services/enhanced-schema-validator.ts
packages/core/src/services/manifest-schema-composer.ts
packages/core/src/services/schema-validator.ts
packages/core/src/services/tests/enhanced-schema-validator.test.ts
packages/core/src/services/tests/schema-validator.test.ts
V3 standard it supports:
Schema_Validation_And_Schema_Composition
Error_Report_Schema_And_Actionable_Messages
Conformance hook: Given fixture TBD at extraction/v3/fixtures/manifests/schema-invalid.service.yml (derived from the invalid manifest snippets in packages/core/src/services/tests/enhanced-schema-validator.test.ts), assert EnhancedSchemaValidator.validateManifest() returns deterministic structured errors with stable path, rule, and allowedValues (when applicable), and that result.valid === false.
KL-003 — CapabilityCompatibilityMatrix
Class: kernel
Summary: Binding directives are rejected when no compatible binder exists; access values are validated against a compatibility matrix, with actionable “allowed values” guidance.
Evidence:
packages/core/src/services/binding-directive-validator.ts
packages/core/src/platform/contracts/platform-binding-trigger-spec.ts
packages/core/src/services/tests/binding-directive-validator.test.ts
packages/core/src/services/tests/binding-directive-validation-integration.test.ts
V3 standard it supports:
Binder_Matrix_Compatibility_Validation
Compatibility_Matrix_Declaration
Diagnostics_And_Error_Model
Conformance hook: Given fixture packages/core/src/services/tests/binding-directive-validator.test.ts (case ValidatesBindingDirectives__InvalidAccessLevel__ReturnsError), assert returned errors include rule === 'access-level-validation' and allowedValues listing permitted access levels for that capability.
KL-005 — LeastPrivilegeByConstruction
Class: kernel
Summary: IAM derivations must reject unsafe wildcard resources for sensitive services and surface violations/remediation as structured outputs.
Evidence:
packages/core/src/platform/binders/resource-validator.ts
packages/core/src/platform/contracts/unified-binder-strategy-base.ts
packages/core/src/platform/binders/__tests__/resource-validator.test.ts
packages/core/src/platform/contracts/__tests__/unified-binder-strategy-base.test.ts
V3 standard it supports:
Least_Privilege_Validation
Resource_Scoping_And_Wildcard_Restrictions
Conformance hook: Given fixture packages/core/src/platform/binders/__tests__/resource-validator.test.ts (case ResourceValidation__SensitiveServiceWildcard__ThrowsError), assert wildcard resources for sensitive services throw a structured ResourceValidationError and the error message includes the service prefix and remediation hint (explicit ARNs required).
Legacy note: Current least-privilege enforcement operates over CDK PolicyStatement objects; V3 should preserve the semantics while moving to a backend-neutral IAM intent schema at the kernel boundary.
KL-006 — ExplainableDiagnostics
Class: pipeline
Summary: Validation and directive/binding failures must be explainable via structured diagnostics (stable paths, actionable messages, allowed-values/suggestions where possible), suitable for both human and JSON consumption.
Evidence:
packages/core/src/services/schema-error-formatter.ts
packages/core/src/services/enhanced-schema-validator.ts
packages/core/src/services/tests/binding-directive-validation-integration.test.ts
apps/svc/src/cli/validate-command.ts
apps/svc/src/cli/__tests__/validate-command.test.ts
V3 standard it supports:
Error_Report_Schema_And_Actionable_Messages
Exit_Codes_And_Machine_Output
Conformance hook: Given fixture packages/core/src/services/tests/binding-directive-validation-integration.test.ts (case ValidatesBindingErrors__InvalidAccessLevel__ProvidesHelpfulMessage), assert diagnostics include the invalid value and (when present) allowedValues; and given fixture apps/svc/src/cli/__tests__/validate-command.test.ts (case Failure__ValidationError__ReturnsErrorAndExitCode2), assert CLI returns { success: false, exitCode: 2, error: <string> }.
KL-007 — ConfigPrecedence
Class: kernel
Summary: Configuration resolution follows a defined precedence chain (defaults/platform → env/context → overrides), then resolves ${env:...} interpolation deterministically.
Evidence:
packages/core/src/platform/contracts/config-builder.ts
packages/core/src/services/context-hydrator.ts
extracted-kb/test-cases/README.md
V3 standard it supports:
Context_Hydration_And_Environment_Resolution
Canonicalization_And_Deterministic_Serialization
Conformance hook: Given fixture fixture TBD at extraction/v3/fixtures/config/precedence-chain.service.yml, assert ConfigBuilder.buildSync() merges layers in the documented order and ${env:KEY:default} resolves using an injected environment map (legacy implementation consults process.env): value present → use it; else default present → use it; else token remains.
KL-008 — PolicyPackDrivenCompliance
Class: kernel
Summary: Compliance rules load from framework packs with explicit precedence and restrictions; higher-assurance frameworks must reject runtime override escape hatches.
Evidence:
packages/core/src/platform/contracts/compliance/rules.ts
packages/core/src/platform/contracts/unified-binder-strategy-base.ts
config/commercial.yml
config/fedramp-moderate.yml
config/fedramp-high.yml
packages/core/src/platform/contracts/compliance/__tests__/rules.test.ts
packages/core/src/platform/contracts/__tests__/unified-binder-strategy-base.test.ts
V3 standard it supports:
Framework_Selection_And_Precedence
Rule_Catalog_Loading_And_Resolution
Override_And_Escape_Hatch_Restrictions
Compliance_Status_Block_Contract
Conformance hook: Given fixture packages/core/src/platform/contracts/compliance/__tests__/rules.test.ts (case RulesOverride__RejectedInFedrampHigh), assert loadComplianceRules('fedramp-high', _, rulesOverride) throws with a message that names the framework restriction; and given fixture packages/core/src/platform/contracts/__tests__/unified-binder-strategy-base.test.ts (cases UnifiedBase__ComplianceOverride__RejectedInFedrampHigh|Moderate), assert a ComplianceError is thrown with violations[0].ruleId === 'complianceOverrideRestriction'.
KL-009 — DirectiveValidationAndImmutability
Class: kernel
Summary: Directive options are capability-schema validated; env keys are allow-listed and sensitive vars are blocked; validated directives are deep-frozen to prevent post-validation tampering.
Evidence:
packages/core/src/platform/contracts/directive-schema-validator.ts
packages/core/src/platform/contracts/__tests__/directive-schema-validator.test.ts
packages/core/src/services/binding-directive-validator.ts
V3 standard it supports:
Schema_Validation_And_Schema_Composition
Error_Report_Schema_And_Actionable_Messages
Conformance hook: Given fixture packages/core/src/platform/contracts/__tests__/directive-schema-validator.test.ts (case DirectiveValidation__SensitiveEnvVars__Blocked), assert DirectiveSchemaValidator.validate() throws DirectiveValidationError with errors[] entries pointing at the blocked env var key; and given DirectiveValidation__DeepFreeze__PreventsTampering, assert attempts to mutate validated directive throw.
KL-010 — GovernanceExceptionsAndPatchesAreRegistered
Class: pipeline
Summary: Governance suppressions and escape-hatch patches must be explicitly registered with required fields (owner/justification/expiry) and strict date/length validation to make risk visible and time-bounded.
Evidence:
packages/core/src/services/reference-validator.ts
packages/core/src/services/pipeline.ts
packages/core/src/services/service-manifest.schema.json
V3 standard it supports:
Exception_Record_Schema
Patch_Registration_Schema
Justification_Minimums
Ownership_And_Expiry
Conformance hook: Given fixture fixture TBD at extraction/v3/fixtures/manifests/patch-registration-invalid.service.yml, assert validation fails when extensions.patches[] is missing owner or expiresOn, or when justification.length < 20 (as per schema), and that errors include a stable JSON path to the failing field.
KL-011 — ArtifactEnvelopeIsStable
Class: pipeline
Summary: Plan/deploy/migrate artifacts use a strict, machine-readable envelope (version/timestamp/command/env/service/framework) with predictable per-concern fan-out for CI consumption.
Evidence:
packages/core/src/platform/contracts/artifacts.ts
packages/core/src/platform/services/artifact-writer.ts
apps/svc/src/cli/__tests__/plan-command.test.ts
V3 standard it supports:
Artifact_Envelope_And_Versioning
Deterministic_File_Layout
Exit_Codes_And_Machine_Output
Conformance hook:
Given fixture fixture TBD at extraction/v3/fixtures/cli/plan-json-output.sample.json, assert shinobi plan --json output includes resolvedManifest, warnings, and structuredData (CLI output contract).
Given fixture fixture TBD at extraction/v3/fixtures/artifacts/plan-artifact.sample.json, assert the on-disk artifact validates against the PlanArtifact envelope shape (version, timestamp, command, environment, serviceName, complianceFramework, components, summary, validation, compliance) and the writer fan-out is stable.
KL-012 — TaggingAndDataClassification
Class: pipeline
Summary: Tags and data classification are enforced mechanically (required tags, framework-specific tags, valid classification values) to support governance and audit evidence.
Evidence:
packages/core/src/platform/services/tagging-enforcement.ts
packages/core/src/platform/services/compliance-plan-generator.ts
.cursor/rules/40-tagging-compliance.mdc
V3 standard it supports:
Provenance_And_Traceability
Governance_Metadata_Derivation
Conformance hook: Given fixture TBD at extraction/v3/fixtures/tagging/tagging-config.sample.json, assert TaggingEnforcementService.validateTags() returns valid:false with an error when DataClassification is missing for component types whose control mapping requires it, and rejects invalid classification values outside public|internal|confidential|pii.
Rejected candidates (max 5)
KL-004 DerivedIntentBoundary: excluded for now due to insufficient backend-neutral enforcement evidence (currently contract-level intent only; active implementation surfaces provider-native types at the boundary, so the “adapter-only” enforcement point is not established).
CloudFormation template diff as determinism oracle: excluded because correctness depends on Resources/Outputs template shape and backend-specific drift semantics (apps/svc/src/cli/utils/template-diff.ts).
CDK-nag as security oracle: excluded because correctness is defined by CDK-nag rule execution on a construct tree (packages/components/**/tests/security/cdk-nag.test.ts).
CDK construct-tree synthesis integration tests: excluded because the oracle is CDK/CFN shape (e.g., packages/core/src/services/tests/manifest-synthesis-integration.test.ts).