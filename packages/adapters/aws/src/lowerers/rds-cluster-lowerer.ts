import type { Node } from '@shinobi/ir';
import type {
  LoweredResource,
  LoweringContext,
  NodeLowerer,
  ResolvedDeps,
} from '../types';
import { shortName, createStandardTags } from './utils';

/**
 * Lowers a platform node with platform "aws-rds-cluster" →
 * RDS Cluster + ClusterInstance + optional SubnetGroup.
 */
export class RdsClusterLowerer implements NodeLowerer {
  readonly platform = 'aws-rds-cluster';

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

    const clusterName = `${name}-rds-cluster`;
    const instanceName = `${name}-rds-instance`;

    const engine = (props['engine'] as string) ?? 'aurora-postgresql';
    const engineVersion = (props['engineVersion'] as string) ?? '15.4';
    const masterUsername = (props['masterUsername'] as string) ?? 'admin';
    const storageEncrypted = props['storageEncrypted'] !== false;
    const deletionProtection = props['deletionProtection'] !== false;
    const backupRetentionPeriod =
      (props['backupRetentionPeriod'] as number) ?? 7;
    const publicAccess = props['publicAccess'] === true;
    const instanceClass = (props['instanceClass'] as string) ?? 'db.serverless';

    // Optional SubnetGroup
    const subnetIds = props['subnetIds'] as string[] | undefined;
    const subnetGroupName = `${name}-rds-subnet-group`;
    const clusterDeps: string[] = [];

    if (subnetIds && subnetIds.length > 0) {
      resources.push({
        name: subnetGroupName,
        resourceType: 'aws:rds:SubnetGroup',
        properties: {
          name: `${serviceName}-${name}`,
          subnetIds,
          tags: createStandardTags(node.id, 'aws-rds-cluster', extraTags),
        },
        sourceId: node.id,
        dependsOn: [],
      });
      clusterDeps.push(subnetGroupName);
    }

    // RDS Cluster
    const clusterProperties: Record<string, unknown> = {
      clusterIdentifier: `${serviceName}-${name}`,
      engine,
      engineVersion,
      masterUsername,
      storageEncrypted,
      deletionProtection,
      backupRetentionPeriod,
      tags: createStandardTags(node.id, 'aws-rds-cluster', extraTags),
    };

    if (props['masterPassword']) {
      clusterProperties['masterPassword'] = props['masterPassword'];
    }
    if (props['databaseName']) {
      clusterProperties['databaseName'] = props['databaseName'];
    }
    if (props['kmsKeyId']) {
      clusterProperties['kmsKeyId'] = props['kmsKeyId'];
    }
    if (subnetIds && subnetIds.length > 0) {
      clusterProperties['dbSubnetGroupName'] = { ref: subnetGroupName };
    }
    if (props['securityGroupIds']) {
      clusterProperties['vpcSecurityGroupIds'] = props['securityGroupIds'];
    }

    // Serverless v2 scaling
    if (instanceClass === 'db.serverless') {
      const minCapacity = (props['serverlessMinCapacity'] as number) ?? 0.5;
      const maxCapacity = (props['serverlessMaxCapacity'] as number) ?? 16;
      clusterProperties['serverlessv2ScalingConfiguration'] = {
        minCapacity,
        maxCapacity,
      };
    }

    resources.push({
      name: clusterName,
      resourceType: 'aws:rds:Cluster',
      properties: clusterProperties,
      sourceId: node.id,
      dependsOn: clusterDeps,
    });

    // RDS Cluster Instance
    resources.push({
      name: instanceName,
      resourceType: 'aws:rds:ClusterInstance',
      properties: {
        clusterIdentifier: { ref: clusterName },
        instanceClass,
        engine,
        publiclyAccessible: publicAccess,
        tags: createStandardTags(node.id, 'aws-rds-cluster', extraTags),
      },
      sourceId: node.id,
      dependsOn: [clusterName],
    });

    return resources;
  }
}
