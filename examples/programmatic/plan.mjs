// Programmatic embedding example: validate a manifest and generate a plan
// without the CLI binary. Run from the repo root after `pnpm build`:
//
//   node examples/programmatic/plan.mjs
//
// In your own platform, install the packages instead:
//   pnpm add @shinobi/cli
// and import identically — `@shinobi/cli` exposes the same functions the
// binary runs, returning structured objects instead of printing.
import { validate, plan } from '@shinobi/cli';
import { explainCompilation } from '@shinobi/kernel';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const manifestPath = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '../lambda-sqs.yaml',
);

// 1. Validate: parse → compile → policy-check. Structured result, no printing.
const validation = validate({
  manifestPath,
  policyPack: 'Baseline',
  environment: 'dev',
});
if (!validation.success) {
  console.error('validation failed:', validation.errors);
  process.exit(1);
}
console.log(
  `validated service "${validation.manifest.service}" — ` +
    `${validation.manifest.components} components, ` +
    `${validation.policy?.violationCount ?? 0} policy findings`,
);

// 2. Plan: lower intents to AWS resources and build a deterministic plan.
const deployment = plan({ manifestPath, region: 'us-east-1' });
if (!deployment.success || !deployment.plan) {
  console.error('plan failed:', deployment.errors);
  process.exit(1);
}
console.log(`planned ${deployment.plan.resources.length} resources:`);
for (const r of deployment.plan.resources) {
  console.log(`  + ${r.resourceType} "${r.name}"`);
}

// 3. Explain: trace every intent and finding back to its cause (KL-006).
const why = explainCompilation(validation.compilation);
console.log(`why-report: ${why.entries.length} entries`);
for (const entry of why.entries.slice(0, 3)) {
  console.log(`  [${entry.kind}] ${entry.subject}`);
}
