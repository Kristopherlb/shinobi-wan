import type { NetworkIntent } from '@shinobi/contracts';
import type { Node } from '@shinobi/ir';
import type { LoweredResource, LoweringContext, IntentLowerer } from '../types';
import { shortName } from './utils';

/**
 * Lowers NetworkIntent → security-group rules between modeled security groups.
 *
 * Security groups are the only network enforcement point this adapter manages,
 * so a rule is emitted only when BOTH endpoints resolve to
 * `aws-security-group` platform nodes. Connectivity between non-VPC resources
 * (e.g. Lambda → SQS over AWS APIs) has no security-group enforcement point;
 * those intents are enforced by the IAM intents emitted alongside them, and
 * the adapter records an explanatory diagnostic instead of emitting a
 * pseudo-resource (KL-005: never widen to 0.0.0.0/0 to fake enforcement).
 */
export class NetworkIntentLowerer implements IntentLowerer<NetworkIntent> {
  readonly intentType = 'network' as const;

  lower(
    intent: NetworkIntent,
    context: LoweringContext,
  ): ReadonlyArray<LoweredResource> {
    const sourceSg = securityGroupRef(context, intent.source.nodeRef);
    const destinationSg = securityGroupRef(context, intent.destination.nodeRef);
    if (!sourceSg || !destinationSg) {
      return [];
    }

    // The rule is attached to the SG being protected: the destination for
    // ingress, the source for egress. The other SG scopes the peer.
    const enforced = intent.direction === 'ingress' ? destinationSg : sourceSg;
    const peer = intent.direction === 'ingress' ? sourceSg : destinationSg;

    const portRanges = resolvePortRanges(intent);
    if (portRanges.length === 0) {
      // No port information and not an explicit allow-all: emitting a rule
      // would require guessing wider than the intent states.
      return [];
    }

    const protocol =
      intent.protocol.protocol === 'any' ? '-1' : intent.protocol.protocol;

    return portRanges.map(({ from, to }) => ({
      name: `${enforced}-net-${intent.direction}-${protocol}-${from}-${to}`,
      resourceType: 'aws:ec2:SecurityGroupRule',
      properties: {
        securityGroupId: { ref: enforced },
        resourceType: intent.direction,
        protocol,
        fromPort: from,
        toPort: to,
        sourceSecurityGroupId: { ref: peer },
      },
      sourceId: intent.sourceEdgeId,
      dependsOn: [enforced, peer],
    }));
  }
}

function securityGroupRef(
  context: LoweringContext,
  nodeRef: string,
): string | undefined {
  const node: Node | undefined = context.snapshot.nodes.find(
    (n) => n.id === nodeRef,
  );
  const platform = node?.metadata.properties['platform'];
  if (platform !== 'aws-security-group') {
    return undefined;
  }
  return `${shortName(nodeRef)}-sg`;
}

function resolvePortRanges(
  intent: NetworkIntent,
): ReadonlyArray<{ from: number; to: number }> {
  const endpoint =
    intent.direction === 'ingress' ? intent.destination : intent.source;
  if (endpoint.portRange) {
    return [{ from: endpoint.portRange.from, to: endpoint.portRange.to }];
  }
  if (endpoint.port !== undefined) {
    return [{ from: endpoint.port, to: endpoint.port }];
  }
  if (intent.protocol.ports && intent.protocol.ports.length > 0) {
    return [...intent.protocol.ports]
      .sort((a, b) => a - b)
      .map((port) => ({ from: port, to: port }));
  }
  if (intent.protocol.protocol === 'any') {
    // Explicit allow-all between the two security groups.
    return [{ from: 0, to: 0 }];
  }
  return [];
}
