import { describe, it, expect } from 'vitest';
import { validateCapabilityContractSchema } from '@shinobi/validation';
import type { GoldenCase } from '../types';

const CASE_SCHEMA: GoldenCase = {
  id: 'golden:component:capability-schema',
  description: 'Component capability contracts must satisfy required schema and action constraints',
  gates: ['G-005'],
};

const VALID_CAPABILITY_CONTRACT = {
  id: 'aws:sqs-queue@1.0.0',
  schemaVersion: '1.0.0',
  description: 'SQS queue capability',
  dataShape: {
    queueUrl: { type: 'string', required: true },
  },
  actions: ['read', 'write'],
} as const;

describe(`Golden: Component Capability Schema (G-005)`, () => {
  describe(`${CASE_SCHEMA.id} — ${CASE_SCHEMA.description}`, () => {
    it('G-005: accepts a valid capability contract', () => {
      const result = validateCapabilityContractSchema(VALID_CAPABILITY_CONTRACT);
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('G-005: rejects missing actions', () => {
      const invalid = { ...VALID_CAPABILITY_CONTRACT, actions: [] as string[] };
      const result = validateCapabilityContractSchema(invalid);
      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.path === '$.actions')).toBe(true);
    });

    it('G-005: rejects invalid capability id format', () => {
      const invalid = { ...VALID_CAPABILITY_CONTRACT, id: 'bad-capability-id' };
      const result = validateCapabilityContractSchema(invalid);
      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.rule === 'invalid-capability-id')).toBe(true);
    });

    it('G-005: rejects unsupported capability action values', () => {
      const invalid = { ...VALID_CAPABILITY_CONTRACT, actions: ['superuser'] };
      const result = validateCapabilityContractSchema(invalid);
      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.path.startsWith('$.actions['))).toBe(true);
    });

    it('determinism: capability schema validation output is stable', () => {
      const invalid = { ...VALID_CAPABILITY_CONTRACT, id: 'bad-capability-id' };
      const r1 = validateCapabilityContractSchema(invalid);
      const r2 = validateCapabilityContractSchema(invalid);
      expect(JSON.stringify(r1)).toBe(JSON.stringify(r2));
    });
  });
});
