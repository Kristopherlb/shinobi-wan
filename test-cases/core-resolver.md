# Core Resolver — Test-Case Extraction KB

Purpose: capture **resolver/event-source scanning semantics** and **diagnostics contracts** from the Shinobi test suite, reframed for V3 as graph-native, backend-neutral expectations.

Related canonical laws/patterns (see `README.md`):
- Kernel Laws: **KL-006** (ExplainableDiagnostics), **KL-003** (CapabilityCompatibilityMatrix), **KL-001** (DeterministicCompilation)
- Patterns: **P-004** (EventSourceAutoBinding)

## What belongs here

- Event source scanning and reference resolution rules
- Auto-binding semantics (implicit edges) and explicit opt-out rules
- Diagnostics for unsupported/ambiguous cases
- Determinism expectations (stable ordering and stable outputs)

## Evidence pointers (current classification index)

From `index.md`:

- `packages/core/src/resolver/__tests__/event-source-scanner.test.ts`
  - Behavioral → Pattern (P-004) + KernelLaw (KL-003, KL-006)
- `packages/core/src/resolver/__tests__/event-source-scanner-improvements.test.ts`
  - Behavioral → Pattern (P-004) + KernelLaw (KL-006)

Legacy-only evidence (do not port as-is; rewrite as graph/intent tests):

- `packages/core/src/resolver/__tests__/iam-policy-post-processor.test.ts` (Legacy)
- `packages/core/src/resolver/__tests__/security-group-rule-post-processor.test.ts` (Legacy)
- `packages/core/src/resolver/__tests__/resolver-engine-event-source-iam.test.ts` (Legacy)
- `packages/core/src/resolver/__tests__/resolver-engine-security-group-rules.integration.test.ts` (Legacy)

## Extracted expectations (backend-neutral)

### Event source discovery and scanning (P-004)

- Resolver must scan declared event sources and produce:
  - **implicit edges** (auto-binding) when references are valid and auto-binding is enabled
  - **diagnostics** when references are invalid/unsupported

TODO: Define the “reference syntax” and graph representations used in V3 (node refs, edge directives).

### Opt-out and external references

- Auto-binding must support a **defined opt-out mechanism**.
- External references have explicit rules (e.g., allowed forms, required metadata).

TODO: Extract the exact opt-out flag(s) and external reference validation rules from the underlying tests/source.

### Diagnostics contracts (KL-006)

- Every rejection/unsupported case must produce structured, explainable diagnostics:
  - stable location/path (where the event source was declared)
  - stable category/code (if applicable)
  - remediation hint (what to change)

### Determinism (KL-001)

- Scanning and resulting derived edges must be deterministic:
  - stable ordering of discovered bindings
  - stable identity/keys for derived artifacts

## Non-goals / drop list

- Post-processing behavior that directly mutates backend objects/resources (CDK/CloudFormation).
- Any end-to-end synthesis assertions; port only the semantics as graph→intent tests.

