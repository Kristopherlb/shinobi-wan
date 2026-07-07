import type { Node } from '@shinobi/ir';
import type {
  LoweredResource,
  LoweringContext,
  NodeLowerer,
  ResolvedDeps,
} from '../types';
import { shortName, createStandardTags, makeResourceName } from './utils';

/**
 * Lowers a platform node with platform "aws-network-firewall" ->
 * Firewall Policy + Firewall + Logging Configuration + Log Group.
 */
export class NetworkFirewallLowerer implements NodeLowerer {
  readonly platform = 'aws-network-firewall';

  lower(
    node: Node,
    context: LoweringContext,
    _resolvedDeps: ResolvedDeps,
  ): ReadonlyArray<LoweredResource> {
    const name = shortName(node.id);
    const config = node.metadata.properties;
    const extraTags = config['tags'] as Record<string, string> | undefined;
    const tags = createStandardTags(node.id, 'aws-network-firewall', extraTags);

    const policyName = `${name}-fw-policy`;
    const fwName = `${name}-fw`;
    const loggingName = `${name}-fw-logging`;
    const logGroupName = `${name}-fw-log-group`;

    const vpcRef = config['vpcRef'] as string | undefined;
    const statelessDefaultActions = Array.isArray(
      config['statelessDefaultActions'],
    )
      ? (config['statelessDefaultActions'] as string[])
      : ['aws:forward_to_sfe'];
    const statelessFragmentDefaultActions = Array.isArray(
      config['statelessFragmentDefaultActions'],
    )
      ? (config['statelessFragmentDefaultActions'] as string[])
      : ['aws:forward_to_sfe'];
    const statefulRuleGroupReferences = config[
      'statefulRuleGroupReferences'
    ] as unknown[] | undefined;
    const loggingEnabled = config['loggingEnabled'] !== false;
    const deleteProtection = config['deleteProtection'] !== false;

    // Build subnet mappings from node IDs
    const subnetMappings = Array.isArray(config['subnetMappings'])
      ? (config['subnetMappings'] as string[]).map((s) => ({
          subnetId: { ref: `${shortName(s)}-subnet` },
        }))
      : [];

    const resources: LoweredResource[] = [];

    // 1. Firewall Policy
    const policyProperties: Record<string, unknown> = {
      name: makeResourceName(
        node.id,
        context.adapterConfig.serviceName,
        'policy',
      ),
      firewallPolicy: {
        statelessDefaultActions,
        statelessFragmentDefaultActions,
      },
      tags,
    };

    if (statefulRuleGroupReferences) {
      (
        policyProperties.firewallPolicy as Record<string, unknown>
      ).statefulRuleGroupReferences = statefulRuleGroupReferences;
    }

    resources.push({
      name: policyName,
      resourceType: 'aws:networkfirewall:FirewallPolicy',
      properties: policyProperties,
      sourceId: node.id,
      dependsOn: [],
    });

    // 2. Firewall
    const fwProperties: Record<string, unknown> = {
      name: makeResourceName(node.id, context.adapterConfig.serviceName),
      firewallPolicyArn: { ref: `${policyName}.arn` },
      subnetMappings,
      deleteProtection,
      tags,
    };

    if (vpcRef) {
      fwProperties.vpcId = { ref: `${shortName(vpcRef)}-vpc` };
    }

    resources.push({
      name: fwName,
      resourceType: 'aws:networkfirewall:Firewall',
      properties: fwProperties,
      sourceId: node.id,
      dependsOn: [policyName],
    });

    // 3. Log Group (if logging enabled)
    if (loggingEnabled) {
      resources.push({
        name: logGroupName,
        resourceType: 'aws:cloudwatch:LogGroup',
        properties: {
          name: `/aws/network-firewall/${makeResourceName(node.id, context.adapterConfig.serviceName)}`,
          tags,
        },
        sourceId: node.id,
        dependsOn: [],
      });

      // 4. Logging Configuration
      resources.push({
        name: loggingName,
        resourceType: 'aws:networkfirewall:LoggingConfiguration',
        properties: {
          firewallArn: { ref: `${fwName}.arn` },
          loggingConfiguration: {
            logDestinationConfigs: [
              {
                logDestination: { logGroup: { ref: logGroupName } },
                logDestinationType: 'CloudWatchLogs',
                logType: 'ALERT',
              },
            ],
          },
        },
        sourceId: node.id,
        dependsOn: [fwName, logGroupName],
      });
    }

    return resources;
  }
}
