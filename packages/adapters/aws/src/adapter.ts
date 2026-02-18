import type { Intent, IamIntent, ConfigIntent } from '@shinobi/contracts';
import type {
  LoweringContext,
  AdapterResult,
  LoweredResource,
  LoweringDiagnostic,
  IntentLowerer,
  NodeLowerer,
  ResolvedDeps,
} from './types';
import type { Node } from '@shinobi/ir';
import { IamIntentLowerer, NetworkIntentLowerer, ConfigIntentLowerer } from './lowerers';
import { LambdaLowerer, SqsLowerer, DynamoDbLowerer, S3Lowerer, ApiGatewayLowerer, SnsLowerer } from './lowerers';
import { resolveConfigReference } from './lowerers/reference-utils';
import { shortName } from './lowerers/utils';
import { NodeLowererRegistry, createDefaultNodeLowererRegistry } from './lowerer-registry';

/** Default intent lowerers */
const INTENT_LOWERERS: ReadonlyArray<IntentLowerer> = [
  new IamIntentLowerer(),
  new NetworkIntentLowerer(),
  new ConfigIntentLowerer(),
];

/** Default node/resource lowerers */
const NODE_LOWERERS: ReadonlyArray<NodeLowerer> = [
  new LambdaLowerer(),
  new SqsLowerer(),
  new DynamoDbLowerer(),
  new S3Lowerer(),
  new ApiGatewayLowerer(),
  new SnsLowerer(),
];

const DEFAULT_NODE_LOWERER_REGISTRY = createDefaultNodeLowererRegistry();

export interface LowerOptions {
  /** Plugin-style registry lookup path (default). */
  readonly nodeLowererRegistry?: NodeLowererRegistry;
  /** Rollback switch to use legacy static array lookup path. */
  readonly useLegacyNodeLowererLookup?: boolean;
}

/**
 * Lowers a compilation result into AWS resources.
 *
 * Process:
 * 1. Lower each intent into AWS resources (IAM, network, config)
 * 2. Resolve dependencies (role names, env vars) per node
 * 3. Lower each node into AWS resources (Lambda, SQS)
 * 4. Generate event source mappings for trigger/bind relationships
 * 5. Return deterministically ordered resource list
 */
export function lower(context: LoweringContext, options?: LowerOptions): AdapterResult {
  const allResources: LoweredResource[] = [];
  const diagnostics: LoweringDiagnostic[] = [];
  const resourceMap: Record<string, string[]> = {};

  // Phase 1: Lower intents
  for (const intent of context.intents) {
    if (intent.type === 'network') {
      diagnostics.push({
        severity: 'warning',
        message:
          'Network intent lowering is not yet supported by the AWS adapter; intent was recorded but no resource was emitted',
        sourceId: intent.sourceEdgeId,
      });
      continue;
    }

    const lowerer = INTENT_LOWERERS.find((l) => l.intentType === intent.type);
    if (!lowerer) {
      // Telemetry intents are silently skipped for MVP
      if (intent.type !== 'telemetry') {
        diagnostics.push({
          severity: 'warning',
          message: `No lowerer for intent type '${intent.type}'`,
          sourceId: intent.sourceEdgeId,
        });
      }
      continue;
    }

    try {
      const resources = lowerer.lower(intent, context);
      allResources.push(...resources);

      // Track which intents generated which resources
      if (!resourceMap[intent.sourceEdgeId]) {
        resourceMap[intent.sourceEdgeId] = [];
      }
      resourceMap[intent.sourceEdgeId].push(...resources.map((r) => r.name));
    } catch (e) {
      diagnostics.push({
        severity: 'error',
        message: `Intent lowerer "${lowerer.constructor.name}" failed: ${(e as Error).message}`,
        sourceId: intent.sourceEdgeId,
      });
    }
  }

  // Phase 2: Resolve per-node dependencies from intents
  const nodeDeps = resolveNodeDeps(context);

  // Phase 3: Lower nodes into AWS resources
  for (const node of context.snapshot.nodes) {
    const platform = node.metadata.properties['platform'] as string | undefined;
    if (!platform) continue;

    const lowerer = options?.useLegacyNodeLowererLookup
      ? NODE_LOWERERS.find((l) => l.platform === platform)
      : (options?.nodeLowererRegistry ?? DEFAULT_NODE_LOWERER_REGISTRY).get(platform);
    if (!lowerer) {
      diagnostics.push({
        severity: 'warning',
        message: `No lowerer for platform '${platform}'`,
        sourceId: node.id,
      });
      continue;
    }

    const deps = nodeDeps.get(node.id) ?? { envVars: {}, securityGroups: [] };
    try {
      const resources = lowerer.lower(node, context, deps);
      allResources.push(...resources);

      if (!resourceMap[node.id]) {
        resourceMap[node.id] = [];
      }
      resourceMap[node.id].push(...resources.map((r) => r.name));
    } catch (e) {
      diagnostics.push({
        severity: 'error',
        message: `Node lowerer "${lowerer.constructor.name}" failed: ${(e as Error).message}`,
        sourceId: node.id,
      });
    }
  }

  // Phase 4: Generate event source mappings
  const eventMappings = generateEventSourceMappings(context, nodeDeps);
  allResources.push(...eventMappings);

  // Phase 5: Generate API Gateway → Lambda integrations
  const apiGwIntegrations = generateApiGatewayIntegrations(context);
  allResources.push(...apiGwIntegrations);

  // Deduplicate resources by name (IAM roles may appear multiple times)
  const seen = new Set<string>();
  const deduped: LoweredResource[] = [];
  for (const r of allResources) {
    if (!seen.has(r.name)) {
      seen.add(r.name);
      deduped.push(r);
    }
  }

  // Sort deterministically by name for stable output
  deduped.sort((a, b) => a.name.localeCompare(b.name));

  return {
    resources: deduped,
    resourceMap,
    diagnostics,
    success: !diagnostics.some((d) => d.severity === 'error'),
  };
}

export interface LowerAsyncOptions {
  readonly onPhase?: (phase: 'intents' | 'nodes' | 'event-mappings' | 'integrations' | 'complete') => void;
  readonly lowerOptions?: LowerOptions;
}

/**
 * Async variant for wrapper/service runtimes that expect Promise-based lowering APIs.
 * Current implementation preserves deterministic behavior by delegating to `lower()`.
 */
export async function lowerAsync(
  context: LoweringContext,
  options?: LowerAsyncOptions,
): Promise<AdapterResult> {
  options?.onPhase?.('intents');
  options?.onPhase?.('nodes');
  options?.onPhase?.('event-mappings');
  options?.onPhase?.('integrations');
  const result = lower(context, options?.lowerOptions);
  options?.onPhase?.('complete');
  return result;
}

/**
 * Resolves per-node dependencies from the intent list.
 * Maps each node to its IAM role, env vars, and security groups.
 */
function resolveNodeDeps(context: LoweringContext): Map<string, ResolvedDeps> {
  const deps = new Map<string, ResolvedDeps>();

  for (const node of context.snapshot.nodes) {
    const nodeId = node.id;
    let roleName: string | undefined;
    const envVars: Record<string, unknown> = {};
    const securityGroups: string[] = [];

    // Find IAM intents that have this node as principal
    for (const intent of context.intents) {
      if (intent.type === 'iam') {
        const iam = intent as IamIntent;
        if (iam.principal.nodeRef === nodeId) {
          roleName = `${shortName(nodeId)}-exec-role`;
        }
      }
      if (intent.type === 'config') {
        const config = intent as ConfigIntent;
        if (config.targetNodeRef === nodeId) {
          envVars[config.key] = resolveConfigValue(config, context);
        }
      }
    }

    deps.set(nodeId, { roleName, envVars, securityGroups });
  }

  return deps;
}

function resolveConfigValue(intent: ConfigIntent, context: LoweringContext): unknown {
  switch (intent.valueSource.type) {
    case 'literal':
      return String(intent.valueSource.value);
    case 'reference': {
      return resolveConfigReference(
        context.snapshot,
        intent.valueSource.nodeRef,
        intent.valueSource.field,
      );
    }
    case 'secret':
      return { secretRef: intent.valueSource.secretRef };
  }
}

/**
 * Generates EventSourceMapping resources for edges where
 * a Lambda function binds to an SQS queue.
 */
function generateEventSourceMappings(
  context: LoweringContext,
  nodeDeps: Map<string, ResolvedDeps>,
): ReadonlyArray<LoweredResource> {
  const mappings: LoweredResource[] = [];

  for (const edge of context.snapshot.edges) {
    if (edge.type !== 'bindsTo') continue;

    const sourceNode = context.snapshot.nodes.find((n) => n.id === edge.source);
    const targetNode = context.snapshot.nodes.find((n) => n.id === edge.target);
    if (!sourceNode || !targetNode) continue;

    const sourcePlatform = sourceNode.metadata.properties['platform'] as string | undefined;
    const targetPlatform = targetNode.metadata.properties['platform'] as string | undefined;

    // Lambda → SQS binding = EventSourceMapping
    if (sourcePlatform === 'aws-lambda' && targetPlatform === 'aws-sqs') {
      const lambdaName = shortName(sourceNode.id);
      const sqsName = shortName(targetNode.id);

      mappings.push({
        name: `${lambdaName}-${sqsName}-event-mapping`,
        resourceType: 'aws:lambda:EventSourceMapping',
        properties: {
          functionName: { ref: `${lambdaName}-function` },
          eventSourceArn: { ref: `${sqsName}-queue` },
          batchSize: 10,
          enabled: true,
          tags: {
            'shinobi:edge': edge.id,
          },
        },
        sourceId: edge.id,
        dependsOn: [`${lambdaName}-function`, `${sqsName}-queue`],
      });
    }
  }

  return mappings;
}

/**
 * Generates API Gateway → Lambda integration resources for triggers edges.
 *
 * For each `triggers` edge where source is aws-apigateway and target is aws-lambda:
 * - Integration: Lambda proxy integration
 * - Route: HTTP route (e.g., "GET /items")
 * - Permission: allows API Gateway to invoke the Lambda function
 */
function generateApiGatewayIntegrations(
  context: LoweringContext,
): ReadonlyArray<LoweredResource> {
  const resources: LoweredResource[] = [];

  for (const edge of context.snapshot.edges) {
    if (edge.type !== 'triggers') continue;

    const sourceNode = context.snapshot.nodes.find((n) => n.id === edge.source);
    const targetNode = context.snapshot.nodes.find((n) => n.id === edge.target);
    if (!sourceNode || !targetNode) continue;

    const sourcePlatform = sourceNode.metadata.properties['platform'] as string | undefined;
    const targetPlatform = targetNode.metadata.properties['platform'] as string | undefined;

    // API Gateway → Lambda triggers = Integration + Route + Permission
    if (sourcePlatform === 'aws-apigateway' && targetPlatform === 'aws-lambda') {
      const apiName = shortName(sourceNode.id);
      const lambdaName = shortName(targetNode.id);

      const bindingConfig = edge.metadata.bindingConfig as
        | { route?: string; method?: string }
        | undefined;
      const route = bindingConfig?.route;
      const method = bindingConfig?.method;

      // Determine routeKey: use "$default" if no route/method, otherwise "METHOD /path"
      const routeKey = route && method ? `${method} ${route}` : '$default';

      const integrationName = `${apiName}-${lambdaName}-integration`;
      const routeName = `${apiName}-${lambdaName}-route`;
      const permissionName = `${apiName}-${lambdaName}-permission`;

      // Lambda proxy integration
      resources.push({
        name: integrationName,
        resourceType: 'aws:apigatewayv2:Integration',
        properties: {
          apiId: { ref: `${apiName}-api` },
          integrationType: 'AWS_PROXY',
          integrationUri: { ref: `${lambdaName}-function` },
          payloadFormatVersion: '2.0',
          tags: {
            'shinobi:edge': edge.id,
          },
        },
        sourceId: edge.id,
        dependsOn: [`${apiName}-api`, `${lambdaName}-function`],
      });

      // Route
      resources.push({
        name: routeName,
        resourceType: 'aws:apigatewayv2:Route',
        properties: {
          apiId: { ref: `${apiName}-api` },
          routeKey,
          target: { ref: integrationName },
        },
        sourceId: edge.id,
        dependsOn: [`${apiName}-api`, integrationName],
      });

      // Lambda permission for API Gateway
      resources.push({
        name: permissionName,
        resourceType: 'aws:lambda:Permission',
        properties: {
          action: 'lambda:InvokeFunction',
          function: { ref: `${lambdaName}-function` },
          principal: 'apigateway.amazonaws.com',
          sourceArn: { ref: `${apiName}-api` },
          tags: {
            'shinobi:edge': edge.id,
          },
        },
        sourceId: edge.id,
        dependsOn: [`${lambdaName}-function`, `${apiName}-api`],
      });
    }
  }

  return resources;
}
