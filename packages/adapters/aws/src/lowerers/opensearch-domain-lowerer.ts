import type { Node } from '@shinobi/ir';
import type { LoweredResource, LoweringContext, NodeLowerer, ResolvedDeps } from '../types';
import { shortName, createStandardTags } from './utils';

/**
 * Lowers a platform node with platform "aws-opensearch" →
 * OpenSearch Domain + CloudWatch LogGroup.
 */
export class OpenSearchDomainLowerer implements NodeLowerer {
  readonly platform = 'aws-opensearch';

  lower(node: Node, context: LoweringContext, _resolvedDeps: ResolvedDeps): ReadonlyArray<LoweredResource> {
    const name = shortName(node.id);
    const props = node.metadata.properties;
    const serviceName = context.adapterConfig.serviceName;
    const extraTags = (props['tags'] as Record<string, string>) ?? {};

    const resources: LoweredResource[] = [];

    const domainName = `${name}-domain`;
    const logGroupName = `${name}-domain-log-group`;

    // CloudWatch LogGroup for domain logs
    resources.push({
      name: logGroupName,
      resourceType: 'aws:cloudwatch:LogGroup',
      properties: {
        name: `/aws/opensearch/${serviceName}-${name}`,
        retentionInDays: 30,
        tags: createStandardTags(node.id, 'aws-opensearch', extraTags),
      },
      sourceId: node.id,
      dependsOn: [],
    });

    // OpenSearch Domain
    const engineVersion = (props['engineVersion'] as string) ?? 'OpenSearch_2.11';
    const instanceType = (props['instanceType'] as string) ?? 't3.small.search';
    const instanceCount = (props['instanceCount'] as number) ?? 2;
    const ebsEnabled = props['ebsEnabled'] !== false;
    const volumeSize = (props['volumeSize'] as number) ?? 20;
    const encryptionAtRest = props['encryptionAtRest'] === true;
    const nodeToNodeEncryption = props['nodeToNodeEncryption'] === true;
    const enforceHTTPS = props['enforceHTTPS'] !== false;
    const publicAccess = props['publicAccess'] === true;

    const domainProperties: Record<string, unknown> = {
      domainName: `${serviceName}-${name}`,
      engineVersion,
      clusterConfig: {
        instanceType,
        instanceCount,
      },
      ebsOptions: {
        ebsEnabled,
        volumeSize,
      },
      encryptAtRestOptions: {
        enabled: encryptionAtRest,
      },
      nodeToNodeEncryptionOptions: {
        enabled: nodeToNodeEncryption,
      },
      domainEndpointOptions: {
        enforceHTTPS,
      },
      tags: createStandardTags(node.id, 'aws-opensearch', extraTags),
      logPublishingOptions: {
        INDEX_SLOW_LOGS: {
          cloudWatchLogsLogGroupArn: { ref: `${logGroupName}.arn` },
          enabled: true,
        },
      },
    };

    // VPC config
    const subnetIds = props['subnetIds'] as string[] | undefined;
    const securityGroupIds = props['securityGroupIds'] as string[] | undefined;
    if (!publicAccess && (subnetIds || securityGroupIds)) {
      domainProperties['vpcOptions'] = {
        ...(subnetIds ? { subnetIds } : {}),
        ...(securityGroupIds ? { securityGroupIds } : {}),
      };
    }

    resources.push({
      name: domainName,
      resourceType: 'aws:opensearch:Domain',
      properties: domainProperties,
      sourceId: node.id,
      dependsOn: [logGroupName],
    });

    return resources;
  }
}
