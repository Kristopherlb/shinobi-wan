import {
  CAPABILITY_ID_PATTERN,
  isValidCapabilityId,
  CAPABILITY_ACTIONS,
  INTENT_TYPES,
  SEVERITY_LEVELS,
  isValidViolationId,
} from '@shinobi/contracts';
import {
  createError,
  createResult,
  type ValidationError,
  type ValidationResult,
  type ValidatorOptions,
} from '../errors';
import { hasRequiredField, rejectUnknownFields, validateEnumField } from './field-validators';

const DEFAULT_OPTIONS: ValidatorOptions = { strict: true };

// Known fields for strict mode
const CAPABILITY_CONTRACT_KNOWN_FIELDS = new Set([
  'id',
  'schemaVersion',
  'description',
  'dataShape',
  'actions',
]);

const VIOLATION_KNOWN_FIELDS = new Set([
  'id',
  'schemaVersion',
  'ruleId',
  'ruleName',
  'severity',
  'target',
  'message',
  'remediation',
  'policyPack',
]);

const VIOLATION_TARGET_KNOWN_FIELDS = new Set(['type', 'id', 'path']);

/**
 * Validates a capability ID format.
 */
export function validateCapabilityIdFormat(id: string, path: string): ValidationError[] {
  if (!isValidCapabilityId(id)) {
    return [
      createError({
        path,
        rule: 'invalid-capability-id',
        message: `Invalid capability ID format: '${id}'. Expected format: {namespace}:{name}@{version}`,
        severity: 'error',
        remediation: `Capability IDs must match pattern: ${CAPABILITY_ID_PATTERN.source}. Example: aws:sqs-queue@1.0.0`,
        kernelLaw: 'KL-002',
      }),
    ];
  }
  return [];
}

/**
 * Validates a CapabilityContract schema.
 */
export function validateCapabilityContractSchema(
  contract: unknown,
  options: ValidatorOptions = DEFAULT_OPTIONS
): ValidationResult {
  const errors: ValidationError[] = [];

  if (!contract || typeof contract !== 'object') {
    errors.push(
      createError({
        path: '$',
        rule: 'invalid-input-type',
        message: 'CapabilityContract must be an object',
        severity: 'error',
      })
    );
    return createResult(errors);
  }

  const c = contract as Record<string, unknown>;

  // id (CapabilityId format)
  errors.push(...hasRequiredField(c, '$.id', 'id', 'string'));
  if (typeof c.id === 'string') {
    errors.push(...validateCapabilityIdFormat(c.id, '$.id'));
  }

  // schemaVersion
  if (c.schemaVersion !== '1.0.0') {
    errors.push(
      createError({
        path: '$.schemaVersion',
        rule: 'invalid-enum-value',
        message: 'schemaVersion must be "1.0.0"',
        severity: 'error',
        allowedValues: ['1.0.0'],
      })
    );
  }

  // description
  errors.push(...hasRequiredField(c, '$.description', 'description', 'string'));

  // dataShape
  errors.push(...hasRequiredField(c, '$.dataShape', 'dataShape', 'object'));

  // actions (non-empty array of valid actions)
  errors.push(...hasRequiredField(c, '$.actions', 'actions', 'array'));
  if (Array.isArray(c.actions)) {
    if (c.actions.length === 0) {
      errors.push(
        createError({
          path: '$.actions',
          rule: 'empty-array',
          message: 'actions must contain at least one action',
          severity: 'error',
        })
      );
    } else {
      for (let i = 0; i < c.actions.length; i++) {
        const action = c.actions[i];
        if (typeof action === 'string') {
          errors.push(
            ...validateEnumField(action, `$.actions[${i}]`, CAPABILITY_ACTIONS as readonly string[])
          );
        } else {
          errors.push(
            createError({
              path: `$.actions[${i}]`,
              rule: 'invalid-field-type',
              message: 'action must be a string',
              severity: 'error',
            })
          );
        }
      }
    }
  }

  // Strict mode
  if (options.strict !== false) {
    errors.push(...rejectUnknownFields(c, '$', CAPABILITY_CONTRACT_KNOWN_FIELDS));
  }

  return createResult(errors);
}

/**
 * Validates an Intent schema (any type).
 */
export function validateIntentSchema(
  intent: unknown,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  _options: ValidatorOptions = DEFAULT_OPTIONS
): ValidationResult {
  const errors: ValidationError[] = [];

  if (!intent || typeof intent !== 'object') {
    errors.push(
      createError({
        path: '$',
        rule: 'invalid-input-type',
        message: 'Intent must be an object',
        severity: 'error',
      })
    );
    return createResult(errors);
  }

  const i = intent as Record<string, unknown>;

  // type (IntentType)
  errors.push(...hasRequiredField(i, '$.type', 'type', 'string'));
  if (typeof i.type === 'string') {
    errors.push(...validateEnumField(i.type, '$.type', INTENT_TYPES as readonly string[]));
  }

  // schemaVersion
  if (i.schemaVersion !== '1.0.0') {
    errors.push(
      createError({
        path: '$.schemaVersion',
        rule: 'invalid-enum-value',
        message: 'schemaVersion must be "1.0.0"',
        severity: 'error',
        allowedValues: ['1.0.0'],
      })
    );
  }

  // sourceEdgeId
  errors.push(...hasRequiredField(i, '$.sourceEdgeId', 'sourceEdgeId', 'string'));

  // Type-specific validation is intentionally minimal at schema level
  // Semantic validation handles type-specific checks

  return createResult(errors);
}

/**
 * Validates a Violation schema.
 */
export function validateViolationSchema(
  violation: unknown,
  options: ValidatorOptions = DEFAULT_OPTIONS
): ValidationResult {
  const errors: ValidationError[] = [];

  if (!violation || typeof violation !== 'object') {
    errors.push(
      createError({
        path: '$',
        rule: 'invalid-input-type',
        message: 'Violation must be an object',
        severity: 'error',
      })
    );
    return createResult(errors);
  }

  const v = violation as Record<string, unknown>;

  // id (violation:{ruleId}:{targetId} format)
  errors.push(...hasRequiredField(v, '$.id', 'id', 'string'));
  if (typeof v.id === 'string' && !isValidViolationId(v.id)) {
    errors.push(
      createError({
        path: '$.id',
        rule: 'invalid-violation-id',
        message: `Invalid violation ID format: '${v.id}'. Expected format: violation:{ruleId}:{targetId}`,
        severity: 'error',
        remediation: 'Violation IDs must start with "violation:" followed by ruleId and targetId',
        kernelLaw: 'KL-001',
      })
    );
  }

  // schemaVersion
  if (v.schemaVersion !== '1.0.0') {
    errors.push(
      createError({
        path: '$.schemaVersion',
        rule: 'invalid-enum-value',
        message: 'schemaVersion must be "1.0.0"',
        severity: 'error',
        allowedValues: ['1.0.0'],
      })
    );
  }

  // ruleId
  errors.push(...hasRequiredField(v, '$.ruleId', 'ruleId', 'string'));

  // ruleName
  errors.push(...hasRequiredField(v, '$.ruleName', 'ruleName', 'string'));

  // severity
  errors.push(...hasRequiredField(v, '$.severity', 'severity', 'string'));
  if (typeof v.severity === 'string') {
    errors.push(...validateEnumField(v.severity, '$.severity', SEVERITY_LEVELS as readonly string[]));
  }

  // target
  errors.push(...hasRequiredField(v, '$.target', 'target', 'object'));
  if (v.target && typeof v.target === 'object') {
    const t = v.target as Record<string, unknown>;
    errors.push(...hasRequiredField(t, '$.target.type', 'type', 'string'));
    if (typeof t.type === 'string') {
      errors.push(
        ...validateEnumField(t.type, '$.target.type', ['node', 'edge', 'artifact'] as const)
      );
    }
    errors.push(...hasRequiredField(t, '$.target.id', 'id', 'string'));
    // path is optional

    if (options.strict !== false) {
      errors.push(...rejectUnknownFields(t, '$.target', VIOLATION_TARGET_KNOWN_FIELDS));
    }
  }

  // message
  errors.push(...hasRequiredField(v, '$.message', 'message', 'string'));

  // remediation
  errors.push(...hasRequiredField(v, '$.remediation', 'remediation', 'object'));

  // policyPack
  errors.push(...hasRequiredField(v, '$.policyPack', 'policyPack', 'string'));

  // Strict mode
  if (options.strict !== false) {
    errors.push(...rejectUnknownFields(v, '$', VIOLATION_KNOWN_FIELDS));
  }

  return createResult(errors);
}
