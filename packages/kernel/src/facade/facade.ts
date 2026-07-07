/**
 * Kernel facade: stable entrypoints for Harmony (validatePlan, planChange, applyChange, readEntities, readActivity).
 * All methods return Promise<ToolResponseEnvelope<...>> with JSON-serializable payloads.
 *
 * The facade is stateless: every call derives its result from the snapshot
 * passed in. Apply-mode side effects (real deployment) live in the CLI and
 * adapter layers; applyChange here applies graph mutations in memory and
 * reports the resulting graph, which is the kernel's whole jurisdiction.
 */
import { createSnapshot, computeSemanticHash, Graph } from '@shinobi/ir';
import type { Node, Edge, DerivedArtifact, GraphMutation } from '@shinobi/ir';
import type {
  ValidatePlanInput,
  PlanChangeInput,
  ApplyChangeInput,
  ReadEntitiesInput,
  ReadActivityInput,
} from './inputs';
import { buildEnvelope, buildErrorEnvelope } from './build-envelope';
import type { ToolResponseEnvelope } from './envelope-types';

const SOURCE = 'kernel.facade';

function traceId(input: { traceId?: string }): string {
  return input.traceId ?? 'no-trace';
}

function failure<T>(
  operationClass: 'read' | 'plan' | 'apply',
  tid: string,
  code: string,
  message: string,
  details?: Readonly<Record<string, unknown>>,
): ToolResponseEnvelope<T> {
  return buildEnvelope<T>(
    operationClass,
    tid,
    false,
    undefined,
    buildErrorEnvelope(code, SOURCE, message, tid, details),
  );
}

function toSnapshot(input: Readonly<Record<string, unknown>>): {
  nodes: Node[];
  edges: Edge[];
  artifacts: DerivedArtifact[];
} {
  const nodes = (input.nodes as Node[] | undefined) ?? [];
  const edges = (input.edges as Edge[] | undefined) ?? [];
  const artifacts = (input.artifacts as DerivedArtifact[] | undefined) ?? [];
  return { nodes, edges, artifacts };
}

/** Structured validation diagnostic surfaced through envelopes (KL-006). */
export interface ValidationDiagnostic {
  readonly path: string;
  readonly rule: string;
  readonly message: string;
  readonly severity: string;
}

/** Deterministic summary of a snapshot: counts plus semantic hash. */
export interface SnapshotSummary {
  readonly nodeCount: number;
  readonly edgeCount: number;
  readonly artifactCount: number;
  readonly semanticHash: string;
}

/** Canonical entity projection returned by readEntities. */
export interface EntityRef {
  readonly id: string;
  readonly kind: 'node' | 'edge' | 'artifact';
  readonly type: string;
}

function summarize(snapshot: {
  nodes: ReadonlyArray<Node>;
  edges: ReadonlyArray<Edge>;
  artifacts: ReadonlyArray<DerivedArtifact>;
}): SnapshotSummary {
  const canonical = createSnapshot(
    snapshot.nodes,
    snapshot.edges,
    snapshot.artifacts,
  );
  return {
    nodeCount: canonical.nodes.length,
    edgeCount: canonical.edges.length,
    artifactCount: canonical.artifacts.length,
    semanticHash: computeSemanticHash(canonical),
  };
}

function toDiagnostics(
  errors: ReadonlyArray<{
    path: string;
    rule: string;
    message: string;
    severity: string;
  }>,
): ValidationDiagnostic[] {
  return errors.map((e) => ({
    path: e.path,
    rule: e.rule,
    message: e.message,
    severity: e.severity,
  }));
}

/**
 * Validate a plan (plan mode): validate snapshot only, no side effects.
 * Returns the full structured diagnostics, not just a boolean.
 */
export async function validatePlan(input: ValidatePlanInput): Promise<
  ToolResponseEnvelope<{
    valid: boolean;
    errorCount: number;
    warningCount: number;
    errors: ValidationDiagnostic[];
  }>
> {
  const tid = traceId(input);
  if (input.mode !== 'plan') {
    return failure(
      'plan',
      tid,
      'MODE_MISMATCH',
      'validatePlan requires mode "plan"',
      { expected: 'plan', received: input.mode },
    );
  }
  try {
    const { nodes, edges, artifacts } = toSnapshot(input.snapshot);
    const snapshot = createSnapshot(nodes, edges, artifacts);
    const { validateGraph } = await import('@shinobi/validation');
    const validation = validateGraph(snapshot, {
      strict: true,
      level: 'full',
      collectAll: true,
    });
    const errors = toDiagnostics(validation.errors);
    return buildEnvelope('plan', tid, true, {
      valid: validation.valid,
      errorCount: errors.filter((e) => e.severity === 'error').length,
      warningCount: errors.filter((e) => e.severity === 'warning').length,
      errors,
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    return failure('plan', tid, 'INPUT_VALIDATION_FAILED', message);
  }
}

/**
 * Plan change (plan mode): validate the snapshot and compute the deterministic
 * planned state — entity counts and the canonical semantic hash. Identical
 * snapshots always produce identical plans (KL-001).
 */
export async function planChange(input: PlanChangeInput): Promise<
  ToolResponseEnvelope<{
    planned: boolean;
    summary: SnapshotSummary;
  }>
> {
  const tid = traceId(input);
  if (input.mode !== 'plan') {
    return failure(
      'plan',
      tid,
      'MODE_MISMATCH',
      'planChange requires mode "plan"',
      { expected: 'plan', received: input.mode },
    );
  }
  try {
    const { nodes, edges, artifacts } = toSnapshot(input.snapshot);
    const snapshot = createSnapshot(nodes, edges, artifacts);
    const { validateGraph } = await import('@shinobi/validation');
    const validation = validateGraph(snapshot, {
      strict: true,
      level: 'full',
      collectAll: true,
    });
    if (!validation.valid) {
      return failure(
        'plan',
        tid,
        'INPUT_VALIDATION_FAILED',
        'snapshot failed validation; nothing to plan',
        { errors: toDiagnostics(validation.errors) },
      );
    }
    return buildEnvelope('plan', tid, true, {
      planned: true,
      summary: summarize({ nodes, edges, artifacts }),
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    return failure('plan', tid, 'INPUT_VALIDATION_FAILED', message);
  }
}

function parseMutations(
  raw: ReadonlyArray<Readonly<Record<string, unknown>>>,
): { mutations: GraphMutation[] } | { error: string } {
  const mutations: GraphMutation[] = [];
  for (const [index, entry] of raw.entries()) {
    const type = entry.type;
    if (type === 'addNode' && entry.node != null) {
      mutations.push({ type, node: entry.node as Node });
    } else if (type === 'addEdge' && entry.edge != null) {
      mutations.push({ type, edge: entry.edge as Edge });
    } else if (type === 'addArtifact' && entry.artifact != null) {
      mutations.push({
        type,
        artifact: entry.artifact as DerivedArtifact,
      });
    } else {
      return {
        error: `mutations[${index}] is not a valid GraphMutation (expected addNode|addEdge|addArtifact with matching payload)`,
      };
    }
  }
  return { mutations };
}

/**
 * Apply change (apply mode): apply graph mutations in memory on top of the
 * provided snapshot and report the resulting graph state. Deployment-level
 * side effects live in the CLI/adapter layers, not the kernel.
 */
export async function applyChange(input: ApplyChangeInput): Promise<
  ToolResponseEnvelope<{
    applied: boolean;
    appliedCount: number;
    skippedCount: number;
    summary: SnapshotSummary;
  }>
> {
  const tid = traceId(input);
  if (input.mode !== 'apply') {
    return failure(
      'apply',
      tid,
      'MODE_MISMATCH',
      'applyChange requires mode "apply"',
      { expected: 'apply', received: input.mode },
    );
  }
  try {
    const { nodes, edges, artifacts } = toSnapshot(input.snapshot);
    const graph = new Graph();
    const seed = graph.applyMutation([
      ...nodes.map((node) => ({ type: 'addNode', node }) as const),
      ...edges.map((edge) => ({ type: 'addEdge', edge }) as const),
      ...artifacts.map(
        (artifact) => ({ type: 'addArtifact', artifact }) as const,
      ),
    ]);
    if (!seed.success) {
      return failure(
        'apply',
        tid,
        'INPUT_VALIDATION_FAILED',
        'snapshot could not be loaded as a graph',
        { errors: seed.errors.map((e) => e.error.message) },
      );
    }
    const parsed = parseMutations(input.mutations ?? []);
    if ('error' in parsed) {
      return failure('apply', tid, 'INPUT_VALIDATION_FAILED', parsed.error);
    }
    const result = graph.applyMutation(parsed.mutations);
    if (!result.success) {
      return failure(
        'apply',
        tid,
        'CONFLICT',
        'one or more mutations conflict with the existing graph',
        { errors: result.errors.map((e) => e.error.message) },
      );
    }
    const after = graph.toSnapshot();
    return buildEnvelope('apply', tid, true, {
      applied: true,
      appliedCount: result.appliedCount,
      skippedCount: result.skippedCount,
      summary: summarize(after),
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    return failure('apply', tid, 'INPUT_VALIDATION_FAILED', message);
  }
}

/**
 * Read entities (read-only): canonical projection of the entities in the
 * provided snapshot. Without a snapshot there is nothing to read and the
 * list is empty.
 */
export async function readEntities(
  input: ReadEntitiesInput,
): Promise<ToolResponseEnvelope<{ entities: EntityRef[] }>> {
  const tid = traceId(input);
  try {
    if (!input.snapshot) {
      return buildEnvelope('read', tid, true, { entities: [] });
    }
    const { nodes, edges, artifacts } = toSnapshot(input.snapshot);
    const canonical = createSnapshot(nodes, edges, artifacts);
    const entities: EntityRef[] = [
      ...canonical.nodes.map((n) => ({
        id: n.id,
        kind: 'node' as const,
        type: n.type,
      })),
      ...canonical.edges.map((e) => ({
        id: e.id,
        kind: 'edge' as const,
        type: e.type,
      })),
      ...canonical.artifacts.map((a) => ({
        id: a.id,
        kind: 'artifact' as const,
        type: a.type,
      })),
    ];
    return buildEnvelope('read', tid, true, { entities });
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    return failure('read', tid, 'INPUT_VALIDATION_FAILED', message);
  }
}

/**
 * Read activity (read-only). The facade is stateless and has no activity or
 * audit store, so this is empty by contract in the facade-only path; real
 * activity records are emitted by the CLI/integration layer's audit trail.
 */
export async function readActivity(
  input: ReadActivityInput,
): Promise<ToolResponseEnvelope<{ activity: unknown[] }>> {
  const tid = traceId(input);
  return buildEnvelope('read', tid, true, { activity: [] });
}
