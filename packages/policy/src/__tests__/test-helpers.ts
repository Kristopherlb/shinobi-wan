import type { IamIntent, NetworkIntent } from '@shinobi/contracts';

// Re-export shared graph test fixtures from IR
export { createTestNode as makeNode, createTestEdge as makeEdge, createSnapshot as makeSnapshot } from '@shinobi/ir';

/**
 * Creates a test IAM intent.
 */
export function makeIamIntent(
  overrides: Partial<IamIntent> & { sourceEdgeId: string }
): IamIntent {
  return {
    type: 'iam',
    schemaVersion: '1.0.0',
    sourceEdgeId: overrides.sourceEdgeId,
    principal: overrides.principal ?? { nodeRef: 'component:svc', role: 'service' },
    resource: overrides.resource ?? {
      nodeRef: 'platform:db',
      resourceType: 'table',
      scope: 'specific',
    },
    actions: overrides.actions ?? [{ level: 'read', action: 'read' }],
    ...(overrides.conditions ? { conditions: overrides.conditions } : {}),
  };
}

/**
 * Creates a test network intent.
 */
export function makeNetworkIntent(
  overrides: Partial<NetworkIntent> & { sourceEdgeId: string }
): NetworkIntent {
  return {
    type: 'network',
    schemaVersion: '1.0.0',
    sourceEdgeId: overrides.sourceEdgeId,
    direction: overrides.direction ?? 'egress',
    source: overrides.source ?? { nodeRef: 'component:svc' },
    destination: overrides.destination ?? { nodeRef: 'platform:db', port: 5432 },
    protocol: overrides.protocol ?? { protocol: 'tcp' },
  };
}
