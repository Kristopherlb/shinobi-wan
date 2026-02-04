# Skill: Provenance & Traceability

## Intent
- Enable an agent to ensure every derived fact, intent, and decision has **traceable provenance** back to explicit inputs and governed defaults.
- Support auditability, explainability, safe refactoring, and evidence generation without relying on backend-specific artifacts.

## Scope boundaries
- **In-scope**: provenance requirements definition, provenance propagation rules, and traceability expectations across graph → intents → policy outcomes → plan artifacts.
- **Out-of-scope**: specific storage/backing systems for provenance data; implementation of provenance capture mechanisms.

## Primary concepts
- **Provenance**: where a value/decision came from (explicit input, policy pack default, environment override, derived from binder rule).
- **Traceability**: ability to follow provenance across transformations and decisions.
- **Evidence pointers**: stable references that can be used to support audit claims (conceptual only).

## Required inputs/context
- **Provenance contract**: minimum required provenance fields and propagation expectations (versioned).
- **Configuration precedence rules**: what sources are allowed to override what (conceptual chain).
- **Active policy pack identifier(s)** and environment context (explicit inputs).
- **Golden trace cases**: representative scenarios showing provenance across config resolution, binder derivation, and policy evaluation.

## Expected outputs
- **Structured outputs** (minimum):
  - **Provenance map**: for any emitted artifact/decision, record its provenance categories and stable references (no full schema).
  - **Propagation notes**: how provenance flows across derived artifacts (what must be preserved, what must be summarized).
  - **Audit trace anchors**: stable identifiers that can be referenced by tests and evidence systems.
- **Human-readable outputs**:
  - “Where did this come from?” explanation for key outputs and policy decisions, consistent with the provenance map.

## Acceptance criteria
- **Completeness**: required outputs and decisions include provenance (no “unknown origin” in regulated contexts).
- **Determinism**: provenance ordering and representation are stable (no incidental churn).
- **Non-leaky**: provenance does not require backend-native resources to resolve meaning.

## Validation signals
- **Missing provenance** for mandatory fields is a deny signal.
- **Conflicting provenance** (multiple origins without explicit precedence resolution) is a deny signal.
- **Evidence pointer integrity**: required evidence anchors must be present and stable across runs.

## Guardrails & forbidden behaviors
- **Forbidden**: implicit defaults without provenance category and justification.
- **Forbidden**: provenance that depends on environment discovery (hostnames, live cloud queries) rather than declared inputs.
- **Escalation (HITL required)**:
  - Any change that weakens provenance requirements for security/compliance outcomes.

## Used by roles
- Kernel / Graph Engineer
- Component Authoring
- Binder Engineer
- Policy Pack Authoring
- Test & Conformance
- Contract & Schema Steward

