// Packaging verification for all publishable packages:
//   1. publint  — manifest/exports correctness against the packed file list
//   2. attw     — "are the types wrong" resolution matrix (per-format profile)
//   3. tarball smoke — pack the kernel dependency chain with `pnpm pack`
//      (which rewrites workspace:* specifiers), install the tarballs into a
//      fresh fixture project with npm, and exercise the public API.
// Requires packages to be built first (dist/ present). Run: pnpm pack:check
import { execSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const ROOT = process.cwd();

const PACKAGES = [
  { dir: 'packages/contracts', profile: 'esm-only' },
  { dir: 'packages/ir', profile: 'esm-only' },
  { dir: 'packages/validation', profile: 'esm-only' },
  { dir: 'packages/kernel', profile: 'esm-only' },
  { dir: 'packages/binder', profile: 'esm-only' },
  { dir: 'packages/policy', profile: 'esm-only' },
  { dir: 'packages/conformance', profile: 'esm-only' },
  { dir: 'packages/adapters/aws', profile: 'esm-only' },
  { dir: 'packages/cli', profile: 'node16' },
];

const run = (cmd, opts = {}) =>
  execSync(cmd, { stdio: 'inherit', cwd: ROOT, ...opts });

let step = 'publint';
try {
  for (const p of PACKAGES) {
    console.log(`\n== publint ${p.dir}`);
    run(`pnpm exec publint ${p.dir} --strict`);
  }

  step = 'attw';
  for (const p of PACKAGES) {
    console.log(`\n== attw ${p.dir} (${p.profile})`);
    run(`pnpm exec attw --pack ${p.dir} --profile ${p.profile}`);
  }

  step = 'tarball smoke';
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'shinobi-pack-'));
  const tarballs = {};
  for (const dir of [
    'packages/contracts',
    'packages/ir',
    'packages/validation',
    'packages/kernel',
  ]) {
    const out = execSync(`pnpm pack --pack-destination ${tmp}`, {
      cwd: path.join(ROOT, dir),
      encoding: 'utf8',
    }).trim();
    const file = out.split('\n').pop();
    const name = JSON.parse(
      fs.readFileSync(path.join(ROOT, dir, 'package.json'), 'utf8'),
    ).name;
    tarballs[name] = file;
  }

  const fixture = path.join(tmp, 'fixture');
  fs.mkdirSync(fixture);
  fs.writeFileSync(
    path.join(fixture, 'package.json'),
    JSON.stringify(
      {
        name: 'pack-smoke-fixture',
        private: true,
        type: 'module',
        dependencies: {
          '@shinobi/kernel': `file:${tarballs['@shinobi/kernel']}`,
        },
        overrides: Object.fromEntries(
          Object.entries(tarballs).map(([n, f]) => [n, `file:${f}`]),
        ),
      },
      null,
      2,
    ),
  );
  run('npm install --no-audit --no-fund --loglevel=error', { cwd: fixture });

  fs.writeFileSync(
    path.join(fixture, 'smoke.mjs'),
    `import { Kernel } from '@shinobi/kernel';
const kernel = new Kernel({ binders: [], evaluators: [] });
const result = kernel.compile();
if (!result || typeof result !== 'object' || !('validation' in result)) {
  throw new Error('kernel.compile() did not return a structured result');
}
console.log('tarball smoke OK: kernel compiled from packed tarballs');
`,
  );
  run('node smoke.mjs', { cwd: fixture });

  // Types must be present in the installed tarball, not just at build time.
  const dts = path.join(
    fixture,
    'node_modules/@shinobi/validation/dist/index.d.ts',
  );
  if (!fs.existsSync(dts)) {
    throw new Error('validation .d.ts missing from installed tarball');
  }

  fs.rmSync(tmp, { recursive: true, force: true });
  console.log('\npack-check passed: publint + attw + tarball smoke.');
} catch (e) {
  console.error(`\npack-check FAILED during ${step}: ${e.message}`);
  process.exit(1);
}
