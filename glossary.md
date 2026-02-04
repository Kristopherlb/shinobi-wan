# Shinobi V3 — Glossary (Canonical Terms)

This glossary freezes **shared meanings** so skills/roles do not drift over time. Terms are defined **conceptually** (no implementation details).

## Graph
The in-memory object graph that represents the infrastructure system-of-record.
- **Node**: a typed object representing a component or platform concept.
- **Edge**: a typed relationship between nodes (e.g., binding, trigger, dependency).
- **Derived artifact**: any output computed from the graph (intents, constraints, policy outcomes, evidence pointers).

## Mutation
Any operation that changes graph state: adding/removing/updating nodes/edges, or recomputing derived artifacts.
- **Idempotent mutation**: applying the same mutation to the same input graph yields the same resulting graph.

## Capability
A stable, governed identifier that represents what a component **provides** or **requires**.
- **Capability contract**: the meaning and boundaries of a capability identifier.
- **Capability data contract**: the structured facts associated with a capability that other subsystems may rely on.

## Directive
Declarative input that requests or shapes relationships.
- **Binding directive**: declares an intended interaction between components via a capability.
- **Trigger directive**: declares an event-driven relationship or activation mechanism.

## Binder
A deterministic “edge compiler” that maps an edge + context into derived outputs.
- **Binder compatibility**: a declaration of which source/target/capability combinations are valid.
- **Binder recipe**: a stable explanation of inputs → outputs → constraints.

## Intent
A backend-neutral representation of a desired effect that can be validated and later lowered by adapters.
Common intent categories (non-exhaustive):
- **Runtime configuration intent**: what configuration must be made available to a workload (without specifying mechanism).
- **Security intent**: permission and network posture requirements expressed without provider constructs.
- **Telemetry intent**: observability expectations expressed without backend coupling.

## Fact
A machine-checkable statement about the graph or derived artifacts (e.g., “this edge requires write access”, “this output needs encryption”).
- Facts must be **stable**, **deterministic**, and **sufficiently precise** to support policy evaluation.

## Constraint
A requirement that must hold for the system to be valid (e.g., least privilege, encryption required).
- Constraints may be emitted by binders/components and evaluated by policies.

## Policy pack
A named set of rules and defaults selected externally (input), used to evaluate the graph and derived artifacts.
- **Rule**: a deterministic predicate over facts/intents that yields an outcome.
- **Enforcement tier**: how outcomes affect acceptance (warn/error/deny), defined by policy/config.

## Violation
A machine-readable record that a rule/constraint was not satisfied.
- Must include stable identifiers (rule/constraint ID), severity, and remediation-oriented messaging.

## Exception (suppression)
A policy-driven mechanism to allow deviation from a rule/constraint under explicit governance.
- Must be explicit, bounded, and auditable (e.g., owner, justification, TTL) at a conceptual level.

## Determinism
The property that identical declared inputs produce identical outputs.
- **Stable IDs**: deterministic identifiers for nodes/edges/derived artifacts.
- **Canonical ordering**: deterministic ordering of collections/traversals.
- **Canonical serialization**: deterministic representation suitable for diffing and caching.

## Provenance
Traceable origin information explaining where a value or decision came from (explicit input, policy default, derived rule).
- Provenance is required for regulated outcomes and for explainability.

## Explainability
The ability to answer “why” and “how” in a way that is consistent with provenance and structured outputs.
- An explanation must be stable under identical inputs and must not invent reasons.

## Conformance (triad matrix)
Mechanically enforced correctness across the composition axes:
\(component × binder × policy\_pack\).
- Conformance is demonstrated via golden cases and invariant checks, not convention.

## Backend boundary (adapter boundary)
The strict separation between:
- **Kernel/binders/policies**: backend-neutral graph, intents, and decisions.
- **Adapters**: backend/provider lowering of intents into deployable artifacts.

