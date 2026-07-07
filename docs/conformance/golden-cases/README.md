# Golden Cases

Golden conformance fixtures live in code, not in this directory:

- `packages/conformance/src/__tests__/golden-*.test.ts` — golden cases for
  binder directives, plans, policy audits, and one test per blueprint
  (`golden-blueprint-*.test.ts`).
- `packages/conformance/src/__tests__/__snapshots__/` — the golden snapshots
  those tests assert against.
- `packages/conformance/src/golden-runner.ts` — the shared runner that
  compiles a case and compares canonical output.

Run them with `pnpm nx test conformance`. To add a golden case for a new
blueprint, use `scripts/generate-golden-test.ts`.

See `docs/conformance/gates.md` for the gate-to-standard mapping this suite
enforces.
