/**
 * JSON-serializable envelope types for kernel facade responses.
 * All payloads are deterministic and safe for tool/API boundaries.
 */

/** Error payload within an envelope (no functions, JSON-serializable). */
export interface ToolErrorEnvelope {
  readonly code: string;
  readonly category: 'validation' | 'authorization' | 'upstream' | 'runtime' | 'conflict' | 'unknown';
  readonly source: string;
  readonly traceId: string;
  readonly message: string;
  readonly details?: Readonly<Record<string, unknown>>;
  readonly retriable: boolean;
  readonly retriableReason?: string;
}

/** Metadata present on every envelope response. */
export interface ToolResponseMetadata {
  readonly toolId: string;
  readonly contractVersion: string;
  readonly operationClass: 'read' | 'plan' | 'apply';
  readonly traceId: string;
  readonly timestamp: string;
}

/** Standard response envelope for all facade methods (JSON-serializable). */
export interface ToolResponseEnvelope<T = unknown> {
  readonly success: boolean;
  readonly metadata: ToolResponseMetadata;
  readonly data?: T;
  readonly error?: ToolErrorEnvelope;
}
