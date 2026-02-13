import { createError, createResult, type ValidationError, type ValidationResult } from '../errors';

/**
 * Patterns that indicate wildcard resource access.
 */
export const WILDCARD_PATTERNS: RegExp[] = [
  /^\*$/,                    // Standalone asterisk
  /\/\*$/,                   // Trailing wildcard (e.g., bucket/*)
  /\/\*\//,                  // Embedded wildcard (e.g., table/*/item)
  /:\*$/,                    // Action wildcard (e.g., sqs:*)
  /^Resource:\s*\*$/i,       // Resource: * pattern
];

/**
 * Recursively scans an object for wildcard resource patterns.
 * Returns errors for any detected wildcard access.
 */
export function detectWildcardResources(
  value: unknown,
  path: string
): ValidationError[] {
  const errors: ValidationError[] = [];

  if (typeof value === 'string') {
    for (const pattern of WILDCARD_PATTERNS) {
      if (pattern.test(value)) {
        errors.push(
          createError({
            path,
            rule: 'wildcard-resource',
            message: `Wildcard resource access detected: '${value}'`,
            severity: 'error',
            remediation: 'Replace wildcard with specific resource references. Least-privilege principle requires explicit resource targeting.',
            kernelLaw: 'KL-005',
          })
        );
        break;
      }
    }
    return errors;
  }

  if (Array.isArray(value)) {
    for (let i = 0; i < value.length; i++) {
      errors.push(...detectWildcardResources(value[i], `${path}[${i}]`));
    }
    return errors;
  }

  if (value !== null && typeof value === 'object') {
    for (const [key, val] of Object.entries(value)) {
      errors.push(...detectWildcardResources(val, `${path}.${key}`));
    }
  }

  return errors;
}

/**
 * Validates that an intent follows least-privilege principles.
 * Primarily checks IAM intents for wildcard resource access.
 */
export function validateLeastPrivilege(intent: unknown): ValidationResult {
  if (!intent || typeof intent !== 'object') {
    return createResult([]);
  }

  const i = intent as Record<string, unknown>;

  // Only validate IAM intents (where least-privilege is critical)
  if (i.type !== 'iam') {
    return createResult([]);
  }

  const errors = detectWildcardResources(intent, '$');
  return createResult(errors);
}
