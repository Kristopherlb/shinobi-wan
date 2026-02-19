/**
 * Kernel facade tests: envelope shape, contractVersion, mode split, JSON-serializability.
 */
import { describe, it, expect } from 'vitest';
import {
  contractVersion,
  validatePlan,
  planChange,
  applyChange,
  readEntities,
  readActivity,
  type ToolResponseEnvelope,
} from '../facade';

const TOOL_ID = 'shinobi-kernel';
const TRACE_ID = 'test-trace-1';

describe('kernel facade', () => {
  describe('contractVersion', () => {
    it('exports contractVersion as non-empty string', () => {
      expect(contractVersion).toBeDefined();
      expect(typeof contractVersion).toBe('string');
      expect(contractVersion.length).toBeGreaterThan(0);
    });
  });

  describe('validatePlan', () => {
    it('returns Promise<ToolResponseEnvelope> with success and metadata', async () => {
      const input = { mode: 'plan' as const, snapshot: { nodes: [], edges: [], artifacts: [] }, traceId: TRACE_ID };
      const result = await validatePlan(input);
      expect(result).toBeDefined();
      expect(result.success).toBeDefined();
      expect(typeof result.success).toBe('boolean');
      expect(result.metadata).toBeDefined();
      expect(result.metadata.contractVersion).toBe(contractVersion);
      expect(result.metadata.toolId).toBe(TOOL_ID);
      expect(result.metadata.traceId).toBe(TRACE_ID);
      expect(result.metadata.operationClass).toBe('plan');
      expect(result.metadata.timestamp).toBeDefined();
    });

    it('returns envelope that is JSON-serializable', async () => {
      const input = { mode: 'plan' as const, snapshot: { nodes: [], edges: [], artifacts: [] }, traceId: TRACE_ID };
      const result = await validatePlan(input);
      const serialized = JSON.stringify(result);
      const parsed = JSON.parse(serialized) as ToolResponseEnvelope;
      expect(parsed.success).toBe(result.success);
      expect(parsed.metadata.contractVersion).toBe(contractVersion);
    });

    it('rejects input without mode plan for validatePlan', async () => {
      const input = { mode: 'apply' as const, snapshot: {}, traceId: TRACE_ID };
      const result = await validatePlan(input as Parameters<typeof validatePlan>[0]);
      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
      expect(result.error?.code).toBeDefined();
    });
  });

  describe('planChange', () => {
    it('returns Promise<ToolResponseEnvelope> with deterministic keys', async () => {
      const input = { mode: 'plan' as const, snapshot: { nodes: [], edges: [], artifacts: [] }, traceId: TRACE_ID };
      const result = await planChange(input);
      expect(result).toHaveProperty('success');
      expect(result).toHaveProperty('metadata');
      expect(result.metadata).toHaveProperty('contractVersion');
      expect(result.metadata).toHaveProperty('operationClass', 'plan');
    });
  });

  describe('applyChange', () => {
    it('returns envelope with mode apply in metadata when input.mode is apply', async () => {
      const input = { mode: 'apply' as const, snapshot: { nodes: [], edges: [], artifacts: [] }, traceId: TRACE_ID };
      const result = await applyChange(input);
      expect(result.metadata.operationClass).toBe('apply');
    });
  });

  describe('readEntities', () => {
    it('returns Promise<ToolResponseEnvelope> with read operationClass', async () => {
      const result = await readEntities({ traceId: TRACE_ID });
      expect(result.metadata.operationClass).toBe('read');
      expect(result).toHaveProperty('success');
      expect(result).toHaveProperty('metadata');
    });
  });

  describe('readActivity', () => {
    it('returns Promise<ToolResponseEnvelope> with read operationClass', async () => {
      const result = await readActivity({ traceId: TRACE_ID });
      expect(result.metadata.operationClass).toBe('read');
    });
  });
});
