import type { RemediationHint } from '@shinobi/contracts';

/**
 * A policy rule definition — pure data, no code.
 */
export interface PolicyRule {
  readonly ruleId: string;
  readonly ruleName: string;
  readonly description: string;
  readonly remediation: RemediationHint;
}

/**
 * Canonical rule catalog.
 * Rules are data; severity is determined by the pack via severity-map.
 */
export const RULE_CATALOG: ReadonlyArray<PolicyRule> = [
  {
    ruleId: 'iam-no-wildcard-resource',
    ruleName: 'No Wildcard Resources',
    description:
      'IAM intents must not use pattern-scoped resources. Wildcard/pattern scopes violate least privilege (KL-005).',
    remediation: {
      summary: "Use scope 'specific' with explicit resource references",
      autoFixable: false,
    },
  },
  {
    ruleId: 'iam-admin-access-review',
    ruleName: 'Admin Access Review',
    description:
      'IAM intents with admin-level actions require justification. Admin grants full control (KL-005).',
    remediation: {
      summary: "Consider 'read' or 'write' access level. Admin grants full control",
      autoFixable: false,
    },
  },
  {
    ruleId: 'iam-missing-conditions',
    ruleName: 'Missing IAM Conditions',
    description:
      'Cross-service IAM grants should include conditions to scope access.',
    remediation: {
      summary: 'Add conditions to scope cross-service access',
      autoFixable: false,
    },
  },
  {
    ruleId: 'network-broad-protocol',
    ruleName: 'Broad Network Protocol',
    description:
      "Network intents with protocol 'any' are overly permissive.",
    remediation: {
      summary: "Specify protocol as 'tcp' or 'udp' instead of 'any'",
      autoFixable: false,
    },
  },
];

/**
 * Look up a rule by its ID.
 * Returns undefined if not found.
 */
export function getRuleById(ruleId: string): PolicyRule | undefined {
  return RULE_CATALOG.find((r) => r.ruleId === ruleId);
}
