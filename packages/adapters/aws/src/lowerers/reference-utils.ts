import type { GraphSnapshot } from '@shinobi/ir';
import { shortName } from './utils';

/** Maps platform → resource suffix and default output field for config references. */
export const PLATFORM_REF_MAP: Record<string, { suffix: string; defaultField: string }> = {
  'aws-sqs': { suffix: 'queue', defaultField: 'url' },
  'aws-dynamodb': { suffix: 'table', defaultField: 'name' },
  'aws-apigateway': { suffix: 'api', defaultField: '' }, // uses caller-provided field
  'aws-s3': { suffix: 'bucket', defaultField: 'bucket' },
  'aws-sns': { suffix: 'topic', defaultField: 'arn' },
};

function resolveNode(snapshot: GraphSnapshot, nodeRef: string) {
  return (
    snapshot.nodes.find((n) => n.id === nodeRef) ??
    snapshot.nodes.find((n) => n.id === `platform:${nodeRef}`) ??
    snapshot.nodes.find((n) => n.id === `component:${nodeRef}`)
  );
}

/**
 * Converts a logical config reference (nodeRef + field) into an adapter resource ref.
 * Keeps fallback behavior deterministic when a node cannot be resolved.
 */
export function resolveConfigReference(
  snapshot: GraphSnapshot,
  nodeRef: string,
  field: string,
): { ref: string } {
  const targetNode = resolveNode(snapshot, nodeRef);
  if (!targetNode) {
    return { ref: `${nodeRef}.${field}` };
  }

  const platform = targetNode.metadata.properties['platform'] as string | undefined;
  const name = shortName(targetNode.id);

  if (platform) {
    const mapping = PLATFORM_REF_MAP[platform];
    if (mapping) {
      const outputField = mapping.defaultField || field;
      return { ref: `${name}-${mapping.suffix}.${outputField}` };
    }
  }

  return { ref: `${nodeRef}.${field}` };
}
