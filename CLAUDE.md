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

# Build a specific package (Nx project names are unscoped: kernel, ir, cli, ...)
pnpm nx build kernel

# Run tests
pnpm nx run-many -t test

# Run tests for a specific package
pnpm nx test kernel

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
      ├── validation (manifest/spec validation)
      ├── policy (compliance engine)
      └── binder (edge compilation)

validation → contracts, ir
adapters/aws → contracts, ir (ONLY)
```

**Boundary rules**:

- `kernel`, `binder`, `policy` **cannot import adapters**
- No provider SDKs anywhere except `adapters/`
- All outputs must be structured JSON objects, never strings

### Package Purposes

| Package        | Purpose                                                                |
| -------------- | ---------------------------------------------------------------------- |
| `contracts`    | Type definitions and interfaces (zero dependencies)                    |
| `ir`           | Intermediate Representation: Node, Edge, DerivedArtifact types         |
| `validation`   | Validation pipeline (schema → semantic → determinism), stable errors   |
| `kernel`       | Graph engine: mutation API, canonical ordering, serialization          |
| `binder`       | Edge compiler: transforms binding directives → backend-neutral intents |
| `policy`       | Compliance evaluation: policy pack loading, rule evaluation            |
| `conformance`  | Testing framework: golden cases, triad matrix                          |
| `cli`          | User-facing commands: validate, plan                                   |
| `adapters/aws` | Lowers intents to Pulumi AWS resources                                 |

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

| Law    | Summary                                                                       |
| ------ | ----------------------------------------------------------------------------- |
| KL-001 | DeterministicCompilation: byte-stable outputs, stable serialization           |
| KL-002 | SchemaAndSpecValidation: structured errors with stable paths                  |
| KL-003 | CapabilityCompatibilityMatrix: binder validation with allowed-values guidance |
| KL-005 | LeastPrivilegeByConstruction: reject unsafe wildcard resources                |
| KL-006 | ExplainableDiagnostics: actionable messages suitable for JSON consumption     |
| KL-007 | ConfigPrecedence: defined resolution chain for configuration                  |
| KL-008 | PolicyPackDrivenCompliance: explicit pack selection, no inferred defaults     |

## Documentation Structure

- `/docs/standards/` — 13 normative standards (graph-ir-schema, binder-contract, etc.)
- `/docs/skills/` — Agent skill definitions for structured development
- `/docs/conformance/gates.md` — 12 conformance gates mapped to standards
- `/extraction/` — V2 → V3 migration evidence and kernel laws
- `/test-cases/` — Test classification index mapping to kernel laws

## Current State

All 9 core packages are fully implemented and tested: contracts, ir, validation, kernel, binder, policy, conformance, cli, and adapter-aws.

- **22 blueprint reference manifests** (CI-validated) across Waves A, B, and C
- **55 node lowerers** + 4 intent lowerers in the AWS adapter
- **45 policy rules** across 3 packs (Baseline, FedRAMP-Moderate, FedRAMP-High)
- **~1,780 tests** across 121 spec files, all packages

Remaining work is tracked in `docs/product-management/backlog.md` (EE-\*/MCA-\* epics) and `docs/operations/current-roadmap.md` — treat those as the source of truth for what's next, not this section.

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

| Skill                                    | Use When                                                          |
| ---------------------------------------- | ----------------------------------------------------------------- |
| `graph-reasoning-and-mutation`           | Designing graph changes, mutation planning, invariant definition  |
| `determinism-engineering`                | Eliminating nondeterminism, stable IDs, canonical ordering        |
| `binder-logic-synthesis`                 | Writing binders, edge → intent compilation                        |
| `capability-modeling-standard`           | Defining component capabilities, contracts                        |
| `policy-pack-authoring`                  | Creating compliance rules, enforcement tiers                      |
| `security-intent-modeling`               | IAM and network intent design, least-privilege                    |
| `conformance-test-design`                | Golden cases, triad matrix, determinism gates                     |
| `contract-and-schema-evolution`          | Versioned contracts, breaking changes                             |
| `explainability-and-why-output-standard` | Provenance, structured diagnostics                                |
| `provenance-and-traceability`            | Origin tracking, audit evidence                                   |
| `pulumi-best-practices`                  | Adapter implementation, Pulumi patterns                           |
| `test-driven-development`                | Writing tests first, minimal implementations                      |
| `docs-with-mermaid`                      | Architecture diagrams, technical documentation                    |
| `adr-maintenance`                        | Architecture Decision Records creation and maintenance            |
| `environment-matrix-management`          | Dev/staging/prod environment controls and policy defaults         |
| `manifest-cookbook-authoring`            | Copy-ready manifest pattern docs and examples                     |
| `operations-runbook`                     | Deployment workflow documentation and triage procedures           |
| `adapter-lowering-contracts`             | Adapter lowerer contracts, intent lowering, adapter boundary      |
| `agent-decision-records`                 | Recording agent tool selection, constraints, HITL requirements    |
| `agent-roles-and-skill-bundles`          | Mapping roles to skill bundles, agent onboarding                  |
| `agent-tooling-discipline`               | Structured/versioned agent tool outputs, machine-checkable I/O    |
| `refactoring-with-invariants-preserved`  | Refactors that must preserve graph/intent/policy/plan semantics   |
| `retrospective`                          | Checkpoints, session analysis, capturing learnings                |
| `strategic-planning-protocol`            | Multi-persona plan evaluation before complex multi-phase projects |
