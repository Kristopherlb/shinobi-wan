## ADR-006: Harmony MCP-first integration through wrapper boundary

- Status: accepted
- Date: 2026-02-16
- Decision Makers: Platform Engineering
- Technical Area: cli|adapter|integration
- Related Artifacts: `packages/cli/src/integration`, `packages/cli/src/mcp`, `docs/operations/harmony-integration.md`

### Context
Harmony integration requires composable atomic tools with deterministic contracts, strict auditability, and limited blast radius. In-process SDK coupling is not acceptable as the default production path.

### Decision
Adopt MCP-first integration backed by a Shinobi wrapper/service boundary:

- Atomic tool decomposition: `validate`, `plan`, `apply`.
- Read/plan tools enabled first.
- Apply/rollback paths restricted, approval-gated, and async-first.
- Unified deterministic response/error envelopes with operation-class policies.

### Consequences
- Positive:
  - Strong fault isolation and upgrade safety.
  - Clear composition boundaries for Harmony workflows.
  - Deterministic envelopes improve audit and automation reliability.
- Negative:
  - Wrapper introduces additional integration layer.
  - Rollback remains wrapper-managed compensation until native API exists.

### TDD / Verification
- Red:
  - Added failing tests for envelope mapping, wrapper tool mapping, async handle behavior, and restricted apply gating.
- Green:
  - Implemented integration policy/envelope modules and wrapper tool router.
- Refactor:
  - Kept existing CLI output behavior stable; added opt-in harmony envelope mode.
- Evidence:
  - `pnpm nx test cli`
  - `pnpm nx test adapter-aws`

### Follow-ups
- Request Harmony-owned wiring specifics (approver role map, queue/workflow names, status endpoint shape, final flags/metric names).
- Promote restricted apply only after rollout checklist gates are green.
- Replace wrapper-managed rollback with native first-class rollback contract when available.
