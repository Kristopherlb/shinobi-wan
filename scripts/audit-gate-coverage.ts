#!/usr/bin/env npx tsx
/**
 * Conformance Gate Coverage Report
 *
 * Parses docs/conformance/gates.md for gate IDs (G-001 through G-042),
 * scans conformance test files for references, and reports covered vs uncovered.
 *
 * Usage: npx tsx --tsconfig tsconfig.scripts.json scripts/audit-gate-coverage.ts
 */

import * as fs from 'node:fs';
import * as path from 'node:path';

interface GateDefinition {
  gateId: string;
  standardRef: string;
  type: string;
  description: string;
}

interface TestReference {
  file: string;
  testName: string;
}

interface CoveredGate {
  gateId: string;
  type: string;
  tests: TestReference[];
}

interface UncoveredGate {
  gateId: string;
  type: string;
  description: string;
}

interface CoverageReport {
  covered: CoveredGate[];
  uncovered: UncoveredGate[];
  stats: {
    total: number;
    covered: number;
    percentage: number;
  };
}

/**
 * Parse gates.md markdown table to extract gate definitions.
 */
function parseGatesFile(gatesPath: string): Map<string, GateDefinition> {
  const content = fs.readFileSync(gatesPath, 'utf8');
  const gates = new Map<string, GateDefinition>();

  // Match table rows: | G-001 | S1, S13 | SCHEMA | Graph IR validates against schema |
  const rowRegex = /^\|\s*(G-\d{3})\s*\|\s*([^|]+)\|\s*([^|]+)\|\s*([^|]+)\|/gm;
  let match: RegExpExecArray | null;

  while ((match = rowRegex.exec(content)) !== null) {
    const gateId = match[1].trim();
    gates.set(gateId, {
      gateId,
      standardRef: match[2].trim(),
      type: match[3].trim(),
      description: match[4].trim(),
    });
  }

  return gates;
}

/**
 * Scan a test file for gate ID references and extract surrounding test names.
 */
function scanTestFile(filePath: string): Map<string, TestReference[]> {
  const content = fs.readFileSync(filePath, 'utf8');
  const fileName = path.basename(filePath);
  const refs = new Map<string, TestReference[]>();

  const lines = content.split('\n');

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const gateMatches = line.matchAll(/G-\d{3}/g);

    for (const gateMatch of gateMatches) {
      const gateId = gateMatch[0];

      // Find the closest enclosing it() or describe() test name
      let testName = '';
      for (let j = i; j >= 0; j--) {
        const itMatch = lines[j].match(/it\(\s*[`'"](.*?)[`'"]/);
        if (itMatch) {
          testName = itMatch[1];
          break;
        }
        const describeMatch = lines[j].match(/describe\(\s*[`'"](.*?)[`'"]/);
        if (describeMatch && j < i) {
          testName = describeMatch[1];
          break;
        }
      }

      if (!testName) {
        // Fall back: might be in a comment or gates array
        testName = line.trim();
      }

      const existing = refs.get(gateId) ?? [];
      // Deduplicate by testName within the same file
      if (!existing.some((r) => r.testName === testName)) {
        existing.push({ file: fileName, testName });
      }
      refs.set(gateId, existing);
    }
  }

  return refs;
}

// Main
const rootDir = process.cwd();
const gatesPath = path.join(rootDir, 'docs/conformance/gates.md');

if (!fs.existsSync(gatesPath)) {
  console.error(`Gates file not found: ${gatesPath}`);
  process.exit(1);
}

const gates = parseGatesFile(gatesPath);

if (gates.size === 0) {
  console.error('No gates found in gates.md');
  process.exit(1);
}

// Scan all conformance test files (excluding snapshots)
const conformanceTestDir = path.join(
  rootDir,
  'packages/conformance/src/__tests__',
);
const testFiles: string[] = [];

function findTestFiles(dir: string): void {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.isDirectory()) {
      // Skip __snapshots__
      if (entry.name === '__snapshots__') continue;
      findTestFiles(path.join(dir, entry.name));
    } else if (entry.name.endsWith('.test.ts')) {
      testFiles.push(path.join(dir, entry.name));
    }
  }
}

findTestFiles(conformanceTestDir);

// Aggregate gate references across all test files
const allRefs = new Map<string, TestReference[]>();

for (const testFile of testFiles) {
  const fileRefs = scanTestFile(testFile);
  for (const [gateId, refs] of fileRefs) {
    const existing = allRefs.get(gateId) ?? [];
    existing.push(...refs);
    allRefs.set(gateId, existing);
  }
}

// Build report
const covered: CoveredGate[] = [];
const uncovered: UncoveredGate[] = [];

for (const [gateId, gate] of gates) {
  const refs = allRefs.get(gateId);
  if (refs && refs.length > 0) {
    covered.push({ gateId, type: gate.type, tests: refs });
  } else {
    uncovered.push({ gateId, type: gate.type, description: gate.description });
  }
}

// Sort by gate ID
covered.sort((a, b) => a.gateId.localeCompare(b.gateId));
uncovered.sort((a, b) => a.gateId.localeCompare(b.gateId));

const total = gates.size;
const coveredCount = covered.length;
const percentage = Math.round((coveredCount / total) * 100);

// Print report
console.log('Gate Coverage Report');
console.log('====================');

for (const [gateId, gate] of [...gates.entries()].sort(([a], [b]) =>
  a.localeCompare(b),
)) {
  const refs = allRefs.get(gateId);
  const typeLabel = gate.type.padEnd(12);

  if (refs && refs.length > 0) {
    // Group by file
    const fileGroups = new Map<string, number>();
    for (const ref of refs) {
      fileGroups.set(ref.file, (fileGroups.get(ref.file) ?? 0) + 1);
    }
    const fileSummary = [...fileGroups.entries()]
      .map(([f, count]) => `${f} (${count} tests)`)
      .join(', ');
    console.log(`${gateId}  ${typeLabel} \u2705  ${fileSummary}`);
  } else {
    console.log(`${gateId}  ${typeLabel} \u274C  NOT COVERED`);
  }
}

console.log();
console.log(`Summary: ${coveredCount}/${total} gates covered (${percentage}%)`);

// JSON output for CI
const report: CoverageReport = {
  covered,
  uncovered,
  stats: { total, covered: coveredCount, percentage },
};

const reportPath = path.join(rootDir, 'gate-coverage-report.json');
fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
console.log(`\nJSON report written to: ${reportPath}`);
