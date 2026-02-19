/**
 * Kernel facade API for Harmony: stable entrypoints and envelope contract.
 */
export { CONTRACT_VERSION, CONTRACT_VERSION as contractVersion } from './contract-version';
export type { ContractVersion } from './contract-version';

export type {
  ToolResponseEnvelope,
  ToolErrorEnvelope,
  ToolResponseMetadata,
} from './envelope-types';

export type {
  FacadeMode,
  ValidatePlanInput,
  PlanChangeInput,
  ApplyChangeInput,
  ReadEntitiesInput,
  ReadActivityInput,
} from './inputs';

export { validatePlan, planChange, applyChange, readEntities, readActivity } from './facade';
