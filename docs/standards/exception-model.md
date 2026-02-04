# Standard 5 — Exception / Suppression Model

**Name**: Exception & Suppression (Governance) Standard
**Scope**: First-class exception records for bounded deviations.

## Normative Requirements

### Exception_Record_Schema
Schema for exception records (ID, justification, etc.).

### Scope_And_Targeting_Model
How exceptions target specific rules or resources.

### Justification_And_Ownership
Mandatory ownership and business justification.

### Expiry_TTL_And_Renewal
Exceptions must expire and require renewal.

### Approval_Workflow_Hooks
Hooks for external approval systems.

### Reporting_And_Audit_Trail
All exceptions must be reported in audits.

### Enforcement_Of_Required_Fields
Strict validation of exception fields.

### Mapping_From_Legacy_Suppressions
Strategy for importing legacy suppressions.

## Validation
- Manifest validation (AJV).
- CI/audit checks for expiry.
