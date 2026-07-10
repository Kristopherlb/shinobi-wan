#!/usr/bin/env npx tsx
/**
 * Policy Rule Generator Script
 *
 * Prints the boilerplate additions needed for a new policy rule.
 * Rules follow the data-driven pattern (KL-008) — no code branches on pack name.
 *
 * Usage:
 *   npx tsx scripts/generate-policy-rule.ts \
 *     --rule-id sqs-dlq-missing \
 *     --rule-name "SQS DLQ Missing" \
 *     --baseline info \
 *     --moderate warning \
 *     --high error
 */

const args = process.argv.slice(2);

function getArg(name: string): string {
  const idx = args.indexOf(`--${name}`);
  if (idx === -1 || !args[idx + 1]) {
    console.error(`Missing required argument: --${name}`);
    process.exit(1);
  }
  return args[idx + 1];
}

const ruleId = getArg("rule-id");
const ruleName = getArg("rule-name");
const baseline = getArg("baseline");
const moderate = getArg("moderate");
const high = getArg("high");

console.log("=== Add to RULE_CATALOG in rules.ts ===");
console.log(`  {
    ruleId: '${ruleId}',
    ruleName: '${ruleName}',
    description: 'TODO: describe this rule',
    remediation: {
      summary: 'TODO: remediation guidance',
      autoFixable: false,
    },
  },`);

console.log("");
console.log("=== Add to SEVERITY_MAP in severity-map.ts ===");
console.log(`  // In Baseline:`);
console.log(`    '${ruleId}': '${baseline}',`);
console.log(`  // In FedRAMP-Moderate:`);
console.log(`    '${ruleId}': '${moderate}',`);
console.log(`  // In FedRAMP-High:`);
console.log(`    '${ruleId}': '${high}',`);

console.log("");
console.log("=== Add to baseline-policy-evaluator.ts ===");
console.log(`// At module level:`);
console.log(
  `const RULE_${ruleId.toUpperCase().replace(/-/g, "_")} = getRuleById('${ruleId}');`,
);
console.log("");
console.log(`// In evaluate() or a new check method:`);
console.log(
  `if (/* condition */ && RULE_${ruleId.toUpperCase().replace(/-/g, "_")}) {`,
);
console.log(`  violations.push(`);
console.log(`    createViolation({`);
console.log(
  `      ruleId: RULE_${ruleId.toUpperCase().replace(/-/g, "_")}.ruleId,`,
);
console.log(
  `      ruleName: RULE_${ruleId.toUpperCase().replace(/-/g, "_")}.ruleName,`,
);
console.log(
  `      severity: getSeverity(policyPack, RULE_${ruleId.toUpperCase().replace(/-/g, "_")}.ruleId),`,
);
console.log(`      target: { type: 'edge', id: targetId },`);
console.log(`      message: 'TODO: violation message',`);
console.log(
  `      remediation: RULE_${ruleId.toUpperCase().replace(/-/g, "_")}.remediation,`,
);
console.log(`      policyPack,`);
console.log(`    })`);
console.log(`  );`);
console.log(`}`);
