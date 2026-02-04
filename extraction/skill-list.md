## Shinobi V3 — Agent Skill Definition & Enablement Plan

### Scope & Constraints
- **This is a skills definition and enablement exercise**, not implementation.
- **Do not generate code, policies, schemas, or full documentation.**
- Define only: **skills**, **roles**, **inputs**, **outputs**, **acceptance criteria**, **guardrails**, **gaps**.
- **Architectural context**: in-memory **object graph kernel**, binders operate on objects, policies evaluate graph and plan, compilation target **Pulumi**, determinism/explainability/auditability mandatory, compliance is **policy/config-driven**.
- **Triad matrix (definition)**: \(\{\text{component} \times \text{binder} \times \text{policy pack}\}\) coverage to ensure correctness across the composition axes.

---

## 1) Agent Skill Taxonomy

### S1. Graph Reasoning & Mutation
- **Description**: Understand and safely mutate an in-memory infrastructure object graph (nodes, edges, derived artifacts).
- **Why required**: V3 is graph-native; all work ultimately changes graph state.
- **Failure modes if missing**: nondeterministic mutations; hidden side effects; broken invariants; “fix by reordering.”
- **Related subsystems**: Kernel graph, IR serialization, compilation pipeline.

### S2. Capability Modeling (Provides/Requires Contracts)
- **Description**: Model capabilities as stable identifiers with structured capability-data contracts.
- **Why required**: Capabilities are the primary “typed interface” between components and binders.
- **Failure modes if missing**: ambiguous edges; binder mismatch; incomplete taxonomy; hardcoded special-cases.
- **Related subsystems**: Capability registry, component SDK, binder matrix.

### S3. Binder Logic Synthesis (Edge → Derived Artifacts)
- **Description**: Design binder behaviors that compile edges into **backend-neutral intent artifacts** (runtime config injection, IAM intent, network intent, telemetry intents).
- **Boundary rule**: **Binders emit intent**; **adapters lower intent** into provider-specific resources. Lowering must not occur inside binders or the kernel IR.
- **Why required**: Bindings are how the graph becomes deployable infrastructure semantics.
- **Failure modes if missing**: over-privileged access; invalid network openings; brittle coupling; non-replayable outputs.
- **Related subsystems**: Binder framework, security derivation, config injection, plan output.

### S4. Policy Pack Authoring (Config-Driven Compliance)
- **Description**: Express compliance requirements as policy packs and rules (data-driven), not code branching.
- **Why required**: “Compliance is policy/config-driven, never hardcoded.”
- **Failure modes if missing**: `if framework == X` inside components/binders; untestable compliance logic; inconsistent enforcement.
- **Related subsystems**: Policy engine, compliance packs, exception model, evidence.

### S5. Determinism Engineering
- **Description**: Identify nondeterminism sources and enforce canonical ordering, stable IDs, and canonical serialization.
- **Why required**: Determinism is mandatory for trust, CI gating, and reproducible plans.
- **Failure modes if missing**: flaky plans/diffs; irreproducible builds; “works on my machine.”
- **Related subsystems**: Kernel, artifact schema, diff/explain, testing harness.

### S6. Explainability Generation (Why/How Outputs)
- **Description**: Produce verifiable explain outputs: why a node/edge exists, why a policy decision occurred, provenance of config, why a derived artifact was emitted.
- **Why required**: Operators and auditors need deterministic explanations tied to provenance.
- **Failure modes if missing**: opaque plans; inability to audit; weak diagnostics; poor trust.
- **Related subsystems**: Plan artifacts, policy engine, config resolution, evidence bundle.

### S7. Provenance & Traceability
- **Description**: Attach provenance metadata to resolved config fields, policy decisions, and derived artifacts.
- **Why required**: Enables explainability, evidence, and safe refactoring.
- **Failure modes if missing**: cannot prove source of defaults/overrides; compliance disputes; weak rollback.
- **Related subsystems**: Config resolver, policy engine, artifacts.

### S8. Contract & Schema Evolution (Versioned Interfaces)
- **Description**: Evolve contracts over time (IR, tool protocol, capability data) with compatibility strategy and migration notes.
- **Why required**: V3 will evolve quickly; agents must not break consumers or conformance.
- **Failure modes if missing**: breaking changes; stranded artifacts; brittle tooling.
- **Related subsystems**: IR schema, agent tool protocol, component SDK, binder contract.

### S9. Security Intent Modeling (IAM/Network as Backend-Neutral IR)
- **Description**: Represent security posture as backend-neutral intent; never embed backend handles (e.g., CDK `PolicyStatement`) in IR.
- **Why required**: Pulumi target and portability require backend neutrality.
- **Failure modes if missing**: adapter leakage into kernel; non-transferable IR; unsafe permissions.
- **Related subsystems**: Security derivation standard, binder outputs, policy checks.

### S10. Conformance Test Design (Golden Graph/Plan)
- **Description**: Build tests that verify graph compilation, binder outputs, and policy decisions across the triad matrix.
- **Why required**: Safety and determinism must be enforced mechanically.
- **Failure modes if missing**: regressions ship silently; policy drift; nondeterminism reintroduced.
- **Related subsystems**: Test harness, conformance suite, CI gates.

### S11. Refactoring with Invariants Preserved
- **Description**: Restructure code while preserving semantic outputs (IR, plan artifacts, policy outcomes).
- **Why required**: Kernel will be refactored often; invariants must hold.
- **Failure modes if missing**: accidental semantic drift; brittle rewrites; “cleanup broke compliance.”
- **Related subsystems**: All core kernel subsystems, conformance suite.

### S12. Agent Tooling Discipline (Structured Outputs Only)
- **Description**: Produce structured outputs (JSON/AST/IR snapshots) with clear validation and rejection conditions.
- **Why required**: Agents are primary developers; tooling must be machine-checkable.
- **Failure modes if missing**: untestable changes; ambiguous output; weak automation.
- **Related subsystems**: Agent tool protocol, CI, artifact writers.

---

## 2) Agent Roles & Skill Bundles

### R1. Kernel / Graph Engineer Agent
- **Primary responsibilities**: Graph IR, kernel APIs, determinism and canonicalization, adapter boundary design (not adapter implementation).
- **Required skills**: S1, S5, S6, S7, S8, S11, S12.
- **Explicit non-responsibilities**: Writing policy packs; authoring component-specific binders; writing end-user docs.
- **Typical tasks**: Add a new IR field with provenance; enforce canonical sorting; design IR diff semantics; define stable node/edge IDs.

### R2. Component Authoring Agent
- **Primary responsibilities**: Component contracts, capability publication, config surfaces, telemetry descriptors integration points.
- **Required skills**: S2, S6, S7, S8, S11, S12.
- **Explicit non-responsibilities**: Implementing binder logic; implementing policy engine; backend compilation details.
- **Typical tasks**: Define capability data fields a component provides; add config inputs with provenance; ensure no backend handles leak.

### R3. Binder Engineer Agent
- **Primary responsibilities**: Binder implementations as edge compilers producing derived artifacts and constraints.
- **Required skills**: S2, S3, S5, S6, S7, S9, S10, S11, S12.
- **Explicit non-responsibilities**: Defining compliance packs; changing kernel IR without Kernel Agent review.
- **Typical tasks**: Add binder for new capability pair; tighten least-privilege intent emission; ensure deterministic outputs and matrix coverage.

### R4. Policy Pack Authoring Agent
- **Primary responsibilities**: Policy packs/rules, enforcement tiers, exception model usage, violation modeling and evidence mapping.
- **Required skills**: S4, S6, S7, S8, S10, S12.
- **Explicit non-responsibilities**: Changing binder semantics to “match a pack”; adding pack-branching logic inside components/binders.
- **Typical tasks**: Add new rule to pack; define severity/controls mapping; add exception workflow constraints.

### R5. Test & Conformance Agent
- **Primary responsibilities**: Conformance suite, determinism tests, triad matrix coverage, pack-branching detection checks.
- **Required skills**: S5, S6, S7, S8, S10, S11, S12.
- **Explicit non-responsibilities**: Authoring production binder/component logic (except minimal test harness hooks).
- **Typical tasks**: Add golden graph/plan fixtures; add determinism property tests; add CI checks rejecting nondeterministic outputs.

### R6. Contract & Schema Steward Agent
- **Primary responsibilities**: Maintain minimal, versioned **system interfaces** (IR/tool protocol/capability data) and “how to validate” guides.
- **Required skills**: S6, S7, S8, S12.
- **Explicit non-responsibilities**: Implementing kernel/binder/policy logic.
- **Typical tasks**: Update schema version notes; define acceptance criteria templates; curate source maps and decision logs.

---

## 3) Skill Inputs & Required Context

### Shared Inputs (all roles must receive)
- **Versioned IR contract reference**: current IR version + change log summary.
- **Determinism spec reference**: canonical sort keys, stable ID rules, canonical serialization expectations.
- **Policy pack set**: current pack list + rule catalog index + enforcement tier definitions.
- **Golden cases**: canonical graph snapshots + expected plan artifacts for representative services/components.
- **Prior decisions**: ADR-style notes for boundary rules (IR vs adapter, exceptions, provenance).
- **Validation tool outputs**: latest conformance results, determinism checks, and policy check outcomes.

### Context boundaries (global)
- **Agents may assume**: Graph is the source of truth; Pulumi is target; compliance comes from packs; structured outputs are required.
- **Agents must not assume**: Any backend semantics (CloudFormation/CDK); any implicit default; any pack-selection logic embedded in code.
- **What must be explicitly provided**: active compliance pack name, environment, prior decision constraints, and golden expected outputs.

### Versioning expectations (global)
- **Every change** must specify: input versions consumed, output versions produced, and compatibility considerations.
- **Evolution rule**: add fields in a backward-compatible way whenever possible; when not possible, require migration notes + conformance updates.

---

## 4) Skill Outputs & Acceptance Criteria

### R1 Kernel / Graph Engineer Agent
- **Expected outputs**:
  - **Structured**: IR change proposal (fields + invariants), canonicalization rules, determinism rationale.
  - **Human-readable**: “why” narrative tied to invariants and conformance impact.
- **Validation mechanisms**: determinism checks, IR schema validation, golden plan tests.
- **Acceptance criteria**: identical inputs produce identical IR + plan artifacts; no backend handles in IR; provenance rules are explicit.

### R2 Component Authoring Agent
- **Expected outputs**:
  - **Structured**: capability data contract deltas, config surface definition with provenance requirements.
  - **Human-readable**: explain notes for new config/capabilities (what/why).
- **Validation mechanisms**: schema validation, conformance suite, policy checks for forbidden patterns.
- **Acceptance criteria**: capability publication is stable; config resolution is deterministic; no pack-branching in component logic.

### R3 Binder Engineer Agent
- **Expected outputs**:
  - **Structured**: derived artifact intents (IAM/network/config injection) and violation emissions.
  - **Human-readable**: binder “recipe” explanation: inputs → outputs → constraints.
- **Validation mechanisms**: binder matrix tests, least-privilege checks, determinism tests, triad matrix runs.
- **Acceptance criteria**: outputs are backend-neutral; deterministic ordering; least privilege enforced; violations are machine-readable.

### R4 Policy Pack Authoring Agent
- **Expected outputs**:
  - **Structured**: rule definitions, exception policy constraints, enforcement tier mapping.
  - **Human-readable**: rationale for rule and severity selection.
- **Validation mechanisms**: policy conformance tests; pack selection externalization checks; evidence mapping checks.
- **Acceptance criteria**: no requirement forces code branching inside components/binders; rules are testable and auditable.

### R5 Test & Conformance Agent
- **Expected outputs**:
  - **Structured**: golden fixtures inventory, determinism assertions list, conformance report summaries.
  - **Human-readable**: failure triage guidance (what invariant was violated).
- **Validation mechanisms**: CI gating; snapshot comparisons; determinism property tests.
- **Acceptance criteria**: nondeterminism causes rejection; pack-branching is detected and blocked; triad matrix coverage is enforced.

### R6 Contract & Schema Steward Agent
- **Expected outputs**:
  - **Structured**: versioned contract references and minimal schema indices (no full docs).
  - **Human-readable**: “how to validate” and “what changed” summaries.
- **Validation mechanisms**: schema validation in CI; doc lint checks where applicable.
- **Acceptance criteria**: contract references are consistent, versioned, and match conformance suite expectations.

---

## 5) Agent Guardrails & Safety Constraints

### Global hard constraints (apply to all agent outputs)
- **No backend handles in IR**: any CDK/CloudFormation/Pulumi runtime handles are adapter-layer only.
- **No hardcoded compliance pack names in component/binder logic**: pack selection is external input.
- **Determinism is mandatory**:
  - stable IDs for nodes/edges
  - canonical sorting for collections
  - canonical serialization for IR/artifacts
- **Idempotency**: repeated application of the same mutation must not change the resulting graph or artifacts.
- **Explainability required**: every change must provide a verifiable explanation path (provenance + “why”).
- **Provenance required**: resolved config fields and derived artifacts must carry provenance metadata.
- **Mandatory tests per change**: determinism checks + targeted conformance + policy checks relevant to touched subsystems.

### Explicitly Forbidden Agent Behaviors (Anti-Skills)
- Encoding environment, compliance, or risk posture into control flow (e.g., `if pack == X` in components/binders).
- Adding implicit defaults that are not backed by policy, config, or explicit hard-default contracts.
- Using backend-native constructs in kernel or IR (provider resource handles, CDK/CFN semantics, etc.).
- Introducing nondeterminism “for convenience” (unordered iteration, unstable IDs, unstable serialization).
- Fixing test failures by loosening assertions instead of addressing the underlying semantic or determinism cause.

### Skill → Primary Failure Detection Signal
| Skill | Primary failure signal |
|---|---|
| S1 Graph reasoning & mutation | IR diff mismatch or illegal graph mutation detected |
| S2 Capability modeling | Binder matrix mismatch or incompatible capability data contract |
| S3 Binder logic synthesis | Over-privileged IAM intent, invalid network intent, or missing derived artifacts |
| S4 Policy pack authoring | Policy outcomes drift across triad matrix or forbidden pack-branching detected |
| S5 Determinism engineering | Snapshot mismatch or nondeterminism check failure |
| S6 Explainability generation | Missing provenance chain or non-replayable explain output |
| S7 Provenance & traceability | Config/decision provenance missing or inconsistent |
| S8 Contract & schema evolution | Versioned contract incompatibility or migration-required change without notes |
| S9 Security intent modeling | Backend handles leak into IR or security intent cannot be lowered safely |
| S10 Conformance test design | Triad matrix coverage gap or unverified invariants |
| S11 Refactoring with invariants preserved | Semantic drift detected via golden outputs |
| S12 Agent tooling discipline | Output is not machine-validated or fails structured contract checks |

### Escalation boundaries (HITL required)
- Changing invariants around determinism, stable IDs, canonical serialization.
- Changing exception model semantics or enforcement tiers.
- Introducing new compliance pack categories or modifying enforcement interpretation.
- Any change that weakens least-privilege or widens network intent by default.

### Rollback expectations
- Agents must produce changes that are revertible without leaving IR/artifact versions inconsistent.
- If a change requires migration, it must define rollback constraints (what cannot be safely rolled back).

### Handling ambiguity/conflict
- Prefer conservative choices that preserve invariants.
- If conflicts arise (policy vs binder behavior), policy engine owns compliance truth; binder must emit intent + facts, not reinterpret packs.

---

## 6) Skill Gaps & Future Capabilities

### Not required for initial V3 (Later)
- **Cost optimization reasoning** (FinOps-aware graph rewrites and budgeted plans).
- **Automated drift remediation** (reconcile observed state back into graph safely).
- **Multi-target compilation** beyond Pulumi (additional adapters).
- **Autonomous policy learning** (deriving policies from evidence; high risk, postpone).

### Future-enabling skills (dependent on kernel maturity)
- **Performance optimization skill**: graph compilation profiling + deterministic caching strategies.
- **Cross-environment reasoning**: safely compare environments and generate minimal diffs with provenance.
- **Evidence automation**: end-to-end evidence bundle assembly and verification pipelines.

---