# Components — Test-Case Extraction KB

Purpose: capture **component config precedence**, **framework deltas**, and **validation/capability contract** semantics from the Shinobi test suite, reframed for V3 as backend-neutral graph behaviors.

Related canonical laws/patterns (see `README.md`):
- Kernel Laws: **KL-007** (ConfigPrecedence), **KL-006** (ExplainableDiagnostics), **KL-002** (SchemaAndSpecValidation), **KL-003** (CapabilityCompatibilityMatrix), **KL-001** (DeterministicCompilation)
- Patterns: **P-005** (TriadMatrixBehavior)

## What belongs here

- Component config precedence rules (platform → framework/pack → env → overrides)
- Component validation semantics and diagnostics
- Capability contracts exposed by components (provides/requires) as typed, stable identifiers
- Framework “delta” behavior expressed as policy/config, not code branching
- Triad matrix implications: component × binder × policy pack

## Evidence pointers (current classification index)

From `index.md`:

- Component test suites mix semantic expectations with CDK template assertions.
  - Semantic expectations are portable (config precedence, validation, capability contracts).
  - CDK/template assertions are legacy-only evidence.

## Extracted expectations (backend-neutral)

### Config precedence (KL-007)

- Configuration resolution follows a defined precedence chain.
- The resolved value must be explainable (KL-006) with provenance (where each value came from).

TODO: Define the canonical precedence chain and how conflicts are resolved (merge vs replace).

### Framework deltas (P-005, KL-008)

- Behavioral differences across compliance packs/frameworks must be driven by policy/config, not hard-coded branching in component behavior.

TODO: Inventory which deltas are expected and which are forbidden (i.e., “pack branching inside component logic”).

### Validation and diagnostics (KL-002, KL-006)

- Component config inputs validate against schemas/contracts.
- Failures produce structured diagnostics with stable paths and remediation guidance.

### Capability contracts (KL-003)

- Components publish capabilities as stable identifiers with typed data contracts.
- Invalid/unknown capability usage is rejected with allowed-values guidance.

### Determinism (KL-001)

- Component synthesis and emitted facts/intents are deterministic for identical conceptual inputs.

