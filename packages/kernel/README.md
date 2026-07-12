# @shinobi/kernel

Graph engine and orchestrator: mutation API, four-phase compilation pipeline (validate → bind → policy → freeze), config resolution (KL-007), and the stateless facade (validatePlan, planChange, applyChange, readEntities).

## Install

```bash
pnpm add @shinobi/kernel
```

## Usage

```ts
import { Kernel } from '@shinobi/kernel';

const kernel = new Kernel({
  binders,
  evaluators,
  config: { policyPack: 'Baseline' },
});
kernel.applyMutation(mutations);
const compilation = kernel.compile();
// compilation.validation / .policy / .intents / .snapshot — all deterministic
```

## Documentation

- [Integration guide](https://github.com/Kristopherlb/shinobi-wan/blob/main/docs/user/integration-guide.md) — embedding Shinobi in a platform
- [Support matrix](https://github.com/Kristopherlb/shinobi-wan/blob/main/docs/user/support-matrix.md) — component coverage and confidence tiers
- [Repository](https://github.com/Kristopherlb/shinobi-wan) — architecture, invariants, and development commands

## License

MIT
