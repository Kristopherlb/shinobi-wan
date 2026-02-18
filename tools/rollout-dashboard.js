const fs = require('fs');
const path = require('path');

const ROOT = process.cwd();
const GATES_PATH = path.join(ROOT, 'docs', 'operations', 'harmony-go-live-gates.md');
const OUTPUT_PATH = path.join(ROOT, 'docs', 'operations', 'harmony-rollout-dashboard.md');
const VALID_STATUSES = new Set(['pass', 'fail', 'blocked', 'on-track', 'at-risk']);

function parseGateRows(content) {
  const rows = [];
  const lines = content.split('\n');
  let inTable = false;

  for (const line of lines) {
    if (!inTable && line.startsWith('| Gate |')) {
      inTable = true;
      continue;
    }
    if (!inTable) continue;
    if (!line.startsWith('|')) break;
    if (line.startsWith('|---')) continue;

    const cols = line.split('|').map((v) => v.trim()).filter(Boolean);
    if (cols.length >= 7) {
      rows.push({
        gate: cols[0],
        phase: cols[1],
        owner: cols[2],
        status: cols[3],
        passCondition: cols[4],
        blocker: cols[5],
        evidence: cols[6],
      });
    }
  }

  return rows;
}

function buildDashboard(rows) {
  const count = (status) => rows.filter((row) => row.status === status).length;
  const passCount = count('pass');
  const blockedCount = count('blocked');
  const atRiskCount = count('at-risk');
  const onTrackCount = count('on-track');
  const failCount = count('fail');

  const rowText = rows
    .map(
      (row) =>
        `| ${row.gate} | ${row.phase} | ${row.owner} | ${row.status} | ${row.evidence} |`,
    )
    .join('\n');

  return `# Harmony Rollout Dashboard

Generated at: ${new Date().toISOString()}

## Status Summary

- Total gates: ${rows.length}
- Pass: ${passCount}
- On-track: ${onTrackCount}
- At-risk: ${atRiskCount}
- Blocked: ${blockedCount}
- Fail: ${failCount}

## Gate Detail

| Gate | Phase | Owner | Status | Evidence |
|---|---|---|---|---|
${rowText}
`;
}

function buildSummary(rows) {
  const count = (status) => rows.filter((row) => row.status === status).length;
  return {
    total: rows.length,
    pass: count('pass'),
    fail: count('fail'),
    blocked: count('blocked'),
    onTrack: count('on-track'),
    atRisk: count('at-risk'),
  };
}

function main() {
  const write = process.argv.includes('--write');
  const check = process.argv.includes('--check');
  const content = fs.readFileSync(GATES_PATH, 'utf8');
  const rows = parseGateRows(content);
  if (rows.length === 0) {
    throw new Error('No gate rows parsed from harmony-go-live-gates.md');
  }
  for (const row of rows) {
    if (!VALID_STATUSES.has(row.status)) {
      throw new Error(`Invalid gate status '${row.status}' for gate '${row.gate}'`);
    }
  }

  const dashboard = buildDashboard(rows);
  const summary = buildSummary(rows);
  if (write) {
    fs.writeFileSync(OUTPUT_PATH, dashboard, 'utf8');
    console.log(`Wrote rollout dashboard: ${path.relative(ROOT, OUTPUT_PATH)}`);
  } else if (check) {
    console.log(JSON.stringify(summary, null, 2));
  } else {
    console.log(dashboard);
  }
}

main();
