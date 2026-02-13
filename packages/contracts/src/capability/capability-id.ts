/**
 * Versioned capability identifier.
 *
 * Format: {namespace}:{name}@{version}
 * - namespace: lowercase letters, numbers, hyphens (starts with letter)
 * - name: lowercase letters, numbers, hyphens (starts with letter)
 * - version: semantic version (major.minor.patch)
 *
 * Examples:
 * - "aws:sqs-queue@1.0.0"
 * - "core:http-endpoint@2.1.0"
 * - "shinobi:lambda-function@0.1.0"
 */
export type CapabilityId = `${string}:${string}@${string}`;

/**
 * Pattern for validating capability ID format.
 * Matches: lowercase-namespace:lowercase-name@X.Y.Z
 */
export const CAPABILITY_ID_PATTERN =
  /^[a-z][a-z0-9-]*:[a-z][a-z0-9-]*@\d+\.\d+\.\d+$/;

/**
 * Validates a capability ID against the standard format.
 */
export function isValidCapabilityId(id: string): id is CapabilityId {
  return CAPABILITY_ID_PATTERN.test(id);
}
