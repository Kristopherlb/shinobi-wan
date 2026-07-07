import type { Node } from '@shinobi/ir';
import type {
  LoweredResource,
  LoweringContext,
  NodeLowerer,
  ResolvedDeps,
} from '../types';
import { shortName, createStandardTags } from './utils';

/**
 * Lowers a platform node with platform "aws-bedrock" →
 * Bedrock Guardrail + optional logging configuration.
 *
 * Note: Bedrock doesn't create "model" resources — models are accessed
 * via IAM permissions. This lowerer focuses on guardrails and logging.
 */
export class BedrockLowerer implements NodeLowerer {
  readonly platform = 'aws-bedrock';

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

    // Guardrail (primary resource)
    if (props['guardrailEnabled'] === true) {
      const guardrailName = `${name}-bedrock-guardrail`;

      const guardrailProperties: Record<string, unknown> = {
        name: `${serviceName}-${name}-guardrail`,
        blockedInputMessaging:
          'This input is not allowed by the guardrail policy.',
        blockedOutputsMessaging:
          'This output has been blocked by the guardrail policy.',
        tags: createStandardTags(node.id, 'aws-bedrock', extraTags),
      };

      // Content filter configuration
      if (props['contentFilterConfig']) {
        guardrailProperties['contentPolicyConfig'] =
          props['contentFilterConfig'];
      }

      resources.push({
        name: guardrailName,
        resourceType: 'aws:bedrock:Guardrail',
        properties: guardrailProperties,
        sourceId: node.id,
        dependsOn: [],
      });
    }

    // Invocation logging configuration
    if (props['invocationLogging'] === true) {
      const logGroupName = `${name}-bedrock-log-group`;
      resources.push({
        name: logGroupName,
        resourceType: 'aws:cloudwatch:LogGroup',
        properties: {
          name: `/aws/bedrock/${serviceName}-${name}`,
          retentionInDays: (props['logRetentionDays'] as number) ?? 30,
          tags: createStandardTags(node.id, 'aws-bedrock', extraTags),
        },
        sourceId: node.id,
        dependsOn: [],
      });
    }

    // If neither guardrail nor logging, emit a placeholder for reference resolution
    if (resources.length === 0) {
      resources.push({
        name: `${name}-bedrock-config`,
        resourceType: 'aws:bedrock:Guardrail',
        properties: {
          name: `${serviceName}-${name}-guardrail`,
          blockedInputMessaging: 'This input is not allowed.',
          blockedOutputsMessaging: 'This output has been blocked.',
          tags: createStandardTags(node.id, 'aws-bedrock', extraTags),
        },
        sourceId: node.id,
        dependsOn: [],
      });
    }

    return resources;
  }
}
