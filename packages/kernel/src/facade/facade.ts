/**
 * Kernel facade: stable entrypoints for Harmony (validatePlan, planChange, applyChange, readEntities, readActivity).
 * All methods return Promise<ToolResponseEnvelope<...>> with JSON-serializable payloads.
 */
import { createSnapshot } from '@shinobi/ir';
import type { Node, Edge, DerivedArtifact } from '@shinobi/ir';
import type { ValidatePlanInput, PlanChangeInput, ApplyChangeInput, ReadEntitiesInput, ReadActivityInput } from './inputs';
import { buildEnvelope, buildErrorEnvelope } from './build-envelope';

const SOURCE = 'kernel.facade';

function traceId(input: { traceId?: string }): string {
  return input.traceId ?? 'no-trace';
}

function toSnapshot(input: Readonly<Record<string, unknown>>): { nodes: Node[]; edges: Edge[]; artifacts: DerivedArtifact[] } {
  const nodes = (input.nodes as Node[] | undefined) ?? [];
  const edges = (input.edges as Edge[] | undefined) ?? [];
  const artifacts = (input.artifacts as DerivedArtifact[] | undefined) ?? [];
  return { nodes, edges, artifacts };
}

/**
 * Validate a plan (plan mode): validate snapshot only, no side effects.
 */
export async function validatePlan(
  input: ValidatePlanInput
): Promise<import('./envelope-types').ToolResponseEnvelope<{ valid: boolean }>> {
  const tid = traceId(input);
  if (input.mode !== 'plan') {
    return buildEnvelope<{ valid: boolean }>(
      'plan',
      tid,
      false,
      undefined,
      buildErrorEnvelope('MODE_MISMATCH', SOURCE, 'validatePlan requires mode "plan"', tid, { expected: 'plan', received: input.mode })
    );
  }
  try {
    const { nodes, edges, artifacts } = toSnapshot(input.snapshot);
    const snapshot = createSnapshot(nodes, edges, artifacts);
    const { validateGraph } = await import('@shinobi/validation');
    const validation = validateGraph(snapshot, { strict: true, level: 'full', collectAll: true });
    return buildEnvelope('plan', tid, true, { valid: validation.valid });
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    return buildEnvelope<{ valid: boolean }>(
      'plan',
      tid,
      false,
      undefined,
      buildErrorEnvelope('INPUT_VALIDATION_FAILED', SOURCE, message, tid)
    );
  }
}

/**
 * Plan change (plan mode): compute planned change from snapshot, no apply.
 */
export async function planChange(
  input: PlanChangeInput
): Promise<import('./envelope-types').ToolResponseEnvelope<{ planned: boolean }>> {
  const tid = traceId(input);
  if (input.mode !== 'plan') {
    return buildEnvelope<{ planned: boolean }>(
      'plan',
      tid,
      false,
      undefined,
      buildErrorEnvelope('MODE_MISMATCH', SOURCE, 'planChange requires mode "plan"', tid, { expected: 'plan', received: input.mode })
    );
  }
  return buildEnvelope('plan', tid, true, { planned: true });
}

/**
 * Apply change (apply mode): apply mutations (stub: no actual mutation in facade-only path).
 */
export async function applyChange(
  input: ApplyChangeInput
): Promise<import('./envelope-types').ToolResponseEnvelope<{ applied: boolean }>> {
  const tid = traceId(input);
  if (input.mode !== 'apply') {
    return buildEnvelope<{ applied: boolean }>(
      'apply',
      tid,
      false,
      undefined,
      buildErrorEnvelope('MODE_MISMATCH', SOURCE, 'applyChange requires mode "apply"', tid, { expected: 'apply', received: input.mode })
    );
  }
  return buildEnvelope('apply', tid, true, { applied: true });
}

/**
 * Read entities (read-only).
 */
export async function readEntities(
  input: ReadEntitiesInput
): Promise<import('./envelope-types').ToolResponseEnvelope<{ entities: unknown[] }>> {
  const tid = traceId(input);
  return buildEnvelope('read', tid, true, { entities: [] });
}

/**
 * Read activity (read-only).
 */
export async function readActivity(
  input: ReadActivityInput
): Promise<import('./envelope-types').ToolResponseEnvelope<{ activity: unknown[] }>> {
  const tid = traceId(input);
  return buildEnvelope('read', tid, true, { activity: [] });
}
