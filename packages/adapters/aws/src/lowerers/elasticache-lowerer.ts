import type { Node } from '@shinobi/ir';
import type {
  LoweredResource,
  LoweringContext,
  NodeLowerer,
  ResolvedDeps,
} from '../types';
import { shortName, createStandardTags } from './utils';

/**
 * Lowers a platform node with platform "aws-elasticache" →
 * ElastiCache Redis ReplicationGroup + SubnetGroup.
 *
 * Important: Pulumi uses aws:elasticache:ReplicationGroup for Redis.
 * aws:elasticache:Cluster is Memcached only.
 */
export class ElastiCacheLowerer implements NodeLowerer {
  readonly platform = 'aws-elasticache';

  lower(
    node: Node,
    context: LoweringContext,
    _resolvedDeps: ResolvedDeps,
  ): ReadonlyArray<LoweredResource> {
    const name = shortName(node.id);
    const props = node.metadata.properties;
    const serviceName = context.adapterConfig.serviceName;
    const extraTags = (props['tags'] as Record<string, string>) ?? {};

    const resources: LoweredResource[] = [];

    // Subnet Group (required for VPC deployment)
    const subnetGroupName = `${name}-redis-subnet-group`;
    const subnetIds = (props['subnetIds'] as string[]) ?? [];
    resources.push({
      name: subnetGroupName,
      resourceType: 'aws:elasticache:SubnetGroup',
      properties: {
        name: `${serviceName}-${name}-subnet-group`,
        description: `Subnet group for ${serviceName}-${name} Redis`,
        subnetIds:
          subnetIds.length > 0
            ? subnetIds.map((s) => ({ ref: `${shortName(s)}-subnet` }))
            : [],
        tags: createStandardTags(node.id, 'aws-elasticache', extraTags),
      },
      sourceId: node.id,
      dependsOn: [],
    });

    // ReplicationGroup
    const redisName = `${name}-redis`;
    const nodeType = (props['nodeType'] as string) ?? 'cache.t3.micro';
    const numCacheClusters = (props['numCacheClusters'] as number) ?? 2;
    const transitEncryptionEnabled =
      props['transitEncryptionEnabled'] !== false;
    const atRestEncryptionEnabled = props['atRestEncryptionEnabled'] !== false;
    const port = (props['port'] as number) ?? 6379;

    const replicationGroupProperties: Record<string, unknown> = {
      replicationGroupDescription: `${serviceName}-${name}`,
      nodeType,
      numCacheClusters,
      transitEncryptionEnabled,
      atRestEncryptionEnabled,
      port,
      subnetGroupName: { ref: subnetGroupName },
      tags: createStandardTags(node.id, 'aws-elasticache', extraTags),
    };

    if (props['authToken']) {
      replicationGroupProperties['authToken'] = props['authToken'];
    }

    if (props['securityGroupIds']) {
      replicationGroupProperties['securityGroupIds'] = (
        props['securityGroupIds'] as string[]
      ).map((sg) => ({ ref: `${shortName(sg)}-sg` }));
    }

    resources.push({
      name: redisName,
      resourceType: 'aws:elasticache:ReplicationGroup',
      properties: replicationGroupProperties,
      sourceId: node.id,
      dependsOn: [subnetGroupName],
    });

    return resources;
  }
}
