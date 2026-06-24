import type { Node } from '@shinobi/ir';
import type { LoweredResource, LoweringContext, NodeLowerer, ResolvedDeps } from '../types';
import { shortName, createStandardTags } from './utils';

/**
 * Lowers a platform node with platform "aws-route53-record" -> Route53 Record.
 */
export class Route53RecordLowerer implements NodeLowerer {
  readonly platform = 'aws-route53-record';

  lower(node: Node, _context: LoweringContext, _resolvedDeps: ResolvedDeps): ReadonlyArray<LoweredResource> {
    const name = shortName(node.id);
    const config = node.metadata.properties;
    const extraTags = config['tags'] as Record<string, string> | undefined;
    const tags = createStandardTags(node.id, 'aws-route53-record', extraTags);

    const recordName = `${name}-record`;

    const zoneRef = config['zoneRef'] as string | undefined;
    const rName = config['recordName'] as string | undefined;
    const recordType = config['recordType'] as string | undefined;
    const ttl = (config['ttl'] as number) ?? 300;
    const records = config['records'] as string[] | undefined;
    const alias = config['alias'] as Record<string, unknown> | undefined;

    const properties: Record<string, unknown> = {
      name: rName,
      type: recordType,
      tags,
    };

    if (zoneRef) {
      properties.zoneId = { ref: `${shortName(zoneRef)}-zone.zoneId` };
    }

    if (alias) {
      properties.aliases = [alias];
    } else {
      properties.ttl = ttl;
      if (records) properties.records = records;
    }

    return [
      {
        name: recordName,
        resourceType: 'aws:route53:Record',
        properties,
        sourceId: node.id,
        dependsOn: [],
      },
    ];
  }
}
