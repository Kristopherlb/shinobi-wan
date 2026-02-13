/**
 * Standard severity levels for policy violations.
 */
export const SEVERITY_LEVELS = ['error', 'warning', 'info'] as const;

/**
 * Severity level type.
 * - error: Must be fixed, blocks deployment
 * - warning: Should be fixed, may block in strict mode
 * - info: Informational, does not block
 */
export type Severity = (typeof SEVERITY_LEVELS)[number];
