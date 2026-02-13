import type { Violation, ViolationTarget, Severity, RemediationHint } from '@shinobi/contracts';
import { CONTRACT_SCHEMA_VERSION, createViolationId } from '@shinobi/contracts';
import { deepFreeze } from '@shinobi/kernel';

/**
 * Options for creating a Violation.
 */
export interface CreateViolationOptions {
  readonly ruleId: string;
  readonly ruleName: string;
  readonly severity: Severity;
  readonly target: ViolationTarget;
  readonly message: string;
  readonly remediation: RemediationHint;
  readonly policyPack: string;
}

/**
 * Creates a frozen, schema-versioned Violation with a stable ID.
 *
 * ID format: violation:{ruleId}:{targetId}
 */
export function createViolation(opts: CreateViolationOptions): Violation {
  const violation: Violation = {
    id: createViolationId(opts.ruleId, opts.target.id),
    schemaVersion: CONTRACT_SCHEMA_VERSION,
    ruleId: opts.ruleId,
    ruleName: opts.ruleName,
    severity: opts.severity,
    target: opts.target,
    message: opts.message,
    remediation: opts.remediation,
    policyPack: opts.policyPack,
  };
  return deepFreeze(violation) as Violation;
}
