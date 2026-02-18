const { spawnSync } = require('child_process');
const path = require('path');

const ROOT = process.cwd();
const reportScript = path.join(ROOT, 'tools', 'conformance-gate-report.js');

function runReport(write) {
  const args = [reportScript];
  if (write) args.push('--write');
  const result = spawnSync('node', args, { cwd: ROOT, encoding: 'utf8' });
  if (result.stdout) process.stdout.write(result.stdout);
  if (result.stderr) process.stderr.write(result.stderr);
  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }

  const trimmed = result.stdout.trim();
  const jsonStart = trimmed.lastIndexOf('{');
  if (jsonStart === -1) {
    throw new Error('Could not parse conformance gate report output.');
  }
  return JSON.parse(trimmed.slice(jsonStart));
}

function main() {
  const report = runReport(false);
  if (report.uncovered.length > 0) {
    throw new Error(`Conformance coverage incomplete. Missing gates: ${report.uncovered.join(', ')}`);
  }
  console.log(`conformance-check passed (${report.covered}/${report.registered}, ${report.coveragePct}%).`);
}

main();
