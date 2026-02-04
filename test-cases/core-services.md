# Core Services (Validation) — Test-Case Extraction KB

Purpose: capture **backend-neutral** semantics for **schema/manifest/directive validation** from the Shinobi test suite, reframed as V3 **Kernel Laws** and **portable behaviors**.

Related canonical laws/patterns (see `README.md`):
- Kernel Laws: **KL-002** (SchemaAndSpecValidation), **KL-006** (ExplainableDiagnostics), **KL-001** (DeterministicCompilation), **KL-003** (CapabilityCompatibilityMatrix)
- Patterns: **P-006** (SchemaCompositionDiscovery)

## What belongs here

- **Schema validation** (including composed schema discovery) and how errors must be reported
- **Manifest validation** and how unsupported component types / invalid directives fail
- **Directive validation** (compatibility matrix, access level/action profile constraints)
- **Diagnostic contracts** (paths, allowed values, aggregation, stability/determinism)

## Evidence pointers (current classification index)

These come directly from `index.md` (treat template/CDK coupling as legacy evidence only):

- `packages/core/src/services/tests/schema-validator.test.ts`
  - Invariant → KernelLaw (KL-002, KL-006)
- `packages/core/src/services/tests/manifest-schema-composer.test.ts`
  - Invariant → KernelLaw (KL-002) + Pattern (P-006)
- `packages/core/src/services/tests/enhanced-schema-validator.test.ts`
  - Invariant → KernelLaw (KL-002, KL-006)
- `packages/core/src/services/tests/binding-directive-validator.test.ts`
  - Invariant → KernelLaw (KL-003, KL-006)
- `packages/core/src/services/tests/binding-directive-validation-integration.test.ts`
  - Invariant → KernelLaw (KL-006)
- `packages/core/src/services/tests/manifest-synthesis-integration.test.ts`
  - Invariant → KernelLaw (KL-002, KL-006)

## Extracted expectations (backend-neutral)

### Schema validation (KL-002, KL-006)

- **Validate against an explicit schema surface**: inputs must validate against the correct schema(s) for their declared kind/version.
- **Stable, actionable diagnostics**:
  - stable *path addressing* (e.g., JSONPath-like) for invalid fields
  - stable, human-actionable messages
  - when relevant: include `allowedValues` (or equivalent) and remediation hints
- **Strictness**: invalid inputs must be rejected; no silent fallback.

TODO: Extract the exact diagnostic envelope and the “path” formatting rules that tests assume.

### Schema composition / discovery (P-006, KL-002)

- **Schema composition** produces a single validation surface.
- **Composition is deterministic** (KL-001): repeated runs produce identical composed schema output and identical diagnostics for the same invalid input.

TODO: Capture the deterministic ordering / precedence rules when multiple schema sources contribute.

### Binding directive validation (KL-003, KL-006)

- **Compatibility matrix enforcement**:
  - rejected when source/target capabilities are incompatible
  - rejected when capability identifiers are unknown (with “did you mean” or allowed-values guidance)
- **Access level / actions contract**:
  - access level mapping and any custom action profiles must be validated
  - invalid action formats must be rejected with clear remediation

TODO: Enumerate the canonical error codes/IDs (if any) and their stable message contracts.

### Validation error aggregation (KL-006)

- Validation failures should be **aggregated** (not “fail at first error”) when safe, to help operators fix multiple issues in one iteration.
- Aggregation order should be stable/deterministic (KL-001).

## Non-goals / drop list

- Any assertions about CDK construct trees, CloudFormation template output, or synth-time constructs.

