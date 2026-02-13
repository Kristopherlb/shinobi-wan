import type { Violation, IamIntent, NetworkIntent } from '@shinobi/contracts';
import type { IPolicyEvaluator, PolicyEvaluationContext } from '@shinobi/kernel';
import { SUPPORTED_PACKS } from '../severity-map';
import { getSeverity } from '../severity-map';
import { getRuleById } from '../rules';
import { createViolation } from '../violation-factory';

// Pre-resolve rules at module load — avoids repeated lookups and non-null assertions.
const RULE_IAM_WILDCARD = getRuleById('iam-no-wildcard-resource');
const RULE_IAM_ADMIN = getRuleById('iam-admin-access-review');
const RULE_IAM_CONDITIONS = getRuleById('iam-missing-conditions');
const RULE_NETWORK_PROTOCOL = getRuleById('network-broad-protocol');

/**
 * Policy evaluator that checks IAM and network intents against
 * Baseline, FedRAMP-Moderate, and FedRAMP-High rules.
 *
 * Rules are data (RULE_CATALOG); severity is data (SEVERITY_MAP).
 * No pack branching — KL-008 enforced.
 */
export class BaselinePolicyEvaluator implements IPolicyEvaluator {
  readonly id = 'baseline-policy-evaluator';
  readonly supportedPacks: ReadonlyArray<string> = [...SUPPORTED_PACKS];

  evaluate(context: PolicyEvaluationContext): ReadonlyArray<Violation> {
    const violations: Violation[] = [];

    for (const intent of context.intents) {
      if (intent.type === 'iam') {
        this.checkIamIntent(intent as IamIntent, context.policyPack, violations);
      } else if (intent.type === 'network') {
        this.checkNetworkIntent(intent as NetworkIntent, context.policyPack, violations);
      }
    }

    return violations;
  }

  private checkIamIntent(
    intent: IamIntent,
    policyPack: string,
    violations: Violation[]
  ): void {
    const targetId = intent.sourceEdgeId;

    // Rule: iam-no-wildcard-resource
    if (intent.resource.scope === 'pattern' && RULE_IAM_WILDCARD) {
      violations.push(
        createViolation({
          ruleId: RULE_IAM_WILDCARD.ruleId,
          ruleName: RULE_IAM_WILDCARD.ruleName,
          severity: getSeverity(policyPack, RULE_IAM_WILDCARD.ruleId),
          target: { type: 'edge', id: targetId },
          message: `IAM intent on edge "${targetId}" uses pattern-scoped resource "${intent.resource.pattern ?? '*'}". Wildcard scopes violate least privilege.`,
          remediation: RULE_IAM_WILDCARD.remediation,
          policyPack,
        })
      );
    }

    // Rule: iam-admin-access-review
    const hasAdmin = intent.actions.some((a) => a.level === 'admin');
    if (hasAdmin && RULE_IAM_ADMIN) {
      violations.push(
        createViolation({
          ruleId: RULE_IAM_ADMIN.ruleId,
          ruleName: RULE_IAM_ADMIN.ruleName,
          severity: getSeverity(policyPack, RULE_IAM_ADMIN.ruleId),
          target: { type: 'edge', id: targetId },
          message: `IAM intent on edge "${targetId}" grants admin-level access. Admin grants full control.`,
          remediation: RULE_IAM_ADMIN.remediation,
          policyPack,
        })
      );
    }

    // Rule: iam-missing-conditions
    const isCrossService = intent.principal.nodeRef !== intent.resource.nodeRef;
    const hasConditions =
      intent.conditions !== undefined && intent.conditions.length > 0;
    if (isCrossService && !hasConditions && RULE_IAM_CONDITIONS) {
      violations.push(
        createViolation({
          ruleId: RULE_IAM_CONDITIONS.ruleId,
          ruleName: RULE_IAM_CONDITIONS.ruleName,
          severity: getSeverity(policyPack, RULE_IAM_CONDITIONS.ruleId),
          target: { type: 'edge', id: targetId },
          message: `IAM intent on edge "${targetId}" grants cross-service access (${intent.principal.nodeRef} → ${intent.resource.nodeRef}) without conditions.`,
          remediation: RULE_IAM_CONDITIONS.remediation,
          policyPack,
        })
      );
    }
  }

  private checkNetworkIntent(
    intent: NetworkIntent,
    policyPack: string,
    violations: Violation[]
  ): void {
    // Rule: network-broad-protocol
    if (intent.protocol.protocol === 'any' && RULE_NETWORK_PROTOCOL) {
      const targetId = intent.sourceEdgeId;
      violations.push(
        createViolation({
          ruleId: RULE_NETWORK_PROTOCOL.ruleId,
          ruleName: RULE_NETWORK_PROTOCOL.ruleName,
          severity: getSeverity(policyPack, RULE_NETWORK_PROTOCOL.ruleId),
          target: { type: 'edge', id: targetId },
          message: `Network intent on edge "${targetId}" uses protocol "any". Specify "tcp" or "udp" instead.`,
          remediation: RULE_NETWORK_PROTOCOL.remediation,
          policyPack,
        })
      );
    }
  }
}
