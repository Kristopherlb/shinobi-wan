# Binders — Test-Case Extraction KB

Purpose: capture **binder strategy semantics** as backend-neutral “edge → derived intents/diagnostics” behaviors.

Related canonical laws/patterns (see `README.md`):
- Kernel Laws: **KL-004** (DerivedIntentBoundary), **KL-005** (LeastPrivilegeByConstruction), **KL-006** (ExplainableDiagnostics), **KL-001** (DeterministicCompilation), **KL-003** (CapabilityCompatibilityMatrix)
- Patterns: **P-001** (AccessLevelToActions), **P-002** (CustomActionsOverride), **P-003** (SecureAccessAugmentation), **P-007** (CrossServiceNetworkRuleAggregation)

## What belongs here

- Binder contract semantics: what inputs they accept and what derived intents they must emit
- Compatibility and validation expectations (unknown capabilities, incompatible pairs)
- Security intent behaviors (least privilege, forbidden wildcards, secure augmentation)
- Determinism expectations (stable ordering/IDs in intent bundles)
- Cross-service aggregation semantics (network rules, shared intents)

## Evidence pointers (current classification index)

From `index.md`:

### Binder contract + registry (packages/core)

- `packages/core/src/platform/contracts/__tests__/unified-binder-strategy-base.test.ts`
  - Invariant → KernelLaw (KL-004, KL-006, KL-008)
- `packages/core/src/platform/binders/registry/__tests__/unified-binder-registry-factory.test.ts`
  - Invariant → KernelLaw (KL-001, KL-003)
- `packages/core/src/platform/binders/registry/__tests__/unified-registry-security-strategies.test.ts`
  - Invariant → KernelLaw (KL-003)
- `packages/core/src/platform/binders/__tests__/resource-validator.test.ts`
  - Invariant → KernelLaw (KL-005, KL-006)
- `packages/core/src/platform/binders/__tests__/action-resolver.test.ts`
  - Invariant → KernelLaw (KL-001, KL-006) + Pattern (P-001)
- `packages/core/src/platform/binders/__tests__/action-allow-lists.test.ts`
  - Invariant → KernelLaw (KL-001, KL-006)

### Strategy tests (packages/binders)

`index.md` currently treats the binder strategy suite as portable invariants/behaviors.
Rather than copy the full table here, we treat it as:

- **A catalog of strategy-specific conformance cases** that must be re-expressed as V3 graph→intent golden tests.

TODO: Split out a strategy catalog section (grouped by domain: compute, storage, networking, security, governance) as the KB grows.

## Extracted expectations (backend-neutral)

### Binder purity and boundaries (KL-004)

- Binders must emit **backend-neutral intents** (IAM/network/config/telemetry) and diagnostics.
- Binders must **not** perform backend resource lowering (that belongs to adapters).

### Least privilege by construction (KL-005)

- Derived IAM intents must be scoped to minimum actions/resources; wildcard-by-default is forbidden.

TODO: Capture exact deny rules and exception pathways (if any), as testable laws.

### Access levels and custom action overrides (P-001, P-002)

- Access levels map to action sets deterministically.
- Directive-provided custom actions can override/augment defaults, but must be validated.

### Secure access augmentation (P-003)

- “Secure access” options add restrictive/extra derived intents (not backend wiring).

### Compatibility matrix enforcement (KL-003)

- Binder selection and capability pairing is validated against a registry/matrix:
  - unknown capability IDs are rejected with allowed-values guidance
  - incompatible pairs are rejected with actionable diagnostics

### Explainability + diagnostics (KL-006)

- Decisions (strategy selection, intent emission, validation failures) must be explainable with structured diagnostics and provenance.

### Determinism (KL-001)

- Same conceptual graph + directives produce identical:
  - intent bundles (stable ordering)
  - IDs/keys for derived artifacts
  - diagnostic ordering and contents

