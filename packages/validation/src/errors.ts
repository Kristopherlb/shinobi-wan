import type { Severity } from '@shinobi/contracts';

/**
 * Validation error with structured diagnostics (KL-006 compliant).
 */
export interface ValidationError {
  /** JSON path to error location: $.nodes[0].id */
  readonly path: string;

  /** Rule identifier: 'missing-required-field', 'invalid-capability-id' */
  readonly rule: string;

  /** Human-readable message */
  readonly message: string;

  /** Severity level */
  readonly severity: Severity;

  /** Allowed values when applicable */
  readonly allowedValues?: ReadonlyArray<string>;

  /** Remediation guidance */
  readonly remediation?: string;

  /** Related kernel law */
  readonly kernelLaw?: string;
}

/**
 * Validation result with deterministic error ordering.
 */
export interface ValidationResult {
  /** Overall validity (false if any error severity issues exist) */
  readonly valid: boolean;

  /** Errors sorted by severity, then path, then rule */
  readonly errors: ReadonlyArray<ValidationError>;

  /** Schema version for forward compatibility */
  readonly schemaVersion: '1.0.0';
}

/**
 * Validation options.
 */
export interface ValidatorOptions {
  /** Reject unknown fields (default: true) */
  readonly strict?: boolean;

  /** Validation level: 'schema' | 'semantic' | 'full' (default: 'full') */
  readonly level?: 'schema' | 'semantic' | 'full';

  /** Collect all errors vs fail-fast (default: true = collect all) */
  readonly collectAll?: boolean;
}

/**
 * Input for creating a validation error.
 */
export interface ValidationErrorInput {
  path: string;
  rule: string;
  message: string;
  severity: Severity;
  allowedValues?: ReadonlyArray<string>;
  remediation?: string;
  kernelLaw?: string;
}

/**
 * Severity order for sorting (lower = higher priority).
 */
export const SEVERITY_ORDER: Record<Severity, number> = {
  error: 0,
  warning: 1,
  info: 2,
} as const;

/**
 * Creates a frozen validation error.
 */
export function createError(input: ValidationErrorInput): ValidationError {
  const error: ValidationError = {
    path: input.path,
    rule: input.rule,
    message: input.message,
    severity: input.severity,
    ...(input.allowedValues !== undefined && { allowedValues: input.allowedValues }),
    ...(input.remediation !== undefined && { remediation: input.remediation }),
    ...(input.kernelLaw !== undefined && { kernelLaw: input.kernelLaw }),
  };
  return Object.freeze(error);
}

/**
 * Sorts errors by severity (error > warning > info), then by path, then by rule.
 * Returns a new array (does not mutate input).
 */
export function sortErrors(errors: ReadonlyArray<ValidationError>): ValidationError[] {
  return [...errors].sort((a, b) => {
    // Primary: sort by severity (error first)
    const severityDiff = SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity];
    if (severityDiff !== 0) {
      return severityDiff;
    }

    // Secondary: sort by path
    const pathDiff = a.path.localeCompare(b.path);
    if (pathDiff !== 0) {
      return pathDiff;
    }

    // Tertiary: sort by rule
    return a.rule.localeCompare(b.rule);
  });
}

/**
 * Creates a frozen validation result.
 * Errors are sorted deterministically.
 * Valid is true only if no error-severity issues exist.
 */
export function createResult(errors: ValidationError[]): ValidationResult {
  const sortedErrors = sortErrors(errors);
  const hasErrors = sortedErrors.some((e) => e.severity === 'error');

  const result: ValidationResult = {
    valid: !hasErrors,
    errors: Object.freeze(sortedErrors),
    schemaVersion: '1.0.0',
  };

  return Object.freeze(result);
}
