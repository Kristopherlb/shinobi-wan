# Skill: Determinism Engineering

## Intent
- Enable an agent to identify and eliminate sources of nondeterminism so that **identical inputs** produce **identical graph, intents, policy outcomes, and plan artifacts**.
- Make determinism a mechanically enforced property (not a convention).

## Scope boundaries
- **In-scope**: stable IDs, canonical ordering, canonical serialization expectations, deterministic evaluation phase rules, and determinism threat modeling.
- **Out-of-scope**: performance optimization beyond what’s needed for determinism; backend-specific diffing behavior.

## Primary concepts
- **Stable identifiers**: deterministic IDs for nodes/edges and derived artifacts.
- **Canonical ordering**: deterministic ordering rules for sets/maps/lists and traversal/phase execution.
- **Canonical serialization**: stable encoding of graph/artifacts for diffing and caching.
- **Determinism hazards**: time, randomness, iteration order, locale differences, external I/O, environment variability.

## Required inputs/context
- **Determinism specification**: canonical ordering rules, stable ID rules, and canonical serialization expectations (versioned).
- **Evaluation phase model**: what phases exist conceptually (graph enrichment, binding, policy evaluation, artifact emission) and their ordering constraints.
- **Golden cases**: representative graphs + expected stable outputs.
- **Environment invariants**: what must be pinned/provided (e.g., pack selection, environment name) and what must not influence outputs.

## Expected outputs
- **Structured outputs** (minimum):
  - **Determinism risk inventory**: identified nondeterminism hazards with scope and impact classification.
  - **Canonicalization requirements**: explicit ordering/ID rules relied on or strengthened.
  - **Reproducibility statement**: what inputs define the output (and what inputs must not).
- **Human-readable outputs**:
  - Explanation of why determinism hazards matter and how the acceptance criteria are satisfied (tied to provenance).

## Acceptance criteria
- **Replayable**: the same inputs can reproduce outputs without relying on external state or time.
- **Stable diffs**: output changes reflect semantic changes, not incidental ordering or representation churn.
- **No side effects**: evaluation does not perform network calls, shell execution, or implicit discovery that changes results.

## Validation signals
- **Snapshot stability**: byte-for-byte stable outputs for identical inputs (deny if violated).
- **Property tests**: repeated runs (and reordered inputs) produce identical results (deny if violated).
- **Nondeterminism lint**: detection of external I/O/time/randomness usage in determinism-critical paths (deny if violated).

## Guardrails & forbidden behaviors
- **Forbidden**: “fixing” nondeterminism by loosening tests or ignoring reorder-only diffs.
- **Forbidden**: introducing hidden input channels (environment variables, host metadata) that affect outcomes without being declared.
- **Escalation (HITL required)**:
  - Any change to stable ID rules, canonical ordering, or canonical serialization semantics.

## Used by roles
- Kernel / Graph Engineer
- Binder Engineer
- Test & Conformance

