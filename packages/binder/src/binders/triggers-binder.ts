import type { Intent } from '@shinobi/contracts';
import type { IBinder, SupportedEdgePattern, BindingContext, BinderOutput, BindingDiagnostic } from '@shinobi/kernel';
import { createIamIntent, createConfigIntent } from '../intent-factories';

/**
 * Binding config extracted from triggers edge metadata.
 */
interface TriggersBindingConfig {
  readonly resourceType?: string;
  readonly route?: string;
  readonly method?: string;
}

/**
 * TriggersBinder compiles `platform triggers component` edges
 * into IAM + config intents.
 *
 * Example: API Gateway → triggers → Lambda function.
 * The source platform node triggers invocations of the target component.
 */
export class TriggersBinder implements IBinder {
  readonly id = 'triggers-binder';

  readonly supportedEdgeTypes: ReadonlyArray<SupportedEdgePattern> = [
    { edgeType: 'triggers', sourceType: 'platform', targetType: 'component' },
  ];

  compileEdge(context: BindingContext): BinderOutput {
    const { edge, sourceNode, targetNode } = context;
    const intents: Intent[] = [];
    const diagnostics: BindingDiagnostic[] = [];

    const bindingConfig = edge.metadata.bindingConfig as TriggersBindingConfig;

    // Validate required fields
    if (!bindingConfig.resourceType) {
      diagnostics.push({
        path: `$.edges[${edge.id}].metadata.bindingConfig.resourceType`,
        rule: 'missing-resource-type',
        message: `Edge "${edge.id}" is missing required resourceType in bindingConfig`,
        severity: 'error',
      });
      return { intents, diagnostics };
    }

    // Emit IAM intent: the source platform needs permission to invoke the target component
    intents.push(
      createIamIntent(
        edge.id,
        { nodeRef: sourceNode.id, role: sourceNode.type },
        {
          nodeRef: targetNode.id,
          resourceType: bindingConfig.resourceType,
          scope: 'specific', // Triggers always target a specific function
        },
        [{ level: 'write', action: 'invoke' }]
      )
    );

    // Emit config intent: inject the source platform's URL/ID into the target component's env
    const route = bindingConfig.route ?? '/';
    const method = bindingConfig.method ?? 'ANY';

    intents.push(
      createConfigIntent(
        edge.id,
        targetNode.id,
        'API_GATEWAY_URL',
        { type: 'reference', nodeRef: sourceNode.id, field: 'url' }
      )
    );

    // Emit config intent for route metadata (literal values)
    intents.push(
      createConfigIntent(
        edge.id,
        targetNode.id,
        'API_ROUTE',
        { type: 'literal', value: `${method} ${route}` }
      )
    );

    return { intents, diagnostics };
  }
}
