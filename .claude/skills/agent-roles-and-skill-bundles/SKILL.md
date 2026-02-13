# Agent Roles and Skill Bundles

This document defines **agent roles** as bundles of skills required to build the platform's **in-memory object graph kernel** that compiles to **infrastructure code**, with **policy/config-driven** compliance.

## Shared inputs (all roles must receive)
- **Contract references (versioned)**: graph vocabulary, capability identifiers, rule identifiers, and structured output expectations.
- **Determinism spec**: stable IDs, canonical ordering, canonical serialization expectations.
- **Active policy pack identifier(s)** and environment context (explicit inputs; never inferred).
- **Golden cases**: canonical graph + expected plan/intents/policy outcomes for representative services.
- **Prior decisions**: boundary rules (kernel vs adapter; intent vs lowering; exception model constraints).

## Shared output expectations (all roles)
- **Structured**: outputs must be machine-checkable, version-referenced, and rejectable.
- **Human-readable**: concise, provenance-backed explanation of “what changed” and “why”.

## Global guardrails (apply to all roles)
- **No backend handles** in kernel graph/IR or derived intent artifacts (no provider-native objects; adapters only).
- **No hardcoded compliance pack branching** inside component/binder behavior (pack selection is an external input).
- **Determinism is mandatory**: stable IDs, canonical ordering, canonical serialization, idempotent mutations.
- **Explainability + provenance** are mandatory for regulated outcomes.
- **Conformance-first**: triad matrix expectations are primary validation signals.

---

## R1. Kernel / Graph Engineer Agent

### Primary responsibilities
- Define and preserve the kernel’s **graph semantics**, invariants, determinism rules, and adapter boundaries.

### Bundled skills
- [Graph Reasoning & Mutation](skills/graph-reasoning-and-mutation.md)
- [Determinism Engineering](skills/determinism-engineering.md)
- [Explainability Generation](skills/explainability-generation.md)
- [Provenance & Traceability](skills/provenance-and-traceability.md)
- [Contract & Schema Evolution](skills/contract-and-schema-evolution.md)
- [Refactoring with Invariants Preserved](skills/refactoring-with-invariants.md)
- [Agent Tooling Discipline](skills/agent-tooling-discipline-structured-outputs.md)

### Required inputs/context (role-specific)
- Stable ID and canonicalization policies (explicit).
- Phase ordering constraints and “what is allowed to be derived when” rules (conceptual).

### Expected outputs
- **Structured**: invariant deltas, determinism/canonicalization statements, contract evolution notes, rejection conditions.
- **Human-readable**: “why this invariant exists” and “why this boundary is necessary” narratives.

### Acceptance criteria & validation signals
- Identical inputs produce identical graph + derived artifacts.
- Golden cases exhibit no reorder-only churn; semantic diffs are intentional and reviewed.

### Guardrails & forbidden behaviors
- Forbidden: weakening determinism invariants for convenience.
- Forbidden: shifting provider responsibility into kernel semantics.
- HITL required: changes to stable IDs, canonical ordering, canonical serialization, or policy evaluation boundaries.

---

## R2. Component Authoring Agent

### Primary responsibilities
- Define components’ **capabilities**, config surfaces, and emitted facts/intents without backend coupling.

### Bundled skills
- [Capability Modeling](skills/capability-modeling-contracts.md)
- [Explainability Generation](skills/explainability-generation.md)
- [Provenance & Traceability](skills/provenance-and-traceability.md)
- [Contract & Schema Evolution](skills/contract-and-schema-evolution.md)
- [Refactoring with Invariants Preserved](skills/refactoring-with-invariants.md)
- [Agent Tooling Discipline](skills/agent-tooling-discipline-structured-outputs.md)

### Required inputs/context (role-specific)
- Capability registry governance constraints (what may be introduced and how).
- Policy pack expectations for what facts/intents policies rely on (conceptual).

### Expected outputs
- **Structured**: capability publication deltas, config/provenance expectations, impacted binder compatibility notes.
- **Human-readable**: rationale for capability boundaries and config meaning.

### Acceptance criteria & validation signals
- No backend handles in component outputs.
- No embedded compliance pack branching required by component behavior.

### Guardrails & forbidden behaviors
- Forbidden: ad-hoc capability escape hatches without governance/versioning.
- Forbidden: relying on runtime discovery or side effects to define capability facts.

---

## R3. Binder Engineer Agent

### Primary responsibilities
- Design binder behavior that compiles edges into **deterministic, backend-neutral intent bundles**.

### Bundled skills
- [Capability Modeling](skills/capability-modeling-contracts.md)
- [Binder Logic Synthesis](skills/binder-logic-synthesis.md)
- [Determinism Engineering](skills/determinism-engineering.md)
- [Explainability Generation](skills/explainability-generation.md)
- [Provenance & Traceability](skills/provenance-and-traceability.md)
- [Security Intent Modeling](skills/security-intent-modeling.md)
- [Conformance Test Design](skills/conformance-test-design.md)
- [Refactoring with Invariants Preserved](skills/refactoring-with-invariants.md)
- [Agent Tooling Discipline](skills/agent-tooling-discipline-structured-outputs.md)

### Required inputs/context (role-specific)
- Edge directive semantics (access level/operation class) and compatibility expectations.
- Least-privilege baseline and policy enforcement expectations (pack-driven).

### Expected outputs
- **Structured**: intent bundles + violations + compatibility declarations (conceptual shapes).
- **Human-readable**: binder “recipe” explanation: inputs → outputs → constraints.

### Acceptance criteria & validation signals
- Least privilege by default; network widening/overbroad permissions are denied unless explicitly allowed.
- Binder matrix and triad matrix stability for touched interactions.

### Guardrails & forbidden behaviors
- Forbidden: provider lowering inside binders.
- Forbidden: pack branching embedded in binder behavior.
- HITL required: changes that widen default permissions or network posture.

---

## R4. Policy Pack Authoring Agent

### Primary responsibilities
- Author compliance as **policy packs** that evaluate graph facts/intents and produce stable outcomes with evidence/provenance.

### Bundled skills
- [Policy Pack Authoring](skills/policy-pack-authoring.md)
- [Explainability Generation](skills/explainability-generation.md)
- [Provenance & Traceability](skills/provenance-and-traceability.md)
- [Contract & Schema Evolution](skills/contract-and-schema-evolution.md)
- [Conformance Test Design](skills/conformance-test-design.md)
- [Agent Tooling Discipline](skills/agent-tooling-discipline-structured-outputs.md)

### Required inputs/context (role-specific)
- Rule catalog index and enforcement tier definitions (explicit).
- Exception/suppression constraints and governance requirements (conceptual).

### Expected outputs
- **Structured**: rule intent definitions, enforcement mapping, exception constraints, evidence expectations.
- **Human-readable**: rationale for rule severity and “what must be true” framing.

### Acceptance criteria & validation signals
- Policy changes do not require component/binder branching.
- Policy outcomes are deterministic and match golden compliance cases across triad matrix packs.

### Guardrails & forbidden behaviors
- Forbidden: rules that encode implementation-specific requirements.
- Forbidden: nondeterministic rule inputs (time/external calls).
- HITL required: weakening enforcement in high-assurance packs or expanding suppressions.

---

## R5. Test & Conformance Agent

### Primary responsibilities
- Define conformance gates that enforce determinism, contract stability, binder matrix correctness, and policy outcome stability.

### Bundled skills
- [Determinism Engineering](skills/determinism-engineering.md)
- [Explainability Generation](skills/explainability-generation.md)
- [Provenance & Traceability](skills/provenance-and-traceability.md)
- [Contract & Schema Evolution](skills/contract-and-schema-evolution.md)
- [Conformance Test Design](skills/conformance-test-design.md)
- [Refactoring with Invariants Preserved](skills/refactoring-with-invariants.md)
- [Agent Tooling Discipline](skills/agent-tooling-discipline-structured-outputs.md)

### Required inputs/context (role-specific)
- Coverage expectations for triad matrix and binder compatibility expectations.
- Explicit deny conditions for nondeterminism and policy drift.

### Expected outputs
- **Structured**: conformance inventory, oracle definitions, failure classification rules.
- **Human-readable**: triage guidance focused on invariants (not test-loosening).

### Acceptance criteria & validation signals
- Nondeterminism and policy drift are mechanically detected and denied.
- Matrix gaps for touched subsystems are detected and denied where required.

### Guardrails & forbidden behaviors
- Forbidden: weakening tests to accommodate nondeterminism.
- Forbidden: using backend/provider artifacts as the oracle of correctness.

---

## R6. Contract & Schema Steward Agent

### Primary responsibilities
- Maintain the minimal, versioned index of system contracts and ensure structured outputs are consistent and validated.

### Bundled skills
- [Explainability Generation](skills/explainability-generation.md)
- [Provenance & Traceability](skills/provenance-and-traceability.md)
- [Contract & Schema Evolution](skills/contract-and-schema-evolution.md)
- [Agent Tooling Discipline](skills/agent-tooling-discipline-structured-outputs.md)

### Required inputs/context (role-specific)
- Contract inventory and deprecation policy (explicit).
- Change governance: what requires HITL.

### Expected outputs
- **Structured**: version/index updates, change classifications, compatibility notes, conformance impact summaries.
- **Human-readable**: “what changed / why / how to validate” summaries tied to invariants.

### Acceptance criteria & validation signals
- No silent breaking changes; compatibility intent is explicit.
- Structured outputs remain rejectable and deterministic across versions.

### Guardrails & forbidden behaviors
- Forbidden: redefining identifiers without versioning/deprecation.
- HITL required: breaking changes to core contract vocabularies or policy enforcement semantics.

