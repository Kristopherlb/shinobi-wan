import type { EdgeType, NodeType } from '@shinobi/ir';
import type { BindingContext, BinderOutput } from '../types';

/**
 * Describes which edge patterns a binder supports.
 */
export interface SupportedEdgePattern {
  readonly edgeType: EdgeType;
  readonly sourceType: NodeType;
  readonly targetType: NodeType;
}

/**
 * Interface that binder implementations must satisfy.
 *
 * Binders are deterministic "edge compilers" that map
 * (edge + context) → backend-neutral intents.
 */
export interface IBinder {
  /** Unique binder identifier */
  readonly id: string;

  /** Edge patterns this binder handles */
  readonly supportedEdgeTypes: ReadonlyArray<SupportedEdgePattern>;

  /** Compile a single edge into intents + diagnostics */
  compileEdge(context: BindingContext): BinderOutput;
}
