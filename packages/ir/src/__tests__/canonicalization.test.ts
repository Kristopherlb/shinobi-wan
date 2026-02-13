import { describe, it, expect } from 'vitest';
import { canonicalize, canonicalStringify } from '../canonicalization';

describe('canonicalize', () => {
  describe('primitive values', () => {
    it('preserves null', () => {
      expect(canonicalize(null)).toBe(null);
    });

    it('preserves booleans', () => {
      expect(canonicalize(true)).toBe(true);
      expect(canonicalize(false)).toBe(false);
    });

    it('preserves strings', () => {
      expect(canonicalize('hello')).toBe('hello');
      expect(canonicalize('')).toBe('');
    });

    it('normalizes -0 to 0', () => {
      expect(canonicalize(-0)).toBe(0);
      expect(Object.is(canonicalize(-0), 0)).toBe(true);
      expect(Object.is(canonicalize(-0), -0)).toBe(false);
    });

    it('preserves regular numbers', () => {
      expect(canonicalize(42)).toBe(42);
      expect(canonicalize(3.14)).toBe(3.14);
      expect(canonicalize(-1)).toBe(-1);
    });
  });

  describe('arrays', () => {
    it('preserves array order', () => {
      expect(canonicalize([3, 1, 2])).toEqual([3, 1, 2]);
    });

    it('recursively canonicalizes array elements', () => {
      const input = [{ b: 1, a: 2 }];
      const result = canonicalize(input) as unknown[];
      expect(Object.keys(result[0] as object)).toEqual(['a', 'b']);
    });
  });

  describe('objects', () => {
    it('sorts keys lexicographically', () => {
      const input = { zebra: 1, apple: 2, banana: 3 };
      const result = canonicalize(input);
      expect(Object.keys(result as object)).toEqual(['apple', 'banana', 'zebra']);
    });

    it('sorts keys at every nesting level', () => {
      const input = {
        z: { b: 1, a: 2 },
        a: { d: 3, c: 4 },
      };
      const result = canonicalize(input) as Record<string, Record<string, number>>;

      expect(Object.keys(result)).toEqual(['a', 'z']);
      expect(Object.keys(result.a)).toEqual(['c', 'd']);
      expect(Object.keys(result.z)).toEqual(['a', 'b']);
    });

    it('handles deeply nested structures', () => {
      const input = {
        level1: {
          z: { c: { b: 1, a: 2 } },
          a: { x: 3 },
        },
      };
      const result = canonicalize(input) as Record<string, unknown>;
      const level1 = result.level1 as Record<string, unknown>;

      expect(Object.keys(level1)).toEqual(['a', 'z']);
    });
  });

  describe('key order independence', () => {
    it('produces identical output regardless of input key order', () => {
      const obj1 = { a: 1, b: 2, c: 3 };
      const obj2 = { c: 3, a: 1, b: 2 };
      const obj3 = { b: 2, c: 3, a: 1 };

      expect(canonicalize(obj1)).toEqual(canonicalize(obj2));
      expect(canonicalize(obj2)).toEqual(canonicalize(obj3));
    });

    it('produces identical stringified output regardless of input key order', () => {
      const obj1 = { nested: { z: 1, a: 2 }, x: 3 };
      const obj2 = { x: 3, nested: { a: 2, z: 1 } };

      expect(canonicalStringify(obj1)).toBe(canonicalStringify(obj2));
    });
  });

  describe('error handling', () => {
    it('throws for undefined values', () => {
      expect(() => canonicalize(undefined)).toThrow();
    });

    it('throws for functions', () => {
      // eslint-disable-next-line @typescript-eslint/no-empty-function
      expect(() => canonicalize(() => {})).toThrow();
    });

    it('throws for symbols', () => {
      expect(() => canonicalize(Symbol('test'))).toThrow();
    });
  });
});

describe('canonicalStringify', () => {
  it('produces deterministic JSON output', () => {
    const obj = { b: 1, a: 2 };
    const expected = JSON.stringify({ a: 2, b: 1 }, null, 2);

    expect(canonicalStringify(obj)).toBe(expected);
  });

  it('handles complex nested structures', () => {
    const obj = {
      z: [{ b: 1, a: 2 }],
      a: { d: 3, c: 4 },
    };

    const result = canonicalStringify(obj);

    // Verify it's valid JSON
    expect(() => JSON.parse(result)).not.toThrow();

    // Verify key order in output
    const parsed = JSON.parse(result);
    expect(Object.keys(parsed)).toEqual(['a', 'z']);
    expect(Object.keys(parsed.a)).toEqual(['c', 'd']);
  });

  it('normalizes -0 in stringified output', () => {
    const obj = { value: -0 };
    const result = canonicalStringify(obj);

    // JSON.stringify(-0) produces "0", so this should match
    expect(result).toContain('"value": 0');
  });
});
