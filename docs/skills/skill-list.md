# Shinobi V3 — Agent Skill Definition & Enablement Plan

## 1) Agent Skill Taxonomy

### S1. Graph Reasoning & Mutation
Understand and safely mutate an in-memory infrastructure object graph.

### S2. Capability Modeling
Model capabilities as stable identifiers with structured capability-data contracts.

### S3. Binder Logic Synthesis
Design binder behaviors that compile edges into backend-neutral intent artifacts.

### S4. Policy Pack Authoring
Express compliance requirements as policy packs and rules.

### S5. Determinism Engineering
Identify nondeterminism sources and enforce canonical ordering and stable IDs.

### S6. Explainability Generation
Produce verifiable explain outputs: why a node/edge exists.

### S7. Provenance & Traceability
Attach provenance metadata to resolved config fields and decisions.

### S8. Contract & Schema Evolution
Evolve contracts over time with compatibility strategy.

### S9. Security Intent Modeling
Represent security posture as backend-neutral intent.

### S10. Conformance Test Design
Build tests that verify graph compilation and policy decisions.

### S11. Refactoring with Invariants Preserved
Restructure code while preserving semantic outputs.

### S12. Agent Tooling Discipline
Produce structured outputs with clear validation.

## 2) Agent Roles & Skill Bundles

- **R1. Kernel / Graph Engineer Agent**: S1, S5, S6, S7, S8, S11, S12.
- **R2. Component Authoring Agent**: S2, S6, S7, S8, S11, S12.
- **R3. Binder Engineer Agent**: S2, S3, S5, S6, S7, S9, S10, S11, S12.
- **R4. Policy Pack Authoring Agent**: S4, S6, S7, S8, S10, S12.
- **R5. Test & Conformance Agent**: S5, S6, S7, S8, S10, S11, S12.
- **R6. Contract & Schema Steward Agent**: S6, S7, S8, S12.

## 3) Skill Inputs & Required Context
- Versioned IR contract.
- Determinism spec.
- Policy pack set.
- Golden cases.
- Prior decisions.

## 4) Agent Guardrails
- **No backend handles in IR**.
- **Determinism is mandatory**.
- **Explainability required**.
