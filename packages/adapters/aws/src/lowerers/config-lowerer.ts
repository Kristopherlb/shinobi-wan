import type { ConfigIntent } from '@shinobi/contracts';
import type { LoweredResource, LoweringContext, IntentLowerer } from '../types';
import { resolveConfigReference } from './reference-utils';
import { shortName } from './utils';

/**
 * Lowers ConfigIntent → SSM Parameter resources.
 *
 * Each config intent produces an SSM Parameter that stores
 * the configuration value. Lambda functions reference these
 * parameters via environment variables.
 */
export class ConfigIntentLowerer implements IntentLowerer<ConfigIntent> {
  readonly intentType = 'config' as const;

  lower(
    intent: ConfigIntent,
    context: LoweringContext,
  ): ReadonlyArray<LoweredResource> {
    const targetName = shortName(intent.targetNodeRef);
    const paramName = `${context.adapterConfig.serviceName}-${targetName}-${intent.key}`;

    const value = this.resolveValue(intent, context);

    return [
      {
        name: paramName,
        resourceType: 'aws:ssm:Parameter',
        properties: {
          name: `/${context.adapterConfig.serviceName}/${targetName}/${intent.key}`,
          type: 'String',
          value,
          tags: {
            'shinobi:target': intent.targetNodeRef,
            'shinobi:key': intent.key,
            'shinobi:edge': intent.sourceEdgeId,
          },
        },
        sourceId: intent.sourceEdgeId,
        dependsOn: [],
      },
    ];
  }

  private resolveValue(
    intent: ConfigIntent,
    context: LoweringContext,
  ): unknown {
    switch (intent.valueSource.type) {
      case 'literal':
        return String(intent.valueSource.value);
      case 'reference':
        return resolveConfigReference(
          context.snapshot,
          intent.valueSource.nodeRef,
          intent.valueSource.field,
        );
      case 'secret': {
        // Resolve to a real SecretsManager reference: if the ref names a
        // graph node lowered to a Secret, store that secret's ARN; otherwise
        // treat it as an external secret identifier and store it verbatim.
        const secretRef = intent.valueSource.secretRef;
        const node = context.snapshot.nodes.find(
          (n) => n.id === secretRef || shortName(n.id) === shortName(secretRef),
        );
        if (
          node &&
          node.metadata.properties['platform'] === 'aws-secretsmanager'
        ) {
          return { ref: `${shortName(node.id)}-secret.arn` };
        }
        return secretRef;
      }
    }
  }
}
