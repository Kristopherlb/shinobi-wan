/**
 * Build JSON-serializable envelopes for facade responses.
 */
import { CONTRACT_VERSION } from './contract-version';
import type {
  ToolResponseEnvelope,
  ToolErrorEnvelope,
  ToolResponseMetadata,
} from './envelope-types';

const TOOL_ID = 'shinobi-kernel';

export function buildErrorEnvelope(
  code: string,
  source: string,
  message: string,
  traceId: string,
  details?: Readonly<Record<string, unknown>>,
): ToolErrorEnvelope {
  const category =
    code === 'INPUT_VALIDATION_FAILED' || code === 'MODE_MISMATCH'
      ? 'validation'
      : code === 'CONFLICT'
        ? 'conflict'
        : 'unknown';
  return {
    code,
    category,
    source,
    traceId,
    message,
    ...(details ? { details } : {}),
    retriable: false,
  };
}

export function buildEnvelope<T>(
  operationClass: 'read' | 'plan' | 'apply',
  traceId: string,
  success: boolean,
  data?: T,
  error?: ToolErrorEnvelope,
): ToolResponseEnvelope<T> {
  const metadata: ToolResponseMetadata = {
    toolId: TOOL_ID,
    contractVersion: CONTRACT_VERSION,
    operationClass,
    traceId,
  };
  const out: ToolResponseEnvelope<T> = {
    success,
    metadata,
    ...(data !== undefined ? { data } : {}),
    ...(error !== undefined ? { error } : {}),
  };
  return out;
}
