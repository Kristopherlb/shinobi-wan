/**
 * Validates every blueprint and example manifest with the built CLI.
 * Run after build: pnpm build && pnpm blueprints:check
 */
import { execFileSync } from 'node:child_process';
import { readdirSync } from 'node:fs';
import { join } from 'node:path';

const CLI = 'packages/cli/dist/main.js';
const DIRS = [
  'blueprints/ai',
  'blueprints/compute',
  'blueprints/infra',
  'examples',
];

const manifests = DIRS.flatMap((dir) =>
  readdirSync(dir)
    .filter((f) => f.endsWith('.yaml') && !f.startsWith('_'))
    .map((f) => join(dir, f)),
);

if (manifests.length === 0) {
  console.error('blueprints-check: no manifests found');
  process.exit(1);
}

const failures = [];
for (const manifest of manifests) {
  try {
    execFileSync(process.execPath, [CLI, 'validate', manifest], {
      stdio: 'pipe',
    });
  } catch (err) {
    const stdout = err.stdout?.toString() ?? '';
    failures.push({ manifest, detail: stdout.trim() });
  }
}

if (failures.length > 0) {
  console.error(
    `blueprints-check FAILED (${failures.length}/${manifests.length}):`,
  );
  for (const { manifest, detail } of failures) {
    console.error(`\n--- ${manifest}\n${detail}`);
  }
  process.exit(1);
}

console.log(`blueprints-check passed (${manifests.length} manifests).`);
