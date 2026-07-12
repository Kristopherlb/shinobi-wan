# @shinobi/validation

Validation pipeline (schema → semantic → determinism) with structured, stable-path errors (KL-002/KL-006). Validates graph snapshots and intents.

## Install

```bash
pnpm add @shinobi/validation
```

## Usage

Usually consumed indirectly through `@shinobi/kernel`, which runs this
pipeline during `compile()`. Install directly to run individual validators in
custom tooling.

## Documentation

- [Integration guide](https://github.com/Kristopherlb/shinobi-wan/blob/main/docs/user/integration-guide.md) — embedding Shinobi in a platform
- [Support matrix](https://github.com/Kristopherlb/shinobi-wan/blob/main/docs/user/support-matrix.md) — component coverage and confidence tiers
- [Repository](https://github.com/Kristopherlb/shinobi-wan) — architecture, invariants, and development commands

## License

MIT
