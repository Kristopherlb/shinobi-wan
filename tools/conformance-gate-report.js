const fs = require('fs');
const path = require('path');

const ROOT = process.cwd();
const GATES_DOC = path.join(ROOT, 'docs', 'conformance', 'gates.md');
const TEST_DIR = path.join(ROOT, 'packages', 'conformance', 'src', '__tests__');
const REPORT_PATH = path.join(ROOT, 'docs', 'conformance', 'gate-coverage-report.md');

function listFiles(dir, out = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      listFiles(full, out);
    } else if (entry.isFile() && entry.name.endsWith('.test.ts')) {
      out.push(full);
    }
  }
  return out;
}

function extractRegisteredGates(content) {
  const ids = new Set();
  for (const line of content.split('\n')) {
    const match = line.match(/^\|\s*(G-\d+)\s*\|/);
    if (match) ids.add(match[1]);
  }
  return [...ids].sort();
}

function extractCoveredGatesFromTest(content) {
  const ids = new Set();
  const gatesArrayRegex = /gates:\s*\[([^\]]*)\]/g;
  let match;
  while ((match = gatesArrayRegex.exec(content)) !== null) {
    const block = match[1];
    for (const gate of block.match(/G-\d+/g) ?? []) {
      ids.add(gate);
    }
  }
  return [...ids];
}

function collectCoverage() {
  const registered = extractRegisteredGates(fs.readFileSync(GATES_DOC, 'utf8'));
  const testFiles = listFiles(TEST_DIR);
  const coveredSet = new Set();
  const perFile = [];

  for (const file of testFiles) {
    const content = fs.readFileSync(file, 'utf8');
    const gates = [...new Set(extractCoveredGatesFromTest(content))].sort();
    perFile.push({
      file: path.relative(ROOT, file),
      gates,
    });
    for (const gate of gates) coveredSet.add(gate);
  }

  const covered = [...coveredSet].sort();
  const uncovered = registered.filter((gate) => !coveredSet.has(gate));
  const coveragePct = registered.length === 0
    ? 100
    : Math.round((covered.length / registered.length) * 100);

  return {
    registered,
    covered,
    uncovered,
    coveragePct,
    perFile: perFile.sort((a, b) => a.file.localeCompare(b.file)),
  };
}

function renderReport(result) {
  const now = new Date().toISOString();
  const uncoveredText = result.uncovered.length > 0 ? result.uncovered.join(', ') : '(none)';
  const coveredText = result.covered.join(', ');
  const table = result.perFile
    .map((entry) => `| \`${entry.file}\` | ${entry.gates.length > 0 ? entry.gates.join(', ') : '(none)'} |`)
    .join('\n');

  return `# Conformance Gate Coverage Report

Generated at: ${now}

## Summary

- Registered gates: ${result.registered.length}
- Covered gates: ${result.covered.length}
- Coverage: ${result.coveragePct}%
- Uncovered gates: ${uncoveredText}

Covered gate IDs:

${coveredText}

## Coverage by Test File

| Test File | Gate IDs |
|---|---|
${table}
`;
}

function main() {
  const write = process.argv.includes('--write');
  const result = collectCoverage();

  if (write) {
    fs.writeFileSync(REPORT_PATH, renderReport(result), 'utf8');
    console.log(`Wrote coverage report: ${path.relative(ROOT, REPORT_PATH)}`);
  }

  console.log(
    JSON.stringify(
      {
        registered: result.registered.length,
        covered: result.covered.length,
        uncovered: result.uncovered,
        coveragePct: result.coveragePct,
      },
      null,
      2,
    ),
  );
}

main();
