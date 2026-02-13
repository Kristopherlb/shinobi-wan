// Intent contract exports
export {
  INTENT_TYPES,
  type IntentType,
  type Intent,
} from './intent-base';

export {
  type IamIntent,
  type IamPrincipal,
  type IamResource,
  type IamAction,
  type IamCondition,
} from './iam-intent';

export {
  type NetworkIntent,
  type NetworkEndpoint,
  type NetworkProtocol,
} from './network-intent';

export {
  type ConfigIntent,
  type ConfigValueSource,
} from './config-intent';

export {
  type TelemetryIntent,
  type TelemetryConfig,
} from './telemetry-intent';
