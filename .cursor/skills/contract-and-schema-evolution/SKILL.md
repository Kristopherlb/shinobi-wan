# Skill: Contract & Schema Evolution (Versioned Interfaces)

## Intent
- Enable an agent to evolve the platform’s versioned interfaces safely: graph/IR contracts, capability data contracts, policy rule identifiers, and agent tool I/O contracts.
- Prevent breaking changes and uncontrolled drift while keeping the kernel adaptable.

## Scope boundaries
- **In-scope**: versioning strategy, compatibility rules, deprecation discipline, migration intent definition, and conformance alignment.
- **Out-of-scope**: implementing migrations; writing schemas/policies; backend-specific adapter evolution.

## Primary concepts
- **Contract**: a stable interface boundary that agents and tools depend on.
- **Compatibility**: forward/backward compatibility intent and what constitutes a breaking change.
- **Deprecation**: time-bounded process to retire fields/identifiers safely.

## Required inputs/context
- **Current contract index**: list of contracts (graph vocabulary, capability contracts, policy rule IDs, tool outputs) with versions.
- **Change log discipline**: required “what changed / why / impact” notes (conceptual).
- **Conformance baselines**: golden cases and triad matrix expectations that must remain stable or be intentionally updated.
- **Governance constraints**: what kinds of changes require HITL review (e.g., weakening security posture).

## Expected outputs
- **Structured outputs** (minimum):
  - **Change classification**: additive / compatible / breaking with rationale.
  - **Compatibility notes**: what old consumers can expect and what must be updated.
  - **Conformance impact summary**: which golden cases/role outputs need updates.
- **Human-readable outputs**:
  - Clear release notes oriented around invariants: determinism, portability, auditability.

## Acceptance criteria
- **Predictable evolution**: no silent breaking changes; compatibility intent is explicit.
- **Conformance-aligned**: changes either preserve conformance outcomes or include explicit, reviewed updates to expected outcomes.
- **Stable identifiers**: rule IDs/capability IDs are governed; renames/removals are managed via deprecation.

## Validation signals
- **Contract tests** (conceptual) detect unknown fields, missing required fields, and breaking identifier changes (deny).
- **Golden case drift** without explicit, reviewed updates is a deny signal.
- **Tool output incompatibility** (structured outputs no longer match expected shapes) is a deny signal.

## Guardrails & forbidden behaviors
- **Forbidden**: redefining the meaning of an existing identifier without versioning/deprecation.
- **Forbidden**: introducing “temporary” fields that become permanent without governance.
- **Escalation (HITL required)**:
  - Any breaking change to core graph vocabulary, stable IDs, or policy enforcement semantics.

## Used by roles
- Kernel / Graph Engineer
- Component Authoring
- Binder Engineer
- Policy Pack Authoring
- Test & Conformance
- Contract & Schema Steward

