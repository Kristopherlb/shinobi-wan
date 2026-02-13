import { describe, it, expect } from 'vitest';
import {
  hasRequiredField,
  hasRequiredFields,
  rejectUnknownFields,
  validateEnumField,
  validateStringField,
} from '../../schema/field-validators';

describe('field-validators', () => {
  describe('hasRequiredField', () => {
    it('returns empty array for present field', () => {
      const errors = hasRequiredField({ name: 'test' }, '$.name', 'name', 'string');
      expect(errors).toEqual([]);
    });

    it('returns error for missing field', () => {
      const errors = hasRequiredField({}, '$.name', 'name', 'string');
      expect(errors).toHaveLength(1);
      expect(errors[0].path).toBe('$.name');
      expect(errors[0].rule).toBe('missing-required-field');
      expect(errors[0].severity).toBe('error');
    });

    it('returns error for null field', () => {
      const errors = hasRequiredField({ name: null }, '$.name', 'name', 'string');
      expect(errors).toHaveLength(1);
      expect(errors[0].rule).toBe('missing-required-field');
    });

    it('returns error for wrong type (expected string, got number)', () => {
      const errors = hasRequiredField({ name: 42 }, '$.name', 'name', 'string');
      expect(errors).toHaveLength(1);
      expect(errors[0].rule).toBe('invalid-field-type');
      expect(errors[0].message).toContain('expected string');
    });

    it('returns error for wrong type (expected object, got string)', () => {
      const errors = hasRequiredField({ data: 'test' }, '$.data', 'data', 'object');
      expect(errors).toHaveLength(1);
      expect(errors[0].rule).toBe('invalid-field-type');
    });

    it('validates array type', () => {
      const errors = hasRequiredField({ items: [1, 2] }, '$.items', 'items', 'array');
      expect(errors).toEqual([]);
    });

    it('returns error for non-array when expecting array', () => {
      const errors = hasRequiredField({ items: {} }, '$.items', 'items', 'array');
      expect(errors).toHaveLength(1);
      expect(errors[0].rule).toBe('invalid-field-type');
    });
  });

  describe('hasRequiredFields', () => {
    it('returns empty array when all fields present', () => {
      const obj = { id: 'abc', type: 'node', version: '1.0.0' };
      const errors = hasRequiredFields(obj, '$', [
        { field: 'id', type: 'string' },
        { field: 'type', type: 'string' },
        { field: 'version', type: 'string' },
      ]);
      expect(errors).toEqual([]);
    });

    it('returns errors for all missing fields', () => {
      const obj = { id: 'abc' };
      const errors = hasRequiredFields(obj, '$', [
        { field: 'id', type: 'string' },
        { field: 'type', type: 'string' },
        { field: 'version', type: 'string' },
      ]);
      expect(errors).toHaveLength(2);
      expect(errors.map((e) => e.path)).toContain('$.type');
      expect(errors.map((e) => e.path)).toContain('$.version');
    });
  });

  describe('rejectUnknownFields', () => {
    it('returns empty array when all fields are known', () => {
      const obj = { id: 'abc', type: 'node' };
      const errors = rejectUnknownFields(obj, '$', new Set(['id', 'type']));
      expect(errors).toEqual([]);
    });

    it('returns error for unknown field', () => {
      const obj = { id: 'abc', type: 'node', extra: 'value' };
      const errors = rejectUnknownFields(obj, '$', new Set(['id', 'type']));
      expect(errors).toHaveLength(1);
      expect(errors[0].path).toBe('$.extra');
      expect(errors[0].rule).toBe('unknown-field');
      expect(errors[0].severity).toBe('error');
    });

    it('returns multiple errors for multiple unknown fields', () => {
      const obj = { id: 'abc', extra1: 'x', extra2: 'y' };
      const errors = rejectUnknownFields(obj, '$', new Set(['id']));
      expect(errors).toHaveLength(2);
    });

    it('handles empty known fields set', () => {
      const obj = { a: 1, b: 2 };
      const errors = rejectUnknownFields(obj, '$', new Set());
      expect(errors).toHaveLength(2);
    });
  });

  describe('validateEnumField', () => {
    it('returns empty array for valid enum value', () => {
      const errors = validateEnumField('component', '$.type', ['component', 'platform', 'edge']);
      expect(errors).toEqual([]);
    });

    it('returns error for invalid enum value', () => {
      const errors = validateEnumField('invalid', '$.type', ['component', 'platform']);
      expect(errors).toHaveLength(1);
      expect(errors[0].rule).toBe('invalid-enum-value');
      expect(errors[0].allowedValues).toEqual(['component', 'platform']);
    });

    it('handles single allowed value', () => {
      const errors = validateEnumField('other', '$.version', ['1.0.0']);
      expect(errors).toHaveLength(1);
      expect(errors[0].allowedValues).toEqual(['1.0.0']);
    });
  });

  describe('validateStringField', () => {
    it('returns empty array for valid string', () => {
      const errors = validateStringField('test', '$.name');
      expect(errors).toEqual([]);
    });

    it('returns error for empty string', () => {
      const errors = validateStringField('', '$.name');
      expect(errors).toHaveLength(1);
      expect(errors[0].rule).toBe('empty-string');
    });

    it('returns error for non-string', () => {
      const errors = validateStringField(42 as unknown as string, '$.name');
      expect(errors).toHaveLength(1);
      expect(errors[0].rule).toBe('invalid-field-type');
    });
  });
});
