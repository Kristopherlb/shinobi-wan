/**
 * Thrown when schema or format validation fails.
 * Provides stable path and rule for programmatic consumption.
 */
export class ValidationError extends Error {
  readonly name = 'ValidationError' as const;

  constructor(
    readonly path: string,
    readonly rule: string
  ) {
    super(`Validation failed at ${path}: ${rule}`);
  }
}

/**
 * Thrown when attempting to add an entity with the same ID
 * but different semantic content.
 */
export class ConflictError extends Error {
  readonly name = 'ConflictError' as const;

  constructor(
    readonly id: string,
    readonly existingHash: string,
    readonly incomingHash: string
  ) {
    super(
      `Conflict at ${id}: existing hash ${existingHash} differs from incoming ${incomingHash}`
    );
  }
}

/**
 * Thrown when referential integrity is violated
 * (e.g., edge references a non-existent node).
 */
export class IntegrityError extends Error {
  readonly name = 'IntegrityError' as const;

  constructor(
    readonly missingRef: string,
    readonly referencedBy: string
  ) {
    super(`Reference ${missingRef} not found, referenced by ${referencedBy}`);
  }
}
