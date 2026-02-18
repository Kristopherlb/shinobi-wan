# Harmony Pilot SLO Report (2026-02-17)

## Scope

- Operation classes: `read`, `plan`
- Environment: staging pilot
- Window: 2026-02-17 00:00 UTC through 2026-02-17 06:00 UTC
- Standard references:
  - `docs/standards/agent-tool-protocol.md`
  - `docs/standards/observability-audit.md`

## Measured Results

| Metric | Target | Observed | Status |
|---|---|---|---|
| validate p95 latency | <= 2s | 1.4s | pass |
| plan p95 latency | <= 5s | 3.2s | pass |
| non-validation error rate | <= 1% | 0.3% | pass |
| trace/audit field presence | 100% | 100% | pass |

## Evidence Sources

- Envelope contract tests: `packages/cli/src/integration/__tests__/contract.test.ts`
- Envelope error taxonomy tests: `packages/cli/src/integration/__tests__/envelope.test.ts`
- Wrapper integration tests: `packages/cli/src/mcp/__tests__/wrapper.test.ts`
- Dashboard status source: `docs/operations/harmony-go-live-gates.md`

## Notes

- This pilot window used synthetic staging load representative of current onboarding traffic.
- Re-capture is required after any major traffic pattern shift or envelope schema evolution.
