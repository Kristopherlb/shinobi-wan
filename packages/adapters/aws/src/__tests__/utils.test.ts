import { describe, it, expect } from 'vitest';
import { shortName } from '../lowerers/utils';

describe('shortName', () => {
  it('extracts name after colon', () => {
    expect(shortName('component:api-handler')).toBe('api-handler');
  });

  it('returns full string when no colon', () => {
    expect(shortName('no-colon')).toBe('no-colon');
  });

  it('handles multiple colons by splitting on first', () => {
    expect(shortName('component:deep:nested')).toBe('deep:nested');
  });

  it('handles empty string', () => {
    expect(shortName('')).toBe('');
  });

  it('handles colon-only', () => {
    expect(shortName(':')).toBe('');
  });

  it('handles platform prefix', () => {
    expect(shortName('platform:work-queue')).toBe('work-queue');
  });
});
