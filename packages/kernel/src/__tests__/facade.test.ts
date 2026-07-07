/**
 * Kernel facade tests: envelope shape, contractVersion, mode split,
 * JSON-serializability, and real behavior (results derive from inputs).
 */
import { describe, it, expect } from 'vitest';
import { createTestNode, createTestEdge } from '@shinobi/ir';
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

const NODE_A = createTestNode({ id: 'component:app/a', type: 'component' });
const NODE_B = createTestNode({ id: 'component:app/b', type: 'component' });
const EDGE_AB = createTestEdge({
  id: 'edge:bindsTo:component:app/a:component:app/b',
  type: 'bindsTo',
  source: 'component:app/a',
  target: 'component:app/b',
});

const EMPTY_SNAPSHOT = { nodes: [], edges: [], artifacts: [] };
const SNAPSHOT = { nodes: [NODE_A, NODE_B], edges: [EDGE_AB], artifacts: [] };

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
      const input = {
        mode: 'plan' as const,
        snapshot: EMPTY_SNAPSHOT,
        traceId: TRACE_ID,
      };
      const result = await validatePlan(input);
      expect(result).toBeDefined();
      expect(result.success).toBeDefined();
      expect(typeof result.success).toBe('boolean');
      expect(result.metadata).toBeDefined();
      expect(result.metadata.contractVersion).toBe(contractVersion);
      expect(result.metadata.toolId).toBe(TOOL_ID);
      expect(result.metadata.traceId).toBe(TRACE_ID);
      expect(result.metadata.operationClass).toBe('plan');
    });

    it('returns structured diagnostics, not just a boolean', async () => {
      const result = await validatePlan({
        mode: 'plan',
        snapshot: SNAPSHOT,
        traceId: TRACE_ID,
      });
      expect(result.success).toBe(true);
      expect(result.data?.valid).toBe(true);
      expect(result.data?.errorCount).toBe(0);
      expect(Array.isArray(result.data?.errors)).toBe(true);
    });

    it('surfaces validation errors with path/rule/message for a bad snapshot', async () => {
      const badNode = { ...NODE_A, id: '' };
      const result = await validatePlan({
        mode: 'plan',
        snapshot: { nodes: [badNode], edges: [], artifacts: [] },
        traceId: TRACE_ID,
      });
      expect(result.data?.valid).toBe(false);
      expect(result.data?.errorCount).toBeGreaterThan(0);
      const first = result.data?.errors[0];
      expect(first?.path).toBeTruthy();
      expect(first?.rule).toBeTruthy();
      expect(first?.message).toBeTruthy();
    });

    it('returns byte-identical envelopes for identical inputs', async () => {
      const input = {
        mode: 'plan' as const,
        snapshot: SNAPSHOT,
        traceId: TRACE_ID,
      };
      const first = JSON.stringify(await validatePlan(input));
      const second = JSON.stringify(await validatePlan(input));
      expect(second).toBe(first);
    });

    it('returns envelope that is JSON-serializable', async () => {
      const input = {
        mode: 'plan' as const,
        snapshot: SNAPSHOT,
        traceId: TRACE_ID,
      };
      const result = await validatePlan(input);
      const serialized = JSON.stringify(result);
      const parsed = JSON.parse(serialized) as ToolResponseEnvelope;
      expect(parsed.success).toBe(result.success);
      expect(parsed.metadata.contractVersion).toBe(contractVersion);
    });

    it('rejects input without mode plan for validatePlan', async () => {
      const input = { mode: 'apply' as const, snapshot: {}, traceId: TRACE_ID };
      const result = await validatePlan(
        input as Parameters<typeof validatePlan>[0],
      );
      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
      expect(result.error?.code).toBeDefined();
    });
  });

  describe('planChange', () => {
    it('computes a deterministic plan summary from the snapshot', async () => {
      const result = await planChange({
        mode: 'plan',
        snapshot: SNAPSHOT,
        traceId: TRACE_ID,
      });
      expect(result.success).toBe(true);
      expect(result.data?.planned).toBe(true);
      expect(result.data?.summary.nodeCount).toBe(2);
      expect(result.data?.summary.edgeCount).toBe(1);
      expect(result.data?.summary.artifactCount).toBe(0);
      expect(result.data?.summary.semanticHash).toMatch(
        /^sha256:[0-9a-f]{64}$/,
      );
    });

    it('produces the same semanticHash regardless of input ordering', async () => {
      const forward = await planChange({
        mode: 'plan',
        snapshot: { nodes: [NODE_A, NODE_B], edges: [EDGE_AB], artifacts: [] },
        traceId: TRACE_ID,
      });
      const reversed = await planChange({
        mode: 'plan',
        snapshot: { nodes: [NODE_B, NODE_A], edges: [EDGE_AB], artifacts: [] },
        traceId: TRACE_ID,
      });
      expect(reversed.data?.summary.semanticHash).toBe(
        forward.data?.summary.semanticHash,
      );
    });

    it('fails with structured diagnostics for an invalid snapshot', async () => {
      const result = await planChange({
        mode: 'plan',
        snapshot: { nodes: [{ ...NODE_A, id: '' }], edges: [], artifacts: [] },
        traceId: TRACE_ID,
      });
      expect(result.success).toBe(false);
      expect(result.error?.code).toBe('INPUT_VALIDATION_FAILED');
      expect(result.error?.details?.errors).toBeDefined();
    });

    it('rejects mode apply', async () => {
      const result = await planChange({
        mode: 'apply',
        snapshot: EMPTY_SNAPSHOT,
        traceId: TRACE_ID,
      } as unknown as Parameters<typeof planChange>[0]);
      expect(result.success).toBe(false);
      expect(result.error?.code).toBe('MODE_MISMATCH');
    });
  });

  describe('applyChange', () => {
    it('applies mutations on top of the snapshot and reports the result', async () => {
      const result = await applyChange({
        mode: 'apply',
        snapshot: { nodes: [NODE_A], edges: [], artifacts: [] },
        mutations: [{ type: 'addNode', node: NODE_B }],
        traceId: TRACE_ID,
      });
      expect(result.success).toBe(true);
      expect(result.data?.applied).toBe(true);
      expect(result.data?.appliedCount).toBe(1);
      expect(result.data?.summary.nodeCount).toBe(2);
    });

    it('is idempotent: re-adding an identical node is skipped, not applied', async () => {
      const result = await applyChange({
        mode: 'apply',
        snapshot: { nodes: [NODE_A], edges: [], artifacts: [] },
        mutations: [{ type: 'addNode', node: NODE_A }],
        traceId: TRACE_ID,
      });
      expect(result.success).toBe(true);
      expect(result.data?.appliedCount).toBe(0);
      expect(result.data?.skippedCount).toBe(1);
      expect(result.data?.summary.nodeCount).toBe(1);
    });

    it('reports a conflict for same-id different-content mutations', async () => {
      const conflicting = createTestNode({
        id: 'component:app/a',
        type: 'component',
        metadata: { properties: { changed: true } },
      });
      const result = await applyChange({
        mode: 'apply',
        snapshot: { nodes: [NODE_A], edges: [], artifacts: [] },
        mutations: [{ type: 'addNode', node: conflicting }],
        traceId: TRACE_ID,
      });
      expect(result.success).toBe(false);
      expect(result.error?.code).toBe('CONFLICT');
      expect(result.error?.category).toBe('conflict');
    });

    it('rejects malformed mutations with a structured error', async () => {
      const result = await applyChange({
        mode: 'apply',
        snapshot: EMPTY_SNAPSHOT,
        mutations: [{ type: 'renameNode', id: 'x' }],
        traceId: TRACE_ID,
      });
      expect(result.success).toBe(false);
      expect(result.error?.code).toBe('INPUT_VALIDATION_FAILED');
      expect(result.error?.message).toContain('mutations[0]');
    });

    it('returns envelope with mode apply in metadata when input.mode is apply', async () => {
      const result = await applyChange({
        mode: 'apply',
        snapshot: EMPTY_SNAPSHOT,
        traceId: TRACE_ID,
      });
      expect(result.metadata.operationClass).toBe('apply');
    });
  });

  describe('readEntities', () => {
    it('projects entities from the snapshot in canonical order', async () => {
      const result = await readEntities({
        traceId: TRACE_ID,
        snapshot: { nodes: [NODE_B, NODE_A], edges: [EDGE_AB], artifacts: [] },
      });
      expect(result.success).toBe(true);
      expect(result.metadata.operationClass).toBe('read');
      expect(result.data?.entities).toEqual([
        { id: 'component:app/a', kind: 'node', type: 'component' },
        { id: 'component:app/b', kind: 'node', type: 'component' },
        {
          id: 'edge:bindsTo:component:app/a:component:app/b',
          kind: 'edge',
          type: 'bindsTo',
        },
      ]);
    });

    it('returns an empty list without a snapshot', async () => {
      const result = await readEntities({ traceId: TRACE_ID });
      expect(result.success).toBe(true);
      expect(result.data?.entities).toEqual([]);
    });
  });

  describe('readActivity', () => {
    it('returns empty activity (facade is stateless, no activity store)', async () => {
      const result = await readActivity({ traceId: TRACE_ID });
      expect(result.metadata.operationClass).toBe('read');
      expect(result.data?.activity).toEqual([]);
    });
  });
});
