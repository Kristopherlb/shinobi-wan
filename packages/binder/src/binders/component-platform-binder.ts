import type { Intent } from '@shinobi/contracts';
import type { IBinder, SupportedEdgePattern, BindingContext, BinderOutput, BindingDiagnostic } from '@shinobi/kernel';
import { createIamIntent, createNetworkIntent, createConfigIntent } from '../intent-factories';

/**
 * Access level → IAM action mapping.
 * Each level includes all lower levels' actions.
 */
const ACCESS_LEVEL_ACTIONS: Record<string, ReadonlyArray<string>> = {
  read: ['read'],
  write: ['read', 'write'],
  admin: ['read', 'write', 'admin'],
};

/**
 * Binding config extracted from edge metadata.
 */
interface BindingConfig {
  readonly accessLevel?: string;
  readonly resourceType?: string;
  readonly scope?: 'specific' | 'pattern';
  readonly actions?: ReadonlyArray<string>;
  readonly network?: {
    readonly port?: number;
    readonly protocol?: 'tcp' | 'udp' | 'any';
  };
  readonly configKeys?: ReadonlyArray<{
    readonly key: string;
    readonly valueSource: { readonly type: 'literal'; readonly value: string | number | boolean }
      | { readonly type: 'reference'; readonly nodeRef: string; readonly field: string }
      | { readonly type: 'secret'; readonly secretRef: string };
  }>;
}

/**
 * ComponentPlatformBinder compiles `component bindsTo platform` edges
 * into IAM + network + config intents.
 *
 * This is the most fundamental binding scenario in Shinobi, exercising
 * all intent types. It reads binding directives from edge.metadata.bindingConfig.
 */
export class ComponentPlatformBinder implements IBinder {
  readonly id = 'component-platform-binder';

  readonly supportedEdgeTypes: ReadonlyArray<SupportedEdgePattern> = [
    { edgeType: 'bindsTo', sourceType: 'component', targetType: 'platform' },
  ];

  compileEdge(context: BindingContext): BinderOutput {
    const { edge, sourceNode, targetNode } = context;
    const intents: Intent[] = [];
    const diagnostics: BindingDiagnostic[] = [];

    const bindingConfig = edge.metadata.bindingConfig as BindingConfig;

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

    // Resolve access level
    const accessLevel = bindingConfig.accessLevel ?? 'read';
    const actionNames = bindingConfig.actions ?? ACCESS_LEVEL_ACTIONS[accessLevel];

    if (!actionNames) {
      diagnostics.push({
        path: `$.edges[${edge.id}].metadata.bindingConfig.accessLevel`,
        rule: 'unknown-access-level',
        message: `Unknown access level "${accessLevel}". Allowed values: read, write, admin`,
        severity: 'warning',
      });
      return { intents, diagnostics };
    }

    // Emit IAM intent
    const iamActions = (actionNames as ReadonlyArray<string>).map((action) => ({
      level: resolveActionLevel(action),
      action,
    }));

    intents.push(
      createIamIntent(
        edge.id,
        { nodeRef: sourceNode.id, role: sourceNode.type },
        {
          nodeRef: targetNode.id,
          resourceType: bindingConfig.resourceType,
          scope: bindingConfig.scope ?? 'specific',
        },
        iamActions
      )
    );

    // Emit network intent if network config present
    if (bindingConfig.network) {
      const port = bindingConfig.network.port;
      const protocol = bindingConfig.network.protocol ?? 'tcp';
      intents.push(
        createNetworkIntent(
          edge.id,
          'egress',
          { nodeRef: sourceNode.id, ...(port !== undefined ? { port } : {}) },
          { nodeRef: targetNode.id, ...(port !== undefined ? { port } : {}) },
          { protocol, ...(port !== undefined ? { ports: [port] } : {}) }
        )
      );
    }

    // Emit config intents if configKeys present
    if (bindingConfig.configKeys) {
      for (const configEntry of bindingConfig.configKeys) {
        intents.push(
          createConfigIntent(
            edge.id,
            sourceNode.id,
            configEntry.key,
            configEntry.valueSource
          )
        );
      }
    }

    return { intents, diagnostics };
  }
}

/**
 * Maps an action name to its IAM action level.
 */
function resolveActionLevel(action: string): 'read' | 'write' | 'admin' {
  if (action === 'admin') return 'admin';
  if (action === 'write') return 'write';
  return 'read';
}
