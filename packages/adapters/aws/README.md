# @shinobi/adapter-aws

AWS adapter: lowers backend-neutral intents and platform nodes to Pulumi AWS resources (55 node lowerers + 4 intent lowerers), generates deterministic resource plans, and deploys via the Pulumi Automation API. Depends only on @shinobi/contracts and @shinobi/ir; @pulumi/pulumi and @pulumi/aws are peer dependencies.

## Install

```bash
pnpm add @shinobi/adapter-aws
```

## Usage

```ts
import { lower, generatePlan } from '@shinobi/adapter-aws';

const result = lower({
  intents,
  snapshot,
  adapterConfig: { region: 'us-east-1', serviceName: 'orders' },
});
const plan = generatePlan(result);
```

## Documentation

- [Integration guide](https://github.com/Kristopherlb/shinobi-wan/blob/main/docs/user/integration-guide.md) — embedding Shinobi in a platform
- [Support matrix](https://github.com/Kristopherlb/shinobi-wan/blob/main/docs/user/support-matrix.md) — component coverage and confidence tiers
- [Repository](https://github.com/Kristopherlb/shinobi-wan) — architecture, invariants, and development commands

## License

MIT
