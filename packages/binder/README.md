# @shinobi/binder

Edge compiler: deterministically maps binding/trigger/dependency edges to backend-neutral intents (IAM, network, config) with least-privilege defaults (KL-005).

## Install

```bash
pnpm add @shinobi/binder
```

## Usage

```ts
import {
  BinderRegistry,
  ComponentPlatformBinder,
  TriggersBinder,
} from '@shinobi/binder';

const registry = new BinderRegistry();
registry.register(new ComponentPlatformBinder());
registry.register(new TriggersBinder());
// register your own IBinder implementations for custom edge semantics
```

## Documentation

- [Integration guide](https://github.com/Kristopherlb/shinobi-wan/blob/main/docs/user/integration-guide.md) — embedding Shinobi in a platform
- [Support matrix](https://github.com/Kristopherlb/shinobi-wan/blob/main/docs/user/support-matrix.md) — component coverage and confidence tiers
- [Repository](https://github.com/Kristopherlb/shinobi-wan) — architecture, invariants, and development commands

## License

MIT
