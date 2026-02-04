# Skill: Policy Pack Authoring (Config-Driven Compliance)

## Intent
- Enable an agent to express compliance requirements as **policy packs** and **rules** that evaluate the graph and plan outputs deterministically.
- Ensure compliance is **policy/config-driven** and never hardcoded in components/binders.

## Scope boundaries
- **In-scope**: rule intent definition, severity/enforcement tier mapping, exception model constraints, and evidence/provenance requirements for compliance outcomes.
- **Out-of-scope**: encoding compliance logic as control flow in components/binders; backend-specific enforcement mechanisms.

## Primary concepts
- **Policy pack**: a named set of rules + defaults + enforcement tiers selected externally (input to evaluation).
- **Rule**: deterministic predicate over graph facts/intents with well-defined violation output.
- **Enforcement tier**: warn/error/deny behavior determined by policy/config.
- **Exception**: first-class policy-driven suppression with explicit ownership/justification/TTL semantics (conceptual).

## Required inputs/context
- **Active policy pack identifier(s)** (explicit input), environment, and any permitted override channels.
- **Rule catalog index**: current rule identifiers and intended semantics (versioned).
- **Graph facts contract**: what facts/intents binders and components are allowed to emit and policies are allowed to rely on.
- **Evidence/provenance expectations**: what outputs must be traceable and how decisions must be explainable.
- **Golden compliance cases**: representative graphs with expected policy outcomes across the triad matrix.

## Expected outputs
- **Structured outputs** (minimum):
  - **Rule definitions**: identifiers, scope, evaluation triggers (conceptual), severity, and violation shape requirements.
  - **Exception constraints**: what is suppressible, required fields, TTL/approval expectations (conceptual).
  - **Evidence mapping**: what evidence references must accompany outcomes (conceptual pointers).
- **Human-readable outputs**:
  - Rationale for each rule: why it exists, what risk it mitigates, and why severity/enforcement are chosen.

## Acceptance criteria
- **No code branching requirement**: no policy requirement forces components/binders to branch on pack name or framework.
- **Deterministic evaluation**: same graph + same pack inputs yield the same outcomes.
- **Auditable**: every violation/action includes traceable provenance and an explainable rationale.
- **Testable**: each rule has representative golden cases that demonstrate expected outcomes.

## Validation signals
- **Policy conformance tests**: outcomes match expected results across the triad matrix.
- **Pack-branching detection**: any hardcoded pack checks in component/binder logic is a deny signal.
- **Outcome stability**: “policy drift” across identical inputs is a deny signal.
- **Evidence completeness**: missing required evidence/provenance is a deny signal for high-assurance packs.

## Guardrails & forbidden behaviors
- **Forbidden**: rules that require implementation-specific artifacts or backend handles.
- **Forbidden**: rules that depend on nondeterministic inputs (current time, external calls, runtime discovery).
- **Forbidden**: using policy packs to encode “how to implement” rather than “what must be true” (avoid implementation coupling).
- **Escalation (HITL required)**:
  - Any change that weakens enforcement tiers in high-assurance packs.
  - Any change that materially alters exception semantics or expands suppressions.

## Used by roles
- Policy Pack Authoring
- Test & Conformance

