import { createError, type ValidationError } from '../errors';

type FieldType = 'string' | 'number' | 'boolean' | 'object' | 'array';

/**
 * Field definition for required fields validation.
 */
export interface RequiredFieldDef {
  field: string;
  type: FieldType;
}

/**
 * Validates that a required field exists and has the correct type.
 */
export function hasRequiredField(
  obj: Record<string, unknown>,
  basePath: string,
  fieldName: string,
  expectedType: FieldType
): ValidationError[] {
  const value = obj[fieldName];

  if (value === undefined || value === null) {
    return [
      createError({
        path: basePath,
        rule: 'missing-required-field',
        message: `Required field '${fieldName}' is missing`,
        severity: 'error',
      }),
    ];
  }

  // Type checking
  if (expectedType === 'array') {
    if (!Array.isArray(value)) {
      return [
        createError({
          path: basePath,
          rule: 'invalid-field-type',
          message: `Field '${fieldName}' has wrong type: expected array, got ${typeof value}`,
          severity: 'error',
        }),
      ];
    }
  } else if (expectedType === 'object') {
    if (typeof value !== 'object' || Array.isArray(value)) {
      return [
        createError({
          path: basePath,
          rule: 'invalid-field-type',
          message: `Field '${fieldName}' has wrong type: expected object, got ${Array.isArray(value) ? 'array' : typeof value}`,
          severity: 'error',
        }),
      ];
    }
  } else if (typeof value !== expectedType) {
    return [
      createError({
        path: basePath,
        rule: 'invalid-field-type',
        message: `Field '${fieldName}' has wrong type: expected ${expectedType}, got ${typeof value}`,
        severity: 'error',
      }),
    ];
  }

  return [];
}

/**
 * Validates multiple required fields at once.
 */
export function hasRequiredFields(
  obj: Record<string, unknown>,
  basePath: string,
  fields: RequiredFieldDef[]
): ValidationError[] {
  const errors: ValidationError[] = [];

  for (const { field, type } of fields) {
    const fieldPath = basePath === '$' ? `$.${field}` : `${basePath}.${field}`;
    errors.push(...hasRequiredField(obj, fieldPath, field, type));
  }

  return errors;
}

/**
 * Rejects unknown fields in strict mode.
 */
export function rejectUnknownFields(
  obj: Record<string, unknown>,
  basePath: string,
  knownFields: Set<string>
): ValidationError[] {
  const errors: ValidationError[] = [];

  for (const key of Object.keys(obj)) {
    if (!knownFields.has(key)) {
      const fieldPath = basePath === '$' ? `$.${key}` : `${basePath}.${key}`;
      errors.push(
        createError({
          path: fieldPath,
          rule: 'unknown-field',
          message: `Unknown field '${key}'`,
          severity: 'error',
        })
      );
    }
  }

  return errors;
}

/**
 * Validates that a value is one of the allowed enum values.
 */
export function validateEnumField(
  value: string,
  path: string,
  allowedValues: readonly string[]
): ValidationError[] {
  if (!allowedValues.includes(value)) {
    return [
      createError({
        path,
        rule: 'invalid-enum-value',
        message: `Invalid value '${value}', must be one of: ${allowedValues.join(', ')}`,
        severity: 'error',
        allowedValues: [...allowedValues],
      }),
    ];
  }

  return [];
}

/**
 * Validates that a value is a non-empty string.
 */
export function validateStringField(value: string, path: string): ValidationError[] {
  if (typeof value !== 'string') {
    return [
      createError({
        path,
        rule: 'invalid-field-type',
        message: 'Expected string',
        severity: 'error',
      }),
    ];
  }

  if (value === '') {
    return [
      createError({
        path,
        rule: 'empty-string',
        message: 'String cannot be empty',
        severity: 'error',
      }),
    ];
  }

  return [];
}
