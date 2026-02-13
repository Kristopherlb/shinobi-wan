# Skill: Security Intent Modeling (IAM/Network as Backend-Neutral IR)

## Intent
- Enable an agent to represent security posture as **backend-neutral security intent** (permissions and network posture) that can be validated, audited, and lowered by adapters.
- Enforce least privilege and safe defaults without embedding backend/provider constructs in the kernel graph or derived artifacts.

## Scope boundaries
- **In-scope**: permission intent modeling, network posture intent modeling, validation constraints, and policy interaction boundaries.
- **Out-of-scope**: provider-specific policy statements, security group constructs, or any direct backend enforcement details.

## Primary concepts
- **Security intent**: declarative representation of allowed actions, resource scope, principals, and network connectivity constraints.
- **Validation constraints**: rules like “no wildcard resources” (unless explicitly allowed), scoped permissions, minimal network exposure.
- **Lowering boundary**: adapters translate intent into provider resources; the kernel/binders do not.

## Required inputs/context
- **Policy pack identifier(s)** and enforcement tiers (explicit inputs).
- **Threat model assumptions**: what safe baseline means per environment/pack (conceptual, policy-driven).
- **Capability and binder facts**: what interaction is required (read/write/invoke/subscribe), and what resources it targets (as facts/intents).
- **Golden security cases**: canonical examples of least-privilege and required exceptions across triad matrix packs.

## Expected outputs
- **Structured outputs** (minimum):
  - **Permission intent**: requested permissions with explicit scope constraints and justification hooks.
  - **Network intent**: connectivity rules (who talks to whom, directionality, port/protocol class) in backend-neutral form.
  - **Violation set**: explicit violations for overbroad scope, wildcarding, or unsafe defaults.
- **Human-readable outputs**:
  - Clear least-privilege rationale: why each permission/connectivity rule exists and why it is minimal.

## Acceptance criteria
- **No backend leakage**: no provider-native policy objects or network resources appear in intent.
- **Least privilege**: intent is scoped to minimum required operations and resources.
- **Policy-driven**: pack selection and enforcement are external inputs; no embedded framework branching.
- **Deterministic**: intent ordering and identifiers are stable for identical inputs.

## Validation signals
- **Wildcard/resource overbreadth** triggers deny unless explicitly allowed and recorded as an exception path.
- **Network widening** (new inbound exposure) triggers deny for high-assurance packs unless explicitly allowed.
- **Triad matrix stability**: security intent outcomes remain stable across component×binder×pack tests.

## Guardrails & forbidden behaviors
- **Forbidden**: using security intent as an escape hatch to “just make it work.”
- **Forbidden**: widening permissions/network posture by default to reduce friction.
- **Escalation (HITL required)**:
  - Any new default permission class or default network exposure.
  - Any new exception category that allows broader-than-baseline posture.

## Used by roles
- Binder Engineer
- Policy Pack Authoring
- Test & Conformance

