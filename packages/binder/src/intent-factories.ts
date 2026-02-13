import type {
  IamIntent,
  IamPrincipal,
  IamResource,
  IamAction,
  IamCondition,
  NetworkIntent,
  NetworkEndpoint,
  NetworkProtocol,
  ConfigIntent,
  ConfigValueSource,
  TelemetryIntent,
  TelemetryConfig,
} from '@shinobi/contracts';
import { deepFreeze } from '@shinobi/kernel';

/**
 * Creates a backend-neutral IAM intent.
 * Enforces schemaVersion and sourceEdgeId.
 */
export function createIamIntent(
  sourceEdgeId: string,
  principal: IamPrincipal,
  resource: IamResource,
  actions: ReadonlyArray<IamAction>,
  conditions?: ReadonlyArray<IamCondition>
): IamIntent {
  const intent: IamIntent = {
    type: 'iam',
    schemaVersion: '1.0.0',
    sourceEdgeId,
    principal,
    resource,
    actions,
    ...(conditions ? { conditions } : {}),
  };
  return deepFreeze(intent) as IamIntent;
}

/**
 * Creates a backend-neutral network intent.
 * Enforces schemaVersion and sourceEdgeId.
 */
export function createNetworkIntent(
  sourceEdgeId: string,
  direction: 'ingress' | 'egress',
  source: NetworkEndpoint,
  destination: NetworkEndpoint,
  protocol: NetworkProtocol
): NetworkIntent {
  const intent: NetworkIntent = {
    type: 'network',
    schemaVersion: '1.0.0',
    sourceEdgeId,
    direction,
    source,
    destination,
    protocol,
  };
  return deepFreeze(intent) as NetworkIntent;
}

/**
 * Creates a backend-neutral config intent.
 * Enforces schemaVersion and sourceEdgeId.
 */
export function createConfigIntent(
  sourceEdgeId: string,
  targetNodeRef: string,
  key: string,
  valueSource: ConfigValueSource
): ConfigIntent {
  const intent: ConfigIntent = {
    type: 'config',
    schemaVersion: '1.0.0',
    sourceEdgeId,
    targetNodeRef,
    key,
    valueSource,
  };
  return deepFreeze(intent) as ConfigIntent;
}

/**
 * Creates a backend-neutral telemetry intent.
 * Enforces schemaVersion and sourceEdgeId.
 */
export function createTelemetryIntent(
  sourceEdgeId: string,
  targetNodeRef: string,
  telemetryType: 'metrics' | 'traces' | 'logs',
  config: TelemetryConfig
): TelemetryIntent {
  const intent: TelemetryIntent = {
    type: 'telemetry',
    schemaVersion: '1.0.0',
    sourceEdgeId,
    targetNodeRef,
    telemetryType,
    config,
  };
  return deepFreeze(intent) as TelemetryIntent;
}
