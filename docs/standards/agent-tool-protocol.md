# Standard 10 — Agent Tool Protocol (JSON)

**Name**: Agent Tool Protocol Standard (JSON)
**Scope**: Agent tool interaction protocol and safety.

## Normative Requirements

### Tool_Call_Envelope_Schema
Standard wrapper for all tool calls.

Required fields for Shinobi/Harmony integrations:

- `metadata.toolId`
- `metadata.operationClass` (`read|plan|apply`)
- `metadata.traceId`
- `metadata.toolVersion`
- `metadata.contractVersion`
- `policy` block with timeout/retry/idempotency

Canonical source of truth for this contract: `packages/cli/src/integration/contract.ts`.

### Correlation_Trace_Causation_Model
Tracking chains of agent actions.

### Idempotency_And_Retry_Semantics
Safe retry rules.

- Mutating tools (`operationClass=apply`) default to async `start`.
- Mutating side effects are not auto-retried unless idempotency key and operation fingerprint are present.
- `retriableReason` is required when `retriable=true`.

### Capability_Manifest_Schema_And_Versioning
Defining agent capabilities.

### Risk_Tiers_And_Ownership_Metadata
Risk classification for tools.

### Tool_Schema_Validation_And_Unknown_Field_Policy
Strict validation of tool inputs.

### Audit_Record_Emission_And_Immutability
Recording tool usage for audit.

### Structured_Error_Schema
Standard error types.

Shinobi/Harmony error envelope fields:

- `code`
- `category`
- `retriable`
- `retriableReason` (required when retriable)
- `source`
- `traceId`
- `message`

### Contract_Tests_For_Tool_Schemas
Tests for tool contracts.

- Golden compatibility tests are required for every release that changes envelope schema or enums.

## Validation
- JSON Schema validation.
- Audit record validation.
- Contract tests for deterministic envelope shape and tool mapping.
