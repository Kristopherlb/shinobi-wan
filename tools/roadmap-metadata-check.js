const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const ROOT = process.cwd();
const ROADMAP_PATH = path.join(ROOT, 'docs', 'operations', 'current-roadmap.md');
const GATE_REPORT_SCRIPT = path.join(ROOT, 'tools', 'conformance-gate-report.js');

function extractTableRows(content, sectionHeading) {
  const sectionIdx = content.indexOf(sectionHeading);
  if (sectionIdx === -1) return [];
  const section = content.slice(sectionIdx);
  const lines = section.split('\n');
  const rows = [];
  let inTable = false;

  for (const line of lines) {
    if (!inTable && line.startsWith('|')) {
      inTable = true;
      rows.push(line);
      continue;
    }
    if (inTable) {
      if (!line.startsWith('|')) break;
      if (line.startsWith('|---')) continue;
      rows.push(line);
    }
  }

  return rows;
}

function assertRequiredColumns(headerRow) {
  const required = ['Work Item', 'Owner', 'Target Window', 'Status', 'Blockers', 'Exit Criteria'];
  for (const column of required) {
    if (!headerRow.includes(column)) {
      throw new Error(`Roadmap missing required execution control column: ${column}`);
    }
  }
}

function assertNonEmptyTableCells(rows, sectionName) {
  for (const row of rows) {
    const cols = row
      .split('|')
      .map((cell) => cell.trim())
      .filter((cell) => cell.length > 0);
    if (cols.length < 6) {
      throw new Error(`Roadmap row in ${sectionName} is malformed: ${row}`);
    }
    if (cols.some((cell) => cell === '-' || cell.length === 0)) {
      throw new Error(`Roadmap row in ${sectionName} has empty execution metadata: ${row}`);
    }
  }
}

function parseRoadmapGateClaim(content) {
  const claimMatch = content.match(/coverage is `(\d+)\/(\d+)` gates/);
  if (!claimMatch) {
    throw new Error('Roadmap must declare conformance coverage claim in the format `X/Y` gates.');
  }
  return {
    covered: Number.parseInt(claimMatch[1], 10),
    registered: Number.parseInt(claimMatch[2], 10),
  };
}

function getComputedGateCoverage() {
  const result = spawnSync('node', [GATE_REPORT_SCRIPT], { cwd: ROOT, encoding: 'utf8' });
  if (result.status !== 0) {
    throw new Error(`Failed to compute conformance gate coverage: ${result.stderr || result.stdout}`);
  }
  const trimmed = result.stdout.trim();
  const jsonStart = trimmed.lastIndexOf('{');
  if (jsonStart === -1) {
    throw new Error('Could not parse conformance gate report output for governance check.');
  }
  const report = JSON.parse(trimmed.slice(jsonStart));
  return {
    covered: Number(report.covered),
    registered: Number(report.registered),
  };
}

function main() {
  const content = fs.readFileSync(ROADMAP_PATH, 'utf8');

  const trackA = extractTableRows(content, '### Execution Control (Track A)');
  const trackB = extractTableRows(content, '### Execution Control (Track B)');

  if (trackA.length < 2 || trackB.length < 2) {
    throw new Error('Roadmap execution control tables are missing or incomplete.');
  }

  assertRequiredColumns(trackA[0]);
  assertRequiredColumns(trackB[0]);

  assertNonEmptyTableCells(trackA.slice(1), 'Track A');
  assertNonEmptyTableCells(trackB.slice(1), 'Track B');

  if (!content.includes('`on-track`, `at-risk`, or `blocked`')) {
    throw new Error('Roadmap must define weekly status taxonomy.');
  }

  const claimed = parseRoadmapGateClaim(content);
  const computed = getComputedGateCoverage();
  if (claimed.covered !== computed.covered || claimed.registered !== computed.registered) {
    throw new Error(
      `Roadmap conformance claim mismatch: roadmap=${claimed.covered}/${claimed.registered}, computed=${computed.covered}/${computed.registered}`,
    );
  }

  console.log('roadmap-metadata-check passed.');
}

main();
