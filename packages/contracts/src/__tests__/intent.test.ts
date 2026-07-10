import { describe, it, expect } from 'vitest';
import { INTENT_TYPES } from '../intent/index';

describe('INTENT_TYPES', () => {
  it('defines the four intent types', () => {
    expect(INTENT_TYPES).toEqual(['iam', 'network', 'config', 'telemetry']);
  });
});
