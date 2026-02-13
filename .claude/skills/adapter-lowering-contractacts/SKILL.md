SKILL ID: SK-201
OWNER ROLE: Adapter/Lowering Engineer
MATURITY: draft

# Adapter Lowering Contracts

## 1) Purpose

Adapter / lowering is the deterministic translation of backend-neutral intents and plans into backend-specific operations, without changing intent or leaking provider semantics upward.

The kernel outputs **backend-neutral intents** (the "what"). Adapters lower these to **backend/provider primitives** (the "how"). This boundary ensures that provider details (AWS/Azure/GCP constructs) never leak into the abstract planning layer, maintaining portability and determinism.

## 2) Scope

**In scope**

* Translating backend-neutral intents → backend/provider operations.
* Mapping stable identities (kernel-side) → provider identifiers (cloud-side).
* Creating a deterministic "change set" / execution plan.
* Emitting provenance + diagnostics (linking output back to input).

**Out of scope**

* Kernel validation rules (input is assumed validated).
* Policy evaluation decisions (must strictly follow Policy Evaluation Lifecycle ADR).
* Provider SDK specifics (no implementation details like AWS SDK calls here).
* Runtime orchestration / retries (reference Orchestration Layer).

## 3) Inputs / Outputs

**Inputs MUST include**

* `PlanArtifact`: The backend-neutral plan envelope containing directives.
* `DerivedIntents`: Per-component signals (IAM, network, config, compliance).
* `PolicyDecisions`: Artifacts from the policy engine (per ADR).

**Outputs MUST include**

* `LoweredChangeSet`: A structured, backend-specific list of operations (the "diff" to apply).
* `ResourceMap`: A mapping from stable Kernel IDs to provider-specific IDs.
* `ProvenanceRecord`: Trace IDs, input hashes, and adapter version info.
* `Diagnostics`: A violation envelope containing any errors (no raw strings).

## 4) Invariants

Adapters implementation MUST adhere to these invariants to ensure system integrity:

1.  **No upward leakage (MUST):** Provider handles, SDK objects, or cloud-specific Enums MUST NOT appear in kernel outputs. Adapters MUST be the only place provider-native objects exist.
2.  **Deterministic lowering (MUST):** Identical inputs (Plan + State) MUST produce identical `LoweredChangeSet` ordering and stable IDs, byte-for-byte.
3.  **Stable identity (MUST):** Every lowered operation MUST reference stable IDs from the plan. Provider IDs are mapped separately in the `ResourceMap`.
4.  **Implicit Policy Ban (MUST):** Adapters MUST NOT invent policy. They only enforce decisions already expressed in policy outputs/standards.
5.  **Explicit IO (MUST):** All external reads (state discovery) MUST be modeled as inputs and recorded in provenance. No hidden side channels.
6.  **Structured failures (MUST):** Failures MUST emit structured violations/diagnostics; zero ad-hoc error strings or stack traces in output.
7.  **Versioned adapter surface (MUST):** Adapter MUST declare its version and compatibility range with plan schema versions.
8.  **Patch/escape hatch governance (MUST):** Any patch application MUST be registered and auditable (reference exception/patch standard).
9.  **Pure function boundary (SHOULD):** Lowering SHOULD be referentially transparent given explicit inputs (no hidden env/process state).
10. **Capability isolation (SHOULD):** Adapter modules SHOULD be capability-scoped and replaceable (e.g., swapping the "IAM" adapter without breaking "Network").

## 5) Failure modes

Common risks to mitigate:

1.  **Nondeterministic ordering:** Iterating over maps/sets without sorting, or using timestamps in key generation. *Mitigation: Lint for unordered iteration; seed randoms.*
2.  **Provider handle leakage:** Returning an ARN or ResourceURL in the `PlanArtifact`. *Mitigation: Schema validation on output.*
3.  **Hidden state reads:** Adapter calls `describeInstances()` without recording it in inputs. *Mitigation: Mocked IO in conformance tests.*
4.  **Drift from policy:** Adapter "helpfully" auto-fixing a compliance violation instead of failing. *Mitigation: Strict inputs-only logic.*
5.  **Identity instability:** Regenerating a resource because the computed hash changed due to a new adapter version. *Mitigation: Semantic hashing.*

## 6) Conformance hooks

Conformance testing relies on standard fixtures.

*   **Given `fixture-plan-minimal`**: Assert `LoweredChangeSet` output is bitwise identical across 5 runs (Determinism).
*   **Given `fixture-plan-complex`**: Assert `Diagnostics` contains 0 items and `ResourceMap` covers all stable IDs (Completeness).
*   **Given `fixture-plan-invalid`**: Assert `Diagnostics` contains structured violation `code: INVALID_CONSTRAINT` (Structured Failure).
*   **Given `fixture-re-lower`**: Assert `ResourceMap` stable IDs mapped to same Provider IDs as previous run (Stability).
*   **Given `fixture-output-scan`**: Assert `PlanArtifact` contains NO strings matching provider regex (AWS ARNs, etc.) (Leakage Check).

*Fixtures location: `conformance/golden-cases/` or `conformance/fixtures/adapter/`*

## 7) Interfaces touched

*   **Directive Envelope Standard**: Source of truth for intent.
*   **Plan Artifact Envelope Standard**: The container for logic.
*   **Diagnostics/Violation Envelope Standard**: Error reporting format.
*   **Policy Evaluation Lifecycle ADR**: Rules for what is allowed.
*   **Configuration Precedence Chain ADR**: How config values are resolved.

## 8) Operational checklist

1.  **Validate Compatibility**: Check `PlanArtifact` version against Adapter version.
2.  **Load Config**: Deterministically load adapter configuration (resolving precedence).
3.  **Discovery (Read)**: Perform explicit discovery reads (if needed) and record in Provenance.
4.  **Lowering**: Translate intents to `LoweredChangeSet` operations.
5.  **Mapping**: Generate `ResourceMap` (Stable ID <-> Provider ID).
6.  **Verify**: Ensure no policy violations in the generated operations.
7.  **Emit**: Produce final artifacts (ChangeSet, Map, Provenance, Diagnostics).
8.  **Fail Safe**: If unknown capability or field encountered, fail closed.

## 9) Example

**Input (Kernel Intent):**
```json
{
  "stableId": "svc.api->svc.db:network",
  "intent": "allow-network",
  "source": "api",
  "target": "db",
  "port": 5432,
  "protocol": "tcp"
}
```

**Output (Lowered Operation):**
```json
{
  "operation": "create-network-rule",
  "provider": "aws",
  "resourceType": "security-rule",
  "inputs": {
    "from": "sg-api",
    "to": "sg-db",
    "port": 5432,
    "protocol": "tcp"
  },
  "stableId": "svc.api->svc.db:network"
}
```
*Note: Provider specifics (`sg-api`, `aws`) appear ONLY in the lowered output.*

## 10) Anti-patterns

*   **Refactoring Kernel Logic**: "The kernel forgot to validate X, so I'll do it here." (Wrong location).
*   **Ghost Reads**: Reading live cloud state but not including it in the `Inputs` hash.
*   **Time-based Keys**: Using `Date.now()` to generate a resource ID.
*   **Raw Error Strings**: Returning `stack trace: NullPointerException...` instead of a Violation envelope.
*   **Hardcoded Policy**: "I know we never allow port 22, so I'll just hardcode that check independently of the policy engine."
