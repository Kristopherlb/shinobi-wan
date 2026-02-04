# Skill: Conformance Test Design (Golden Graph/Plan + Triad Matrix)

## Intent
- Enable an agent to design conformance tests that mechanically enforce correctness across the **triad matrix** \((component × binder × policy\_pack)\).
- Ensure determinism, policy correctness, and contract stability are gated by tests rather than conventions.

## Scope boundaries
- **In-scope**: defining what must be tested (golden graphs/plans, policy outcomes, intent bundles), coverage expectations, and failure semantics.
- **Out-of-scope**: implementing the test harness; backend-specific snapshot formats.

## Primary concepts
- **Golden cases**: canonical inputs with canonical expected outputs.
- **Triad matrix coverage**: verifying behavior across the composition axes (component/binder/policy pack).
- **Conformance**: verifying invariants, not just happy-path outcomes.

## Required inputs/context
- **Contract references**: current graph vocabulary, capability contracts, policy rule IDs, and structured output expectations.
- **Policy pack set**: named packs and enforcement tiers used in the matrix (explicit inputs).
- **Determinism spec**: stable ID, ordering, and serialization expectations.
- **Representative scenarios**: minimal but complete examples spanning core capabilities, security intents, and common binder patterns.

## Expected outputs
- **Structured outputs** (minimum):
  - **Test inventory**: list of golden cases, matrix dimensions covered, and expected invariant checks.
  - **Oracle definition**: what constitutes pass/fail and what outputs must match (conceptual).
  - **Failure classification**: determinism failure vs policy drift vs contract incompatibility vs binder mismatch.
- **Human-readable outputs**:
  - Triage guidance: what invariant was violated, likely causes, and what must be fixed (not “loosen the test”).

## Acceptance criteria
- **Coverage**: conformance suite covers required matrix combinations for touched subsystems.
- **Strictness**: nondeterminism and policy drift are treated as hard failures where required.
- **Reproducibility**: tests are stable and do not depend on time, network, or environment discovery.

## Validation signals
- **Snapshot mismatch** for golden outputs is a determinism or semantic drift signal (deny until resolved).
- **Outcome drift** across identical inputs/pack selection is a policy drift signal (deny).
- **Matrix gaps** for touched capabilities/binders are a coverage failure (deny for high-assurance changes).

## Guardrails & forbidden behaviors
- **Forbidden**: “fixing” regressions by weakening assertions without addressing the underlying invariant violation.
- **Forbidden**: tests that encode backend/provider semantics as the oracle of correctness.
- **Escalation (HITL required)**:
  - Any intentional change to golden outputs that affects compliance/security posture.

## Used by roles
- Test & Conformance
- Kernel / Graph Engineer
- Binder Engineer
- Policy Pack Authoring

