# Standard 8 — Observability & Audit Schema

**Name**: Observability (OTel) + Structured Logging + Audit Record Standard
**Scope**: Telemetry intents, logging, and audit records.

## Normative Requirements

### Telemetry_Descriptor_Schema
Schema for defining metrics and traces.

### OTel_Environment_Injection_Contract
How OTel context is injected.

### Tracing_Config_And_Propagation
Rules for trace propagation.

### Metrics_Alarms_Dashboards_Descriptors
Abstract descriptors for observability assets.

### Structured_Log_Event_Schema
JSON schema for logs.

### Correlation_TraceId_SpanId_Requirements
Mandatory correlation IDs.

For Harmony integration, every tool invocation must include:

- request `trace_id`,
- envelope `metadata.traceId`,
- downstream error `traceId`,
- async handle `traceId`.

### PII_Detection_And_Redaction
Rules for handling PII.

For wrapper/service integration:

- no secret material in logs,
- redact secret fields from envelopes and diagnostics,
- keep raw upstream error payloads in structured logs only.

### Audit_Required_Rules_By_Framework
Which events trigger mandatory audit logs.

Restricted operations (`operationClass=apply`) require audit evidence for:

- approval request and decision,
- plan fingerprint linked to apply request,
- final outcome and error class (if failed).

### Governance_Metadata_Derivation
Deriving governance data from context.

### Immutable_Audit_Record_Schema
Schema for immutable audit records.

## Validation
- Runtime libraries.
- Tool/audit record schema validation.
- SLO and error-budget alert wiring for read/plan/apply operation classes.
