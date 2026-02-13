import { describe, it, expect } from 'vitest';
import { deepFreeze } from '../freeze';

describe('deepFreeze', () => {
  it('passes primitives through unchanged', () => {
    expect(deepFreeze(42)).toBe(42);
    expect(deepFreeze('hello')).toBe('hello');
    expect(deepFreeze(true)).toBe(true);
    expect(deepFreeze(null)).toBe(null);
    expect(deepFreeze(undefined)).toBe(undefined);
  });

  it('freezes a flat object', () => {
    const obj = { a: 1, b: 'two' };
    const frozen = deepFreeze(obj);
    expect(Object.isFrozen(frozen)).toBe(true);
    expect(frozen).toBe(obj); // same reference
  });

  it('freezes nested objects recursively', () => {
    const obj = { a: { b: { c: 3 } } };
    deepFreeze(obj);
    expect(Object.isFrozen(obj)).toBe(true);
    expect(Object.isFrozen(obj.a)).toBe(true);
    expect(Object.isFrozen(obj.a.b)).toBe(true);
  });

  it('freezes arrays and their elements', () => {
    const arr = [{ x: 1 }, { y: 2 }];
    deepFreeze(arr);
    expect(Object.isFrozen(arr)).toBe(true);
    expect(Object.isFrozen(arr[0])).toBe(true);
    expect(Object.isFrozen(arr[1])).toBe(true);
  });

  it('is idempotent — calling twice is safe', () => {
    const obj = { a: { b: 1 } };
    const first = deepFreeze(obj);
    const second = deepFreeze(first);
    expect(first).toBe(second);
    expect(Object.isFrozen(second)).toBe(true);
  });

  it('prevents mutation on frozen objects', () => {
    const obj = deepFreeze({ a: 1, nested: { b: 2 } });
    expect(() => {
      (obj as Record<string, unknown>).a = 99;
    }).toThrow();
    expect(() => {
      (obj.nested as Record<string, unknown>).b = 99;
    }).toThrow();
  });

  it('prevents mutation on frozen arrays', () => {
    const arr = deepFreeze([1, 2, 3]);
    expect(() => {
      (arr as number[]).push(4);
    }).toThrow();
  });
});
