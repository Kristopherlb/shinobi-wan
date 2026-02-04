# Skill: Explainability Generation (Why/How Outputs)

## Intent
- Enable an agent to produce **verifiable explanations** for graph structure, derived intents, and policy decisions.
- Build operator and auditor trust: “what happened” must be paired with “why it happened” and “where it came from.”

## Scope boundaries
- **In-scope**: explanation contracts, reason chains, decision summaries, and mapping to provenance/evidence pointers.
- **Out-of-scope**: UI/UX presentation design; backend-specific plan formatting.

## Primary concepts
- **Reason chain**: a traceable path from inputs → graph facts → binder outputs → policy outcomes → emitted artifacts.
- **Explain output**: a stable, structured representation of the reason chain plus a human-readable summary.
- **Deterministic explanation**: explanations must be stable under identical inputs (no reordering-only churn).

## Required inputs/context
- **Provenance model expectations**: what must be tracked at minimum (config sources, policy rule IDs, binder compatibility declarations).
- **Graph + plan artifacts** (or stable references): the subject to explain.
- **Active policy pack identifier(s)** and environment (explicit inputs).
- **Golden explain cases**: representative scenarios with expected explanation structure and content boundaries.

## Expected outputs
- **Structured outputs** (minimum):
  - **Explain envelope**: subject (node/edge/artifact), decision summary, and reason chain references.
  - **Policy decision trace**: rule identifiers involved and outcomes (allow/violate/action), with evidence pointers.
  - **Binder derivation trace**: which capability contracts and directives produced which intents.
- **Human-readable outputs**:
  - Clear “why” narrative that is consistent with structured traces, without leaking backend implementation details.

## Acceptance criteria
- **Traceable**: every explanation ties back to provenance and identified contracts (capability IDs, rule IDs).
- **Deterministic**: explanation structure and ordering are stable for identical inputs.
- **Actionable**: failures include remediation-oriented explanation (what invariant was violated, what to change).
- **Non-leaky**: explanations do not depend on or expose backend-native handles.

## Validation signals
- **Missing provenance chain** is a deny signal for explain outputs.
- **Explain/plan mismatch** (explanation contradicts emitted artifacts) is a deny signal.
- **Instability** across repeated runs is a determinism failure (deny).

## Guardrails & forbidden behaviors
- **Forbidden**: inventing reasons not supported by provenance or contracts.
- **Forbidden**: explanations that require reading backend templates/program outputs to be meaningful.
- **Escalation (HITL required)**:
  - Any change that alters the meaning of explanation fields or removes traceability for regulated outputs.

## Used by roles
- Kernel / Graph Engineer
- Policy Pack Authoring
- Test & Conformance
- Contract & Schema Steward

