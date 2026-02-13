import type { NetworkIntent } from '@shinobi/contracts';
import type { LoweredResource, LoweringContext, IntentLowerer } from '../types';

/**
 * Extracts a short name from a kernel node ID.
 */
function shortName(nodeRef: string): string {
  const idx = nodeRef.indexOf(':');
  return idx >= 0 ? nodeRef.substring(idx + 1) : nodeRef;
}

/**
 * Lowers NetworkIntent → SecurityGroup + SecurityGroupRule resources.
 *
 * For MVP (VPC-less Lambda), network intents are recorded as structured
 * metadata but don't produce actual SecurityGroup resources.
 * The lowerer emits placeholder resources that document the network policy.
 */
export class NetworkIntentLowerer implements IntentLowerer<NetworkIntent> {
  readonly intentType = 'network' as const;

  lower(intent: NetworkIntent, _context: LoweringContext): ReadonlyArray<LoweredResource> {
    const sourceName = shortName(intent.source.nodeRef);
    const destName = shortName(intent.destination.nodeRef);
    const ruleName = `${sourceName}-to-${destName}-${intent.direction}`;

    const port = intent.destination.port ?? intent.source.port;
    const protocol = intent.protocol.protocol;

    // For MVP, we record the network intent as a structured resource
    // that can be used when VPC support is added
    return [
      {
        name: ruleName,
        resourceType: 'aws:ec2:SecurityGroupRule',
        properties: {
          type: intent.direction === 'ingress' ? 'ingress' : 'egress',
          protocol: protocol === 'any' ? '-1' : protocol,
          fromPort: port ?? 0,
          toPort: port ?? 65535,
          cidrBlocks: ['0.0.0.0/0'],
          description: `${intent.direction} from ${intent.source.nodeRef} to ${intent.destination.nodeRef}`,
          tags: {
            'shinobi:edge': intent.sourceEdgeId,
            'shinobi:direction': intent.direction,
          },
        },
        sourceId: intent.sourceEdgeId,
        dependsOn: [],
      },
    ];
  }
}
