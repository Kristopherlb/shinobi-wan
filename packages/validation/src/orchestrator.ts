import type { GraphSnapshot } from '@shinobi/ir';
import { createError, createResult, type ValidationResult, type ValidatorOptions } from './errors';
import { validateSnapshotSchema } from './schema/graph-validators';
import {
  validateCapabilityContractSchema,
  validateIntentSchema,
  validateViolationSchema,
} from './schema/contract-validators';
import { validateReferences } from './semantic/reference-validator';
import { detectBackendHandles } from './semantic/forbidden-patterns';
import { validateLeastPrivilege } from './semantic/least-privilege';
import { validateCanonicalOrdering } from './determinism/ordering-validator';
import { validateSnapshotHashes } from './determinism/hash-validator';
import { validateSnapshotIds } from './determinism/stable-id-validator';

const DEFAULT_OPTIONS: ValidatorOptions = {
  strict: true,
  level: 'full',
  collectAll: true,
};

/**
 * Validate a GraphSnapshot through the full pipeline.
 * Pipeline: schema → semantic → determinism
 */
export function validateGraph(
  snapshot: unknown,
  options: ValidatorOptions = DEFAULT_OPTIONS
): ValidationResult {
  const opts = { ...DEFAULT_OPTIONS, ...options };
  const allErrors: ReturnType<typeof createError>[] = [];

  // Phase 1: Schema validation (always runs)
  const schemaResult = validateSnapshotSchema(snapshot, opts);
  allErrors.push(...schemaResult.errors);

  // If schema validation fails, we can't proceed with semantic/determinism
  // unless collectAll is true and we want to gather all errors
  if (!schemaResult.valid && !opts.collectAll) {
    return createResult([...allErrors]);
  }

  // If schema failed, we can't safely cast or traverse the snapshot
  if (!schemaResult.valid) {
    return createResult([...allErrors]);
  }

  // Safe to cast now
  const typedSnapshot = snapshot as GraphSnapshot;

  // Phase 2: Semantic validation
  if (opts.level === 'semantic' || opts.level === 'full') {
    // Referential integrity
    const refResult = validateReferences(typedSnapshot);
    allErrors.push(...refResult.errors);

    // Stable ID consistency
    const idResult = validateSnapshotIds(typedSnapshot);
    allErrors.push(...idResult.errors);
  }

  // Phase 3: Determinism validation
  if (opts.level === 'full') {
    // Canonical ordering
    const orderResult = validateCanonicalOrdering(typedSnapshot);
    allErrors.push(...orderResult.errors);

    // Semantic hash verification
    const hashResult = validateSnapshotHashes(typedSnapshot);
    allErrors.push(...hashResult.errors);
  }

  return createResult([...allErrors]);
}

/**
 * Validate a CapabilityContract.
 */
export function validateCapabilityContract(
  contract: unknown,
  options: ValidatorOptions = DEFAULT_OPTIONS
): ValidationResult {
  const opts = { ...DEFAULT_OPTIONS, ...options };

  // Schema validation
  const schemaResult = validateCapabilityContractSchema(contract, opts);

  return createResult([...schemaResult.errors]);
}

/**
 * Validate an Intent (any type).
 * Includes semantic checks for forbidden patterns and least-privilege.
 */
export function validateIntent(
  intent: unknown,
  options: ValidatorOptions = DEFAULT_OPTIONS
): ValidationResult {
  const opts = { ...DEFAULT_OPTIONS, ...options };
  const allErrors: ReturnType<typeof createError>[] = [];

  // Schema validation
  const schemaResult = validateIntentSchema(intent, opts);
  allErrors.push(...schemaResult.errors);

  // If schema fails and not collecting all, return early
  if (!schemaResult.valid && !opts.collectAll) {
    return createResult([...allErrors]);
  }

  // Semantic validation for intents
  if (opts.level === 'semantic' || opts.level === 'full') {
    // Check for backend handles (forbidden in intents)
    if (intent && typeof intent === 'object') {
      const handleErrors = detectBackendHandles(intent, '$');
      allErrors.push(...handleErrors);

      // Least-privilege check for IAM intents
      const lpResult = validateLeastPrivilege(intent);
      allErrors.push(...lpResult.errors);
    }
  }

  return createResult([...allErrors]);
}

/**
 * Validate a Violation record.
 */
export function validateViolation(
  violation: unknown,
  options: ValidatorOptions = DEFAULT_OPTIONS
): ValidationResult {
  const opts = { ...DEFAULT_OPTIONS, ...options };

  // Schema validation
  const schemaResult = validateViolationSchema(violation, opts);

  return createResult([...schemaResult.errors]);
}
