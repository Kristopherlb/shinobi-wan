# Skill: Graph Reasoning & Mutation

## Intent
- Enable an agent to **reason about** and **safely mutate** the in-memory infrastructure object graph (nodes, edges, and derived artifacts) that serves as the platform’s source of truth.
- Preserve **determinism**, **idempotence**, and **graph invariants** across all graph evolution.

## Scope boundaries
- **In-scope**: graph change design, mutation planning, invariant definition, change application semantics, and conflict resolution rules.
- **Out-of-scope**: provider lowering, infrastructure code generation details, and any backend-specific resource manipulation.

## Primary concepts
- **Graph**: nodes (components/constructs), edges (bindings/triggers/relationships), and derived artifacts (intents, constraints, evidence references).
- **Mutation**: any operation that changes graph state (add/remove/update nodes/edges; recompute derived artifacts).
- **Invariants**: rules that must always hold (e.g., stable IDs, canonical ordering, no backend handles in the kernel graph).

## Required inputs/context
- **Graph contract reference**: current node/edge vocabulary and required invariants (versioned).
- **Determinism rules**: stable ID requirements and canonical ordering/serialization expectations.
- **Active policy pack identifier(s)** and environment context (must be explicit; never inferred from runtime).
- **Golden cases**: canonical graph snapshots and expected plan artifacts for representative services.
- **Prior decisions**: boundary rules (kernel vs adapter, intent vs lowering, exception model boundaries).

## Expected outputs
- **Structured outputs** (minimum):
  - **Mutation summary**: what nodes/edges/derived artifacts are added/removed/changed.
  - **Invariant impact statement**: which invariants are relied on/changed/strengthened (and none weakened).
  - **Determinism proof notes**: how stable IDs and ordering remain stable under mutation.
- **Human-readable outputs**:
  - **Why** the mutation is needed and **why** it is safe (mapped to invariants and provenance).

## Acceptance criteria
- **Idempotent**: applying the same mutation to the same input graph yields the same resulting graph.
- **Deterministic**: identical inputs produce identical graph + derived artifacts (including ordering/serialization).
- **Invariant-preserving**: no mutation violates graph invariants; no backend handles leak into graph state.
- **Explainable**: every new/changed edge and derived artifact has a traceable reason chain.

## Validation signals
- **Canonical snapshot stability**: golden graph/plan artifacts are unchanged unless intentionally updated.
- **Conformance gates**: triad matrix outcomes do not drift unexpectedly.
- **Invalid mutation detection**: invariant violations are detected as hard failures (deny).
- **Ordering stability**: graph diff is stable (no reorder-only churn).

## Guardrails & forbidden behaviors
- **Forbidden**: hidden side effects during graph mutation (I/O, network calls, clock/time dependence, unordered iteration dependence).
- **Forbidden**: “fix by reordering” changes that mask nondeterminism instead of removing it.
- **Forbidden**: encoding compliance posture into graph mutation logic (no pack branching).
- **Escalation (HITL required)**:
  - Any change to stable ID rules, canonical ordering, or canonical serialization semantics.

## Used by roles
- Kernel / Graph Engineer
- Test & Conformance

