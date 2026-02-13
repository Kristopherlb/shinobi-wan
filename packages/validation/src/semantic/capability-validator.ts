import type { CapabilityContract, CapabilityAction } from '@shinobi/contracts';
import { createError, createResult, type ValidationError, type ValidationResult } from '../errors';

/**
 * Checks if required actions are available in provided actions.
 */
export function checkActionCompatibility(
  providerId: string,
  providedActions: ReadonlyArray<CapabilityAction>,
  requiredActions: ReadonlyArray<CapabilityAction>,
  path: string
): ValidationError[] {
  const errors: ValidationError[] = [];
  const availableSet = new Set(providedActions);

  for (const required of requiredActions) {
    if (!availableSet.has(required)) {
      errors.push(
        createError({
          path,
          rule: 'incompatible-capability-action',
          message: `Capability '${providerId}' does not provide action '${required}'`,
          severity: 'error',
          allowedValues: [...providedActions],
          remediation: `The provider capability only supports: ${providedActions.join(', ')}. Update the consumer to use only available actions.`,
          kernelLaw: 'KL-003',
        })
      );
    }
  }

  return errors;
}

/**
 * Validates that a consumer's capability requirements are compatible
 * with what a provider capability offers.
 */
export function validateCapabilityCompatibility(
  provider: CapabilityContract,
  consumer: CapabilityContract,
  path: string
): ValidationResult {
  const errors = checkActionCompatibility(
    provider.id,
    provider.actions,
    consumer.actions,
    path
  );

  return createResult(errors);
}
