import type { Severity, Violation } from '@shinobi/contracts';
import { getRuleById } from './rules';
import { getSeverity } from './severity-map';
import { createViolation } from './violation-factory';

/**
 * A policy exception (waiver) record — Standard 5 (Exception & Suppression).
 *
 * Exceptions are declared in the manifest, carry a mandatory expiry and
 * justification, and suppress enforcement of one rule for one target (or
 * `*` for the whole service). Suppressed violations are still reported
 * (severity `info`, `suppressed: true`) so the audit trail is complete.
 */
export interface PolicyException {
  /** The rule being excepted, e.g. 'iam-no-wildcard-resource' */
  readonly ruleId: string;
  /** Component/edge id the exception applies to, or '*' for service-wide */
  readonly target: string;
  /** ISO date (YYYY-MM-DD); the exception stops suppressing after this date */
  readonly expires: string;
  /** Business justification (mandatory) */
  readonly justification: string;
  /** Optional approver identity for audit evidence */
  readonly approvedBy?: string;
}

export interface ExceptionParseError {
  readonly path: string;
  readonly message: string;
}

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Strictly parses raw exception records (Enforcement_Of_Required_Fields).
 * Invalid records are rejected with stable-path errors, never silently
 * accepted — a malformed waiver must not accidentally suppress enforcement.
 */
export function parsePolicyExceptions(raw: unknown): {
  exceptions: ReadonlyArray<PolicyException>;
  errors: ReadonlyArray<ExceptionParseError>;
} {
  const exceptions: PolicyException[] = [];
  const errors: ExceptionParseError[] = [];

  if (raw === undefined || raw === null) {
    return { exceptions, errors };
  }
  if (!Array.isArray(raw)) {
    return {
      exceptions,
      errors: [
        { path: '$.exceptions', message: 'exceptions must be an array' },
      ],
    };
  }

  raw.forEach((entry, i) => {
    const path = `$.exceptions[${i}]`;
    if (typeof entry !== 'object' || entry === null) {
      errors.push({ path, message: 'exception must be an object' });
      return;
    }
    const e = entry as Record<string, unknown>;
    const required: Array<[string, string]> = [
      ['ruleId', 'ruleId is required and must be a non-empty string'],
      ['target', 'target is required and must be a non-empty string'],
      ['expires', 'expires is required and must be a YYYY-MM-DD date'],
      [
        'justification',
        'justification is required and must be a non-empty string',
      ],
    ];
    let ok = true;
    for (const [field, message] of required) {
      const v = e[field];
      if (typeof v !== 'string' || v.length === 0) {
        errors.push({ path: `${path}.${field}`, message });
        ok = false;
      }
    }
    if (ok && !ISO_DATE.test(e['expires'] as string)) {
      errors.push({
        path: `${path}.expires`,
        message: 'expires must be an ISO date (YYYY-MM-DD)',
      });
      ok = false;
    }
    if (ok) {
      exceptions.push({
        ruleId: e['ruleId'] as string,
        target: e['target'] as string,
        expires: e['expires'] as string,
        justification: e['justification'] as string,
        ...(typeof e['approvedBy'] === 'string'
          ? { approvedBy: e['approvedBy'] as string }
          : {}),
      });
    }
  });

  return { exceptions, errors };
}

function shortId(id: string): string {
  const idx = id.indexOf(':');
  return idx >= 0 ? id.substring(idx + 1) : id;
}

function matchesTarget(
  exceptionTarget: string,
  violationTargetId: string,
): boolean {
  if (exceptionTarget === '*') return true;
  return (
    violationTargetId === exceptionTarget ||
    shortId(violationTargetId) === exceptionTarget ||
    // edge targets look like 'edge:source->target'; match on containment of
    // the excepted component id within the edge identity
    shortId(violationTargetId).includes(exceptionTarget)
  );
}

/**
 * Applies exceptions to a violation list (deterministically — the evaluation
 * date is an injected input, never read from the clock inside the engine):
 *
 * - Active exception matching (ruleId, target): the violation is retained
 *   with severity 'info', `suppressed: true`, and the exception attached
 *   (Reporting_And_Audit_Trail).
 * - Expired exception: no suppression, and one additional
 *   'policy-exception-expired' violation is emitted per expired record so
 *   stale waivers surface in CI (Expiry_TTL_And_Renewal).
 */
export function applyPolicyExceptions(
  violations: ReadonlyArray<Violation>,
  exceptions: ReadonlyArray<PolicyException>,
  policyPack: string,
  evaluationDate: string,
): ReadonlyArray<Violation> {
  if (exceptions.length === 0) return violations;

  const active = exceptions.filter((e) => e.expires >= evaluationDate);
  const expired = exceptions.filter((e) => e.expires < evaluationDate);

  const result: Violation[] = violations.map((v) => {
    const match = active.find(
      (e) => e.ruleId === v.ruleId && matchesTarget(e.target, v.target.id),
    );
    if (!match) return v;
    return {
      ...v,
      severity: 'info' as Severity,
      suppressed: true,
      exception: {
        target: match.target,
        expires: match.expires,
        justification: match.justification,
        ...(match.approvedBy ? { approvedBy: match.approvedBy } : {}),
      },
    };
  });

  const expiredRule = getRuleById('policy-exception-expired');
  if (expiredRule) {
    for (const e of expired) {
      result.push(
        createViolation({
          ruleId: expiredRule.ruleId,
          ruleName: expiredRule.ruleName,
          severity: getSeverity(policyPack, expiredRule.ruleId),
          target: { type: 'node', id: e.target },
          message: `Policy exception for rule "${e.ruleId}" on target "${e.target}" expired on ${e.expires}. Renew or remove it — enforcement has resumed.`,
          remediation: expiredRule.remediation,
          policyPack,
        }),
      );
    }
  }

  return result;
}
