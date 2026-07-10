# Harmony integration: consumption contract

This document describes how Harmony (or any external consumer) can install and use Shinobi WAN’s public packages and kernel facade for plan/apply and envelope-based tool responses.

## Public packages

| Package              | Purpose                                                               | Stable API surface                                                          |
| -------------------- | --------------------------------------------------------------------- | --------------------------------------------------------------------------- |
| `@shinobi/contracts` | Type definitions, capability/intent/violation contracts               | Exported types and constants                                                |
| `@shinobi/ir`        | Graph IR: Node, Edge, DerivedArtifact, Graph, ordering, serialization | Exported types and functions                                                |
| `@shinobi/kernel`    | Graph engine, compilation pipeline, **kernel facade**                 | Kernel class, `compilePipeline`, **facade methods** and **contractVersion** |

Policy, binder, conformance, and adapters are **not** part of the public consumption contract for this first pass.

## Install and pinning

- **From Git (tag or SHA)**  
  Install the repo and use workspace packages from built `dist/`:

  ```bash
  pnpm add github:Owner/shinobi-wan#v0.1.0
  ```

  The root `prepare` script runs `nx run-many -t build`, so after `pnpm install` the public packages (and validation, used by kernel) are built and their `dist/` artifacts are available.

- **Pinning**  
  Pin by tag (e.g. `#v0.1.0`) or full SHA (e.g. `#a1b2c3d`) for reproducible installs. Avoid branch names for production.

## Kernel facade API

The kernel exposes a **facade** for tool-style invocation: JSON-serializable inputs and outputs, mode split (plan vs apply), and a stable envelope.

### Contract version

- **Export:** `contractVersion` (string, e.g. `"1.0.0"`).
- **Use:** Consumers can assert or log the facade contract version for compatibility.

### Facade methods (all return `Promise<ToolResponseEnvelope<...>>`)

| Method                | Purpose                                                                                                     | Mode / notes                                                    |
| --------------------- | ----------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------- |
| `validatePlan(input)` | Validate a graph snapshot; returns full structured diagnostics (`valid`, `errorCount`, `errors[]`)          | `input.mode` must be `'plan'`                                   |
| `planChange(input)`   | Validate the snapshot and compute the deterministic planned state (entity counts + canonical semantic hash) | `input.mode` must be `'plan'`                                   |
| `applyChange(input)`  | Apply graph mutations in memory on the snapshot; reports applied/skipped counts and resulting graph summary | `input.mode` must be `'apply'`                                  |
| `readEntities(input)` | Canonical projection (`id`, `kind`, `type`) of the entities in the provided snapshot                        | Empty list when no snapshot is provided                         |
| `readActivity(input)` | Read activity (read-only)                                                                                   | Always empty: the facade is stateless and has no activity store |

### Input shape (common)

- **`traceId`** (optional): Correlation id for the call.
- **`mode`**: `'plan'` or `'apply'` where required (enforced; wrong mode returns error envelope).
- **`snapshot`**: For validate/plan/apply, a graph snapshot-like object (e.g. `{ nodes, edges, artifacts }`).

### Envelope shape (JSON-serializable)

Every facade method returns a **tool response envelope**:

- **`success`**: boolean.
- **`metadata`**: `toolId`, `contractVersion`, `operationClass` (`'read' | 'plan' | 'apply'`), `traceId`. No timestamp: envelopes are byte-stable for identical inputs (KL-001).
- **`data`**: Present on success; payload type depends on the method.
- **`error`**: Present on failure; `code`, `category`, `source`, `traceId`, `message`, `retriable`, etc.

Envelopes are deterministic (no random IDs in the contract) and safe to log/redact for security-sensitive environments.

## Local plan/apply execution model

- **Plan mode**  
  Use `validatePlan` and `planChange` with `mode: 'plan'`. No mutations or side effects; safe to run in restricted environments.

- **Apply mode**  
  Use `applyChange` with `mode: 'apply'`. The kernel facade applies graph mutations in memory (idempotent; conflicts return a `CONFLICT` error envelope) and reports the resulting graph summary. Deployment-level side effects are wired through the CLI and adapter layers, in environments where Pulumi and provider SDKs are available.

- **Security**  
  Consumers should enforce mode split (e.g. only allow `plan` in sandboxed or read-only contexts) and apply safe output/error redaction before forwarding envelopes to untrusted clients.

## Validation matrix (consumer contract)

The following must pass for a consumer-ready install:

- `pnpm install`
- `pnpm build`
- `pnpm test`
- `pnpm lint`
- `pnpm conformance` (if enabled)
- `pnpm smoke:consumer`

The repo’s `scripts/consumer-smoke.mjs` imports from `@shinobi/kernel`, runs `validatePlan` and `planChange` against a fixture, and asserts envelope structure and deterministic keys. CI runs this as part of the main test job.

## See also

- `docs/operations/harmony-integration-user-guide.md` — Step-by-step integration.
- `docs/operations/harmony-integration.md` — Envelope contract and compatibility.
- `.changeset/README.md` — Versioning and tag-based release flow.
