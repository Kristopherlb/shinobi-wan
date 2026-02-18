# Harmony Determinism Verification Report (2026-02-17)

## Objective

Verify repeatability for Harmony-facing contracts and remove drift in plan/apply fingerprint handling.

## TDD Change Applied

- Added wrapper test coverage for fingerprint stability when `manifestPath` has surrounding whitespace.
- Implemented input normalization in `packages/cli/src/mcp/wrapper.ts` so plan/apply/read/validate paths use trimmed manifest paths consistently.

## Test Evidence

Command executed:

```bash
pnpm vitest run \
  packages/cli/src/integration/__tests__/contract.test.ts \
  packages/cli/src/integration/__tests__/envelope.test.ts \
  packages/cli/src/integration/__tests__/async-handle.test.ts \
  packages/cli/src/mcp/__tests__/wrapper.test.ts
```

Observed result:

- Test files: `4 passed`
- Tests: `27 passed`
- Determinism-relevant assertions validated:
  - async handle deterministic for identical input
  - wrapper apply/plan fingerprint consistency under path normalization
  - canonical operation class and terminal retryability maps unchanged

## CLI Repeat-Run Note

Direct repeat-run checks against `packages/cli/dist/main.js` were attempted and blocked by missing runtime module `@pulumi/pulumi` in this execution environment.

Blocked command:

```bash
node packages/cli/dist/main.js validate examples/lambda-sqs.yaml --json
```

Error:

- `Error: Cannot find module '@pulumi/pulumi'`

## Operational Conclusion

- Contract-level and wrapper-level determinism checks are green.
- Runtime CLI repeatability checks should be rerun in the target release environment where Pulumi runtime dependencies are installed.
