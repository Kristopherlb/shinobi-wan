import type { Node } from '@shinobi/ir';
import type {
  LoweredResource,
  LoweringContext,
  NodeLowerer,
  ResolvedDeps,
} from '../types';
import { shortName, createStandardTags } from './utils';

/**
 * Lowers a platform node with platform "aws-rds-proxy" →
 * RDS Proxy + ProxyDefaultTargetGroup + ProxyTarget.
 */
export class RdsProxyLowerer implements NodeLowerer {
  readonly platform = 'aws-rds-proxy';

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

    const proxyName = `${name}-rds-proxy`;
    const targetGroupName = `${name}-rds-proxy-target-group`;
    const targetName = `${name}-rds-proxy-target`;

    const engineFamily = (props['engineFamily'] as string) ?? 'POSTGRESQL';
    const requireTls = props['requireTls'] !== false;
    const idleClientTimeout = (props['idleClientTimeout'] as number) ?? 1800;
    const debugLogging = props['debugLogging'] === true;

    // RDS Proxy
    const proxyProperties: Record<string, unknown> = {
      name: `${serviceName}-${name}`,
      engineFamily,
      requireTls,
      idleClientTimeout,
      debugLogging,
      tags: createStandardTags(node.id, 'aws-rds-proxy', extraTags),
      auths: [],
    };

    if (props['secretArn']) {
      proxyProperties['auths'] = [
        {
          authScheme: 'SECRETS',
          iamAuth: 'DISABLED',
          secretArn: props['secretArn'],
        },
      ];
    }

    if (props['subnetIds']) {
      proxyProperties['vpcSubnetIds'] = props['subnetIds'];
    }
    if (props['securityGroupIds']) {
      proxyProperties['vpcSecurityGroupIds'] = props['securityGroupIds'];
    }
    if (props['roleArn']) {
      proxyProperties['roleArn'] = props['roleArn'];
    }

    resources.push({
      name: proxyName,
      resourceType: 'aws:rds:Proxy',
      properties: proxyProperties,
      sourceId: node.id,
      dependsOn: [],
    });

    // Proxy Default Target Group
    resources.push({
      name: targetGroupName,
      resourceType: 'aws:rds:ProxyDefaultTargetGroup',
      properties: {
        dbProxyName: { ref: proxyName },
        connectionPoolConfig: {
          maxConnectionsPercent: 100,
          maxIdleConnectionsPercent: 50,
        },
      },
      sourceId: node.id,
      dependsOn: [proxyName],
    });

    // Proxy Target
    const targetProperties: Record<string, unknown> = {
      dbProxyName: { ref: proxyName },
      targetGroupName: 'default',
    };

    if (props['clusterRef']) {
      targetProperties['dbClusterIdentifier'] = props['clusterRef'];
    }

    resources.push({
      name: targetName,
      resourceType: 'aws:rds:ProxyTarget',
      properties: targetProperties,
      sourceId: node.id,
      dependsOn: [proxyName, targetGroupName],
    });

    return resources;
  }
}
