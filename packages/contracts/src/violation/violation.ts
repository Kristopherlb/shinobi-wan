import type { ContractSchemaVersion } from '../versions';
import type { Severity } from './severity';
import type { RemediationHint } from './remediation';

/**
 * Target of a policy violation.
 */
export interface ViolationTarget {
  /** Target type */
  readonly type: 'node' | 'edge' | 'artifact';

  /** Target ID */
  readonly id: string;

  /** JSON path to specific field (optional) */
  readonly path?: string;
}

/**
 * Policy violation record.
 *
 * Stable ID format for deterministic output.
 */
export interface Violation {
  /** Stable ID: violation:{ruleId}:{targetId} */
  readonly id: string;

  /** Schema version for forward compatibility */
  readonly schemaVersion: ContractSchemaVersion;

  /** Rule that was violated */
  readonly ruleId: string;

  /** Human-readable rule name */
  readonly ruleName: string;

  /** Severity level */
  readonly severity: Severity;

  /** What was violated */
  readonly target: ViolationTarget;

  /** Human-readable message */
  readonly message: string;

  /** Remediation guidance */
  readonly remediation: RemediationHint;

  /** Policy pack that defines this rule */
  readonly policyPack: string;
}

/**
 * Creates a stable violation ID.
 * Format: violation:{ruleId}:{targetId}
 */
export function createViolationId(ruleId: string, targetId: string): string {
  return `violation:${ruleId}:${targetId}`;
}

/**
 * Validates a violation ID format.
 */
export function isValidViolationId(id: string): boolean {
  if (!id || typeof id !== 'string') {
    return false;
  }
  if (!id.startsWith('violation:')) {
    return false;
  }
  const parts = id.substring(10).split(':'); // Remove 'violation:'
  return parts.length >= 2 && parts.every((p) => p.length > 0);
}
