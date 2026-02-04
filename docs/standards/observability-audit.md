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

### PII_Detection_And_Redaction
Rules for handling PII.

### Audit_Required_Rules_By_Framework
Which events trigger mandatory audit logs.

### Governance_Metadata_Derivation
Deriving governance data from context.

### Immutable_Audit_Record_Schema
Schema for immutable audit records.

## Validation
- Runtime libraries.
- Tool/audit record schema validation.
