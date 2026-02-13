import { createError, type ValidationError } from '../errors';

/**
 * Patterns that indicate backend-specific handles.
 * These should never appear in kernel/IR/binder outputs.
 */
export const BACKEND_HANDLE_PATTERNS: RegExp[] = [
  // AWS ARNs
  /^arn:aws[a-z-]*:[a-z0-9-]+:[a-z0-9-]*:\d*:/,
  // AWS resource IDs
  /^sg-[a-f0-9]{8,17}$/,           // Security groups
  /^vpc-[a-f0-9]{8,17}$/,          // VPCs
  /^subnet-[a-f0-9]{8,17}$/,       // Subnets
  /^i-[a-f0-9]{8,17}$/,            // EC2 instances
  /^rtb-[a-f0-9]{8,17}$/,          // Route tables
  /^igw-[a-f0-9]{8,17}$/,          // Internet gateways
  /^nat-[a-f0-9]{8,17}$/,          // NAT gateways
  /^eni-[a-f0-9]{8,17}$/,          // Elastic network interfaces
  /^acl-[a-f0-9]{8,17}$/,          // Network ACLs
  /^eipalloc-[a-f0-9]{8,17}$/,     // Elastic IP allocations
  // GCP resource patterns
  /^projects\/[^/]+\/.*$/,
  // Azure resource patterns
  /^\/subscriptions\/[a-f0-9-]+\//i,
];

/**
 * Patterns that indicate policy pack branching.
 */
const PACK_BRANCHING_PATTERNS: RegExp[] = [
  /policyPack/i,                           // Direct policyPack reference
  /if\s*\(\s*.*policyPack/i,              // if (policyPack...)
  /switch\s*\(\s*.*policyPack/i,          // switch(policyPack)
  /whenPolicyPack/i,                       // conditional policy pack field
  /\.policyPack\s*[=!]==/,                 // .policyPack === or !==
];

/**
 * Recursively scans an object for backend handles.
 * Returns errors for any detected backend-specific identifiers.
 */
export function detectBackendHandles(
  value: unknown,
  path: string
): ValidationError[] {
  const errors: ValidationError[] = [];

  if (typeof value === 'string') {
    for (const pattern of BACKEND_HANDLE_PATTERNS) {
      if (pattern.test(value)) {
        errors.push(
          createError({
            path,
            rule: 'backend-handle-detected',
            message: `Backend-specific handle detected: '${value.substring(0, 50)}${value.length > 50 ? '...' : ''}'`,
            severity: 'error',
            remediation: 'Replace backend-specific handles with node references. Adapters are responsible for resolving to provider-specific identifiers.',
            kernelLaw: 'KL-001',
          })
        );
        break; // Only report once per value
      }
    }
    return errors;
  }

  if (Array.isArray(value)) {
    for (let i = 0; i < value.length; i++) {
      errors.push(...detectBackendHandles(value[i], `${path}[${i}]`));
    }
    return errors;
  }

  if (value !== null && typeof value === 'object') {
    for (const [key, val] of Object.entries(value)) {
      errors.push(...detectBackendHandles(val, `${path}.${key}`));
    }
  }

  return errors;
}

/**
 * Recursively scans an object for policy pack branching.
 * Components and binders should never branch on policy pack selection.
 */
export function detectPackBranching(
  value: unknown,
  path: string
): ValidationError[] {
  const errors: ValidationError[] = [];

  if (typeof value === 'string') {
    for (const pattern of PACK_BRANCHING_PATTERNS) {
      if (pattern.test(value)) {
        errors.push(
          createError({
            path,
            rule: 'pack-branching-detected',
            message: `Policy pack branching detected: value contains '${value.substring(0, 50)}${value.length > 50 ? '...' : ''}'`,
            severity: 'error',
            remediation: 'Components and binders must not branch on policy pack. Policy evaluation happens in the policy layer, not in components or binders.',
          })
        );
        break;
      }
    }
    return errors;
  }

  if (Array.isArray(value)) {
    for (let i = 0; i < value.length; i++) {
      errors.push(...detectPackBranching(value[i], `${path}[${i}]`));
    }
    return errors;
  }

  if (value !== null && typeof value === 'object') {
    for (const [key, val] of Object.entries(value)) {
      // Also check the key itself for policyPack references
      if (/policyPack/i.test(key)) {
        errors.push(
          createError({
            path: `${path}.${key}`,
            rule: 'pack-branching-detected',
            message: `Policy pack branching detected: field name '${key}' references policy pack`,
            severity: 'error',
            remediation: 'Components and binders must not reference policy pack. Remove this field and handle policy compliance in the policy layer.',
          })
        );
      }
      errors.push(...detectPackBranching(val, `${path}.${key}`));
    }
  }

  return errors;
}
