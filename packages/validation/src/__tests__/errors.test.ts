import { describe, it, expect } from 'vitest';
import {
  createError,
  createResult,
  sortErrors,
  SEVERITY_ORDER,
  type ValidationError,
} from '../errors';

describe('ValidationError', () => {
  describe('createError', () => {
    it('creates error with required fields', () => {
      const error = createError({
        path: '$.nodes[0].id',
        rule: 'required-field',
        message: 'Field is required',
        severity: 'error',
      });

      expect(error.path).toBe('$.nodes[0].id');
      expect(error.rule).toBe('required-field');
      expect(error.message).toBe('Field is required');
      expect(error.severity).toBe('error');
    });

    it('creates error with optional fields', () => {
      const error = createError({
        path: '$.type',
        rule: 'invalid-enum',
        message: 'Invalid type value',
        severity: 'error',
        allowedValues: ['component', 'platform'],
        remediation: 'Use one of the allowed node types',
        kernelLaw: 'KL-002',
      });

      expect(error.allowedValues).toEqual(['component', 'platform']);
      expect(error.remediation).toBe('Use one of the allowed node types');
      expect(error.kernelLaw).toBe('KL-002');
    });

    it('returns frozen object', () => {
      const error = createError({
        path: '$.id',
        rule: 'invalid-id',
        message: 'Invalid ID format',
        severity: 'error',
      });

      expect(Object.isFrozen(error)).toBe(true);
    });
  });

  describe('sortErrors', () => {
    it('sorts by severity (error > warning > info)', () => {
      const errors: ValidationError[] = [
        createError({ path: '$.a', rule: 'r1', message: 'm1', severity: 'info' }),
        createError({ path: '$.b', rule: 'r2', message: 'm2', severity: 'error' }),
        createError({ path: '$.c', rule: 'r3', message: 'm3', severity: 'warning' }),
      ];

      const sorted = sortErrors(errors);

      expect(sorted[0].severity).toBe('error');
      expect(sorted[1].severity).toBe('warning');
      expect(sorted[2].severity).toBe('info');
    });

    it('sorts by path within same severity', () => {
      const errors: ValidationError[] = [
        createError({ path: '$.z', rule: 'r1', message: 'm1', severity: 'error' }),
        createError({ path: '$.a', rule: 'r2', message: 'm2', severity: 'error' }),
        createError({ path: '$.m', rule: 'r3', message: 'm3', severity: 'error' }),
      ];

      const sorted = sortErrors(errors);

      expect(sorted[0].path).toBe('$.a');
      expect(sorted[1].path).toBe('$.m');
      expect(sorted[2].path).toBe('$.z');
    });

    it('sorts by rule within same severity and path', () => {
      const errors: ValidationError[] = [
        createError({ path: '$.x', rule: 'z-rule', message: 'm1', severity: 'error' }),
        createError({ path: '$.x', rule: 'a-rule', message: 'm2', severity: 'error' }),
      ];

      const sorted = sortErrors(errors);

      expect(sorted[0].rule).toBe('a-rule');
      expect(sorted[1].rule).toBe('z-rule');
    });

    it('returns new array (does not mutate original)', () => {
      const errors: ValidationError[] = [
        createError({ path: '$.b', rule: 'r1', message: 'm1', severity: 'error' }),
        createError({ path: '$.a', rule: 'r2', message: 'm2', severity: 'error' }),
      ];

      const sorted = sortErrors(errors);

      expect(sorted).not.toBe(errors);
      expect(errors[0].path).toBe('$.b'); // Original unchanged
    });

    it('produces deterministic output for identical input', () => {
      const errors: ValidationError[] = [
        createError({ path: '$.c', rule: 'r3', message: 'm3', severity: 'info' }),
        createError({ path: '$.a', rule: 'r1', message: 'm1', severity: 'error' }),
        createError({ path: '$.b', rule: 'r2', message: 'm2', severity: 'warning' }),
      ];

      const sorted1 = sortErrors(errors);
      const sorted2 = sortErrors([...errors]);

      expect(sorted1).toEqual(sorted2);
    });
  });

  describe('createResult', () => {
    it('creates valid result with no errors', () => {
      const result = createResult([]);

      expect(result.valid).toBe(true);
      expect(result.errors).toEqual([]);
      expect(result.schemaVersion).toBe('1.0.0');
    });

    it('creates invalid result with errors', () => {
      const errors = [
        createError({ path: '$.id', rule: 'r1', message: 'm1', severity: 'error' }),
      ];

      const result = createResult(errors);

      expect(result.valid).toBe(false);
      expect(result.errors.length).toBe(1);
    });

    it('only counts error severity as invalid', () => {
      const warningsOnly = [
        createError({ path: '$.x', rule: 'r1', message: 'm1', severity: 'warning' }),
        createError({ path: '$.y', rule: 'r2', message: 'm2', severity: 'info' }),
      ];

      const result = createResult(warningsOnly);

      expect(result.valid).toBe(true);
    });

    it('sorts errors in result', () => {
      const errors = [
        createError({ path: '$.z', rule: 'r1', message: 'm1', severity: 'warning' }),
        createError({ path: '$.a', rule: 'r2', message: 'm2', severity: 'error' }),
      ];

      const result = createResult(errors);

      expect(result.errors[0].severity).toBe('error');
      expect(result.errors[1].severity).toBe('warning');
    });

    it('returns frozen result', () => {
      const result = createResult([]);

      expect(Object.isFrozen(result)).toBe(true);
      expect(Object.isFrozen(result.errors)).toBe(true);
    });
  });

  describe('SEVERITY_ORDER', () => {
    it('defines correct priority order', () => {
      expect(SEVERITY_ORDER.error).toBe(0);
      expect(SEVERITY_ORDER.warning).toBe(1);
      expect(SEVERITY_ORDER.info).toBe(2);
    });
  });
});
