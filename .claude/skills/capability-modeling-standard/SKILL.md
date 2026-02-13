# Skill: Capability Modeling Standard

## Intent
- Define and evolve **capabilities** as stable, versioned contracts that form the primary typed interface between **components** and **binders**.
- Prevent ambiguity and binder mismatch by ensuring capability identifiers and capability-data contracts are explicit and governed.

## Scope boundaries
- **In-scope**: capability vocabulary governance, contract definition, compatibility reasoning, and evolution rules.
- **Out-of-scope**: implementing binders, building provider resources, and embedding backend-specific handles.

## Primary concepts
- **Capability identifier**: stable capability key (category/type) that can be referenced by directives and binders.
- **Capability data contract**: structured data shape associated with a capability (inputs/outputs/facts a binder can rely on).
- **Provides/Requires**: components provide capabilities; edges and binders require capabilities.
- **Compatibility matrix**: machine-checkable mapping of valid interactions across component types and capabilities.

## Required inputs/context
- **Current capability registry** (versioned) and any deprecation policy.
- **Binder compatibility matrix** expectations (triad/matrix conformance constraints).
- **Active policy pack identifier(s)** (explicitly provided; never inferred).
- **Golden cases**: known capability instances and expected binding outcomes.
- **Governance constraints**: forbidden patterns (e.g., ad-hoc custom capability drift without registry governance).

## Expected outputs
- **Structured outputs** (minimum):
  - **Capability definition delta**: added/changed/deprecated capability identifiers.
  - **Capability data contract delta**: required/optional fields and compatibility notes (described, not fully schematized).
  - **Compatibility impact summary**: which binders/components are impacted by the change.
- **Human-readable outputs**:
  - Rationale for the capability boundaries (what it represents, what it explicitly does not represent).

## Acceptance criteria
- **Stability**: capability identifiers are stable; changes are versioned with compatibility intent.
- **Clarity**: no ambiguous “overloaded” capability meaning; contract is specific enough for binder determinism.
- **Portability**: no backend-specific handles are embedded in the capability contract.
- **Conformance-first**: changes do not silently break binder matrix conformance.

## Validation signals
- **Binder matrix mismatch** is treated as a hard failure (deny) unless accompanied by explicit contract evolution and conformance updates.
- **Schema/contract validation** rejects unknown or incompatible fields in structured outputs.
- **Policy outcome stability**: policy decisions based on capability facts remain stable under deterministic compilation.

## Guardrails & forbidden behaviors
- **Forbidden**: capability definitions that imply a specific backend implementation (e.g., “this is a CDK construct”).
- **Forbidden**: introducing “custom capability escape hatches” without governance, versioning, and conformance strategy.
- **Forbidden**: capability contracts that require side effects (network calls, runtime discovery) to be meaningful.
- **Escalation (HITL required)**:
  - Any removal/rename that breaks backward compatibility.
  - Any change that widens implied permissions or network posture by default.

## Used by roles
- Component Authoring
- Binder Engineer
- Contract & Schema Steward

