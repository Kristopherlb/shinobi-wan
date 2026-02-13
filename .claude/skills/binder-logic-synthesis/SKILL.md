# Skill: Binder Logic Synthesis (Edge → Derived Intents)

## Intent
- Enable an agent to design binder behavior that deterministically compiles **graph edges** into **backend-neutral intent artifacts** (runtime config injection, IAM intent, network intent, telemetry intents, and constraint facts).
- Maintain strict boundaries: **binders emit intent**; **adapters lower intent** into backend/provider resources.

## Scope boundaries
- **In-scope**: binder input/output contract reasoning, least-privilege intent modeling, deterministic shaping of derived artifacts, and compatibility reasoning across capabilities.
- **Out-of-scope**: provider-specific resource creation, infrastructure lowering details, and runtime “discovery” behaviors (network calls, dynamic querying).

## Primary concepts
- **Binding/trigger edge**: a declared relationship between components/capabilities.
- **Binder**: pure(ish) edge compiler that emits derived intents + facts + violations.
- **Derived intents**: backend-neutral representations of access, network posture, and runtime configuration effects.
- **Compatibility matrix**: machine-checkable contract describing which source/target/capability combinations are valid.

## Required inputs/context
- **Capability contracts** (identifiers + data contract boundaries) for both sides of the edge.
- **Edge directive context**: access level/operation class (e.g., read/write/invoke/publish/subscribe), selection semantics, and declared intent constraints.
- **Active policy pack identifier(s)** and environment context (explicit inputs).
- **Security posture constraints**: least-privilege rules and network posture baseline defined by policy/config.
- **Golden cases**: canonical binding examples and expected intent outputs for each compliance posture.

## Expected outputs
- **Structured outputs** (minimum):
  - **Intent bundle**: runtime configuration intent + IAM intent + network intent (and any additional derived intents), with canonical ordering rules.
  - **Violation set**: machine-readable violations with severity, remediation hint, and evidence pointers (conceptual).
  - **Compatibility declaration**: what capability interactions are supported (as a declaration, not a code artifact).
- **Human-readable outputs**:
  - A “binder recipe” explanation: **inputs → derived intents → enforced constraints → violations**.

## Acceptance criteria
- **Backend-neutrality**: derived outputs contain no backend handles or provider-native constructs.
- **Least privilege by default**: intent emission is minimal, scoped, and does not widen permissions/network posture unless explicitly declared and allowed by policy.
- **Deterministic outputs**: stable ordering and stable identifiers across repeated runs.
- **Policy-aligned**: compliance outcomes are produced via policy/config evaluation, not embedded framework branching inside binder logic.

## Validation signals
- **Binder matrix conformance**: declared compatibility matches validated behavior across the triad matrix.
- **Security checks**: wildcard permissions/network broadening triggers a deny signal unless explicitly allowed and justified.
- **Determinism checks**: golden intent bundles and policy outcomes are byte-for-byte stable for identical inputs.
- **Explainability coverage**: every emitted intent has a provenance-backed “why” chain.

## Guardrails & forbidden behaviors
- **Forbidden**: producing provider-native artifacts (including infrastructure runtime objects) inside binder outputs.
- **Forbidden**: embedding compliance-pack selection logic or branching inside binder behavior.
- **Forbidden**: nondeterministic iteration/order dependence, time-based behavior, or side-effectful operations during binding.
- **Escalation (HITL required)**:
  - Any change that widens default permissions or network posture.
  - Any change that alters intent semantics (not just representation) in a way that affects compliance outcomes.

## Used by roles
- Binder Engineer
- Test & Conformance

