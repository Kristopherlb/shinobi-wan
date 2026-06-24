import type { Node } from '@shinobi/ir';
import type { LoweredResource, LoweringContext, NodeLowerer, ResolvedDeps } from '../types';
import { shortName, createStandardTags } from './utils';

/**
 * Lowers a platform node with platform "aws-config-rules" →
 * AWS Config Rule resource.
 *
 * Note: Pulumi uses aws:cfg:Rule (not aws:config:Rule).
 */
export class ConfigRulesLowerer implements NodeLowerer {
  readonly platform = 'aws-config-rules';

  lower(node: Node, context: LoweringContext, _resolvedDeps: ResolvedDeps): ReadonlyArray<LoweredResource> {
    const name = shortName(node.id);
    const props = node.metadata.properties;
    const serviceName = context.adapterConfig.serviceName;
    const extraTags = (props['tags'] as Record<string, string>) ?? {};

    const resources: LoweredResource[] = [];

    const ruleName = `${name}-config-rule`;

    const configRuleProperties: Record<string, unknown> = {
      name: `${serviceName}-${name}`,
      tags: createStandardTags(node.id, 'aws-config-rules', extraTags),
    };

    // Source configuration (managed rule or custom Lambda)
    if (props['source']) {
      configRuleProperties['source'] = props['source'];
    }

    // Input parameters for the rule
    if (props['inputParameters']) {
      configRuleProperties['inputParameters'] = typeof props['inputParameters'] === 'string'
        ? props['inputParameters']
        : JSON.stringify(props['inputParameters']);
    }

    // Evaluation frequency
    if (props['maximumExecutionFrequency']) {
      configRuleProperties['maximumExecutionFrequency'] = props['maximumExecutionFrequency'];
    }

    // Scope
    if (props['scope']) {
      configRuleProperties['scope'] = props['scope'];
    }

    resources.push({
      name: ruleName,
      resourceType: 'aws:cfg:Rule',
      properties: configRuleProperties,
      sourceId: node.id,
      dependsOn: [],
    });

    return resources;
  }
}
