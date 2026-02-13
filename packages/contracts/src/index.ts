// @shinobi/contracts - Type definitions and interfaces
// Zero dependencies, versioned from day one

// Version constants
export { CONTRACT_SCHEMA_VERSION, type ContractSchemaVersion } from './versions';

// Capability contracts
export {
  CAPABILITY_ID_PATTERN,
  type CapabilityId,
  isValidCapabilityId,
} from './capability/capability-id';

export { type CapabilityFieldType, type CapabilityDataShape } from './capability/capability-data';

export {
  CAPABILITY_ACTIONS,
  type CapabilityAction,
  type CapabilityContract,
} from './capability/capability-contract';

// Intent contracts
export { INTENT_TYPES, type IntentType, type Intent } from './intent/intent-base';

export {
  type IamPrincipal,
  type IamResource,
  type IamAction,
  type IamCondition,
  type IamIntent,
} from './intent/iam-intent';

export {
  type NetworkEndpoint,
  type NetworkProtocol,
  type NetworkIntent,
} from './intent/network-intent';

export { type ConfigValueSource, type ConfigIntent } from './intent/config-intent';

export { type TelemetryConfig, type TelemetryIntent } from './intent/telemetry-intent';

// Violation contracts
export { SEVERITY_LEVELS, type Severity } from './violation/severity';

export { type RemediationHint } from './violation/remediation';

export {
  type Violation,
  type ViolationTarget,
  createViolationId,
  isValidViolationId,
} from './violation/violation';
