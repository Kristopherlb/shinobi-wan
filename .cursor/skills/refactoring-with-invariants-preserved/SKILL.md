# Skill: Refactoring with Invariants Preserved

## Intent
- Enable an agent to restructure systems while preserving semantic outputs: graph meaning, derived intents, policy outcomes, and plan artifacts.
- Make refactoring safe under strict determinism, provenance, and conformance constraints.

## Scope boundaries
- **In-scope**: invariant identification, semantic equivalence reasoning, regression-risk assessment, and conformance-aligned change framing.
- **Out-of-scope**: “cleanup” that changes semantics without explicit intent and review; performance rewrites that weaken determinism.

## Primary concepts
- **Invariant**: property that must remain true (stable IDs, canonical ordering, least privilege, policy-driven compliance).
- **Semantic equivalence**: unchanged meaning of outputs even if internal structure changes.
- **Regression surface**: which contracts and golden cases could drift due to refactoring.

## Required inputs/context
- **Invariant catalog**: the non-negotiable properties for the touched subsystems (versioned references).
- **Golden cases + conformance baselines**: expected outputs to preserve.
- **Provenance/explain expectations**: what must remain explainable and traceable after refactor.
- **Change boundaries**: what is allowed to change (structure) vs forbidden to change (semantics).

## Expected outputs
- **Structured outputs** (minimum):
  - **Refactor intent statement**: what is being reorganized and what semantics must remain unchanged.
  - **Invariant checklist**: invariants asserted to be preserved, and any new invariants introduced (none weakened).
  - **Conformance impact report**: which golden cases/matrix areas might be impacted.
- **Human-readable outputs**:
  - A concise “why this refactor exists” narrative tied to maintainability/clarity without semantic drift.

## Acceptance criteria
- **No semantic drift**: conformance suite outcomes remain unchanged unless explicitly intended and reviewed.
- **Deterministic stability**: stable ordering/IDs/serialization remain unchanged.
- **Explainability preserved**: provenance chains remain intact; no loss of traceability.

## Validation signals
- **Golden output stability**: unchanged outputs across representative cases (deny on unexpected drift).
- **Policy outcome stability**: no unexplained changes in violations/actions.
- **Diff quality**: refactor changes do not introduce reorder-only churn (signals determinism risk).

## Guardrails & forbidden behaviors
- **Forbidden**: refactors that “simplify” by removing provenance or reducing auditability.
- **Forbidden**: refactors that widen default permissions/network posture.
- **Escalation (HITL required)**:
  - Any refactor that changes stable ID rules, canonical ordering, or policy enforcement semantics.

## Used by roles
- Kernel / Graph Engineer
- Binder Engineer
- Policy Pack Authoring
- Test & Conformance
- Contract & Schema Steward

