# Shinobi V3 — Test-Case Extraction KB

This folder captures **use cases, invariants, and expected behaviors** extracted from the Shinobi repository test suite, re-framed for **Shinobi V3**.

## Scope & constraints

- **Graph-native**: Expectations are expressed as graph semantics (nodes/edges/intents/diagnostics), not CDK constructs.
- **Backend-neutral**: No CloudFormation/CDK template shapes, construct trees, or synth-time assumptions are treated as portable truth.
- **Preserve semantics**: Keep user-facing and policy-relevant behaviors (validation, intent derivation, diagnostics, determinism).

## Glossary

### Test classifications

| Classification | Meaning in this KB | What to do in V3 |
|---|---|---|
| **Invariant** | A rule that must hold regardless of backend (schema/contract validation, determinism, compatibility, diagnostics contracts). | Implement as kernel validation laws + conformance tests. |
| **Behavioral** | A preserved behavior that can be re-expressed without backend coupling (intent derivation, defaults/precedence, CLI contracts, auto-binding). | Implement as kernel/pattern conformance tests (graph inputs → graph intents/diagnostics). |
| **Implementation-only (drop)** | Tests that primarily assert CDK/CloudFormation/template shapes, construct trees, or backend APIs. | Do not port. Optionally extract **ideas** into Kernel Laws/Patterns if still meaningful. |

### Porting classification (V3 target mapping)

| Mapping | Meaning | Action |
|---|---|---|
| **Kernel Law** | Mandatory system rule; violation is an error (or defined enforcement level). | Encode in kernel validation + determinism + diagnostics contracts. |
| **Pattern** | Reusable behavior/recipe that is encouraged/expected but not fundamental law. | Encode as pattern tests and reference implementations. |
| **Legacy (do not port)** | Behavior is tightly coupled to CDK/CloudFormation or known-deprecated workflow. | Keep only as historical context; replace with graph-native equivalent. |

## Kernel Laws (canonical IDs)

| ID | Kernel Law | Summary (backend-neutral) |
|---|---|---|
| **KL-001** | **DeterministicCompilation** | Same conceptual inputs → same graph/IR/intents (stable ordering, stable IDs, repeatable outputs). |
| **KL-002** | **SchemaAndSpecValidation** | Inputs must validate against schemas/contracts; errors include stable paths and actionable messages. |
| **KL-003** | **CapabilityCompatibilityMatrix** | Edges/binds must be validated against a compatibility registry; unknown capability/access is rejected with allowed-values guidance. |
| **KL-004** | **DerivedIntentBoundary** | Binders/components emit **backend-neutral intents** (IAM/network/config/telemetry); lowering to provider resources happens only in adapters. |
| **KL-005** | **LeastPrivilegeByConstruction** | Derived IAM intents must be scoped to the minimum necessary resources/actions; “wildcards by default” is forbidden. |
| **KL-006** | **ExplainableDiagnostics** | Every validation/derivation decision must be explainable with structured diagnostics and provenance (what/why/how-to-fix). |
| **KL-007** | **ConfigPrecedence** | Configuration resolution follows a defined precedence chain (platform → framework → env → overrides); resulting values are explainable. |
| **KL-008** | **PolicyPackDrivenCompliance** | Compliance outcomes derive from policy packs/config, not hardcoded framework branching in components/binders. |

## Patterns (canonical IDs)

| ID | Pattern | Summary |
|---|---|---|
| **P-001** | **AccessLevelToActions** | Access levels map to action sets; custom actions can override while remaining validated. |
| **P-002** | **CustomActionsOverride** | Directive-provided actions replace/augment defaults; invalid formats are rejected with remediation. |
| **P-003** | **SecureAccessAugmentation** | “Secure access” options cause additional derived intents (more restrictive actions, extra env/config), not backend wiring. |
| **P-004** | **EventSourceAutoBinding** | Event source references can generate implicit edges; opt-out and external references have explicit rules. |
| **P-005** | **TriadMatrixBehavior** | Behavior is evaluated across compliance packs (commercial/moderate/high) without embedding backend specifics. |
| **P-006** | **SchemaCompositionDiscovery** | Schema registry discovery/composition produces a single validation surface and stable error reporting. |
| **P-007** | **CrossServiceNetworkRuleAggregation** | Network rule intents can be aggregated/deduped across services and applied as a separate deployable unit (adapter responsibility). |
| **P-008** | **CLICommandContract** | CLI/agent commands return stable exit codes and structured outputs (json mode), independent of backend implementation. |

## Files in this KB

- `index.md`: master classification table for the whole test suite
- `core-services.md`: schema/manifest/directive validation behaviors
- `core-resolver.md`: resolver/event-source scanning semantics and diagnostics
- `binders.md`: binder strategy semantics (capability pairing → derived intents)
- `components.md`: component config precedence + framework deltas + validation/capability contracts

