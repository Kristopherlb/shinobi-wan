# Programmatic Embedding Example

Runs the validate → plan → explain pipeline through the library API instead
of the `shinobi` binary — the starting point for platform teams embedding
Shinobi (see `../../docs/user/integration-guide.md`).

```bash
pnpm build           # from the repo root, once
node examples/programmatic/plan.mjs
```

In your own codebase, install `@shinobi/cli` (and `@shinobi/kernel` for the
why-report) from npm; the imports are identical.
