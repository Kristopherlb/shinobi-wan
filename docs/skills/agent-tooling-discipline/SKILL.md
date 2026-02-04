# Skill: Agent Tooling Discipline (Structured Outputs Only)

## Intent
- Enable an agent to produce **machine-checkable outputs** (structured, versioned, rejectable) alongside concise human-readable summaries.
- Ensure agents can be safely automated: outputs are deterministic, validated, and compatible with conformance gates.

## Scope boundaries
- **In-scope**: structured output discipline, error/diagnostic contracts, validation and rejection conditions, and replayability expectations.
- **Out-of-scope**: implementation of agent tools/CLI; output formatting and UI details.

## Primary concepts
- **Structured output**: well-defined fields and identifiers that validators can accept/reject deterministically.
- **Rejectability**: ability to fail fast on unknown fields, incompatible versions, missing provenance, or nondeterminism.
- **Replayability**: same declared inputs produce same structured outputs.

## Required inputs/context
- **Tool contract index**: what structured outputs are expected per operation (validate/plan/explain/audit) and their versions.
- **Error taxonomy**: categories/codes with remediation guidance expectations (conceptual).
- **Determinism & provenance requirements**: what must be included for traceability and audit.
- **Golden structured outputs**: representative examples used as oracles for validators.

## Expected outputs
- **Structured outputs** (minimum):
  - **Operation result envelope**: operation identifier, input contract versions referenced, output contract version produced.
  - **Diagnostics**: errors/warnings with category/code, stable location references, and remediation hints.
  - **Provenance hooks**: stable references that allow explain/provenance tracing.
- **Human-readable outputs**:
  - Concise summary of what was validated/emitted/denied and why, consistent with structured diagnostics.

## Acceptance criteria
- **Machine-checkable**: outputs can be validated without ambiguity.
- **Deterministic**: stable ordering and stable identifiers for repeated runs.
- **Strict**: unknown fields or incompatible versions are rejected (especially for regulated workflows).
- **Consistent**: human-readable summaries do not contradict structured outputs.

## Validation signals
- **Schema/contract validation** rejects unknown fields, missing required fields, and incompatible versions (deny).
- **Determinism checks** fail if ordering/serialization changes without semantic change (deny).
- **Explain/provenance checks** fail if required provenance anchors are missing (deny).

## Guardrails & forbidden behaviors
- **Forbidden**: free-form outputs that cannot be validated or deterministically parsed.
- **Forbidden**: hiding important decisions only in prose (must be in structured outputs).
- **Forbidden**: “best-effort” acceptance of unknown fields (must reject).
- **Escalation (HITL required)**:
  - Any weakening of validation strictness for high-assurance workflows.

## Used by roles
- All roles (cross-cutting requirement)

