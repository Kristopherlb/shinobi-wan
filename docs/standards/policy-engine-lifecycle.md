# Standard 4 — Policy Engine Lifecycle

**Name**: Policy Engine Lifecycle & Policy-Pack Loading Standard
**Scope**: Policy pack selection, loading, evaluation, and reporting.

## Normative Requirements

### Policy_Pack_Format_And_Versioning
Structure of policy packs (YAML/JSON) and versioning.

### Framework_Selection_And_Precedence
How the active framework (e.g., FedRAMP) is selected.

### Rule_Catalog_Loading_And_Resolution
Process for loading rules from the catalog.

### Evaluation_Phases_And_When_Policy_Runs
Policy evaluation occurs at graph-time and plan-time.

### Violation_Model_And_Severity_Tiers
Standard violation levels (Info, Warning, Error, Critical).

### Compliance_Status_Block_Contract
Mandatory compliance metadata in plan outputs.

### Override_And_Escape_Hatch_Restrictions
Rules for when overrides are permitted.

### Audit_And_Explainability_Requirements
All decisions must be auditable.

## Validation
- Central wrapper enforcing compliance blocks.
- Rule loading precedence checks.
- CI gates for conformance.
