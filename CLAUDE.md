# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Shinobi V3 is an **in-memory object graph kernel** for infrastructure-as-code that compiles to Pulumi. The system is backend-neutral, policy-driven, and deterministic by design.

**Core principle**: The kernel, binders, and policies operate on abstract graph representations—never on provider-specific constructs. Provider SDKs only exist in `/packages/adapters/`.

## Commands

```bash
# Install dependencies
pnpm install

# Build all packages
pnpm nx run-many -t build

# Build a specific package
pnpm nx build @shinobi/kernel

# Run tests
pnpm nx run-many -t test

# Run tests for a specific package
pnpm nx test @shinobi/kernel

# Lint
pnpm nx run-many -t lint

# Format check/fix
pnpm run format:check
pnpm run format:write
```

## Architecture

### Package Dependency Graph (enforced via ESLint)

```
cli → kernel
      ├── contracts (base types, no dependencies)
      ├── ir (graph model)
      ├── policy (compliance engine)
      └── binder (edge compilation)

adapters/aws → contracts, ir (ONLY)
```

**Boundary rules**:
- `kernel`, `binder`, `policy` **cannot import adapters**
- No provider SDKs anywhere except `adapters/`
- All outputs must be structured JSON objects, never strings

### Package Purposes

| Package | Purpose |
|---------|---------|
| `contracts` | Type definitions and interfaces (zero dependencies) |
| `ir` | Intermediate Representation: Node, Edge, DerivedArtifact types |
| `kernel` | Graph engine: mutation API, canonical ordering, serialization |
| `binder` | Edge compiler: transforms binding directives → backend-neutral intents |
| `policy` | Compliance evaluation: policy pack loading, rule evaluation |
| `conformance` | Testing framework: golden cases, triad matrix |
| `cli` | User-facing commands: validate, plan |
| `adapters/aws` | Lowers intents to Pulumi AWS resources |

### Key Concepts (from glossary.md)

- **Node**: typed object representing a component or platform concept
- **Edge**: typed relationship between nodes (binding, trigger, dependency)
- **Intent**: backend-neutral representation of desired effect (IAM, network, config, telemetry)
- **Binder**: deterministic "edge compiler" that maps edge + context → intents
- **Policy pack**: named set of rules (Baseline, FedRAMP Moderate, FedRAMP High)
- **Triad matrix**: conformance testing across `component × binder × policy_pack`

## Critical Invariants

These invariants are non-negotiable and enforced at CI:

1. **Determinism**: Identical inputs → identical byte-stable outputs
2. **Stable IDs**: No UUIDs, no timestamps in identifiers
3. **Canonical ordering**: Deterministic sorting of nodes, edges, artifacts
4. **No backend handles**: Provider-native objects never appear in kernel/IR/binder outputs
5. **No pack branching**: Components and binders never branch on policy pack selection
6. **Idempotent mutations**: Same mutation applied twice → same result

## Kernel Laws (from extraction/v3/patterns/kernel-laws.md)

| Law | Summary |
|-----|---------|
| KL-001 | DeterministicCompilation: byte-stable outputs, stable serialization |
| KL-002 | SchemaAndSpecValidation: structured errors with stable paths |
| KL-003 | CapabilityCompatibilityMatrix: binder validation with allowed-values guidance |
| KL-005 | LeastPrivilegeByConstruction: reject unsafe wildcard resources |
| KL-006 | ExplainableDiagnostics: actionable messages suitable for JSON consumption |
| KL-007 | ConfigPrecedence: defined resolution chain for configuration |
| KL-008 | PolicyPackDrivenCompliance: explicit pack selection, no inferred defaults |

## Documentation Structure

- `/docs/standards/` — 14 normative standards (graph-ir-schema, binder-contract, etc.)
- `/docs/skills/` — Agent skill definitions for structured development
- `/docs/conformance/gates.md` — 28 conformance gates mapped to standards
- `/extraction/` — V2 → V3 migration evidence and kernel laws
- `/test-cases/` — Test classification index mapping to kernel laws

## Current State

The project is in early implementation. Package scaffolding and documentation are complete, but source files are stubs. Implementation should follow this sequence:

1. `kernel` — Graph model, stable IDs, canonical serialization
2. `contracts` — Freeze type shapes
3. Create `validation` package — Schema and semantic validation
4. `binder` — First real binder end-to-end
5. `policy` — First policy rule
6. `conformance` — First golden test

## Agent Roles (from roles.md)

When contributing, consider which role applies:
- **R1 Kernel/Graph Engineer**: graph semantics, determinism, adapter boundaries
- **R2 Component Authoring**: capabilities, config surfaces, emitted facts
- **R3 Binder Engineer**: edge → intent compilation, least-privilege
- **R4 Policy Pack Authoring**: rules as data, enforcement tiers
- **R5 Test & Conformance**: determinism gates, triad matrix
- **R6 Contract Steward**: versioned contracts, schema evolution

## Project Skills (in .claude/skills/)

Skills provide structured guidance for specific development tasks:

| Skill | Use When |
|-------|----------|
| `graph-reasoning-and-mutation` | Designing graph changes, mutation planning, invariant definition |
| `determinism-engineering` | Eliminating nondeterminism, stable IDs, canonical ordering |
| `binder-logic-synthesis` | Writing binders, edge → intent compilation |
| `capability-modeling-standard` | Defining component capabilities, contracts |
| `policy-pack-authoring` | Creating compliance rules, enforcement tiers |
| `security-intent-modeling` | IAM and network intent design, least-privilege |
| `conformance-test-design` | Golden cases, triad matrix, determinism gates |
| `contract-and-schema-evolution` | Versioned contracts, breaking changes |
| `explainability-and-why-output-standard` | Provenance, structured diagnostics |
| `provenance-and-traceability` | Origin tracking, audit evidence |
| `pulumi-best-practices` | Adapter implementation, Pulumi patterns |
| `test-driven-development` | Writing tests first, minimal implementations |
| `docs-with-mermaid` | Architecture diagrams, technical documentation |
