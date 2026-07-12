import type {
  BackendAdapter,
  BackendAdapterConfig,
  BackendLowerResult,
} from '@shinobi/contracts';
import type { GraphSnapshot } from '@shinobi/ir';
import { lower } from './adapter';
import { generatePlan } from './program-generator';
import type { ResourcePlan } from './program-generator';
import type { AdapterConfig, AdapterResult } from './types';

function toAdapterConfig(config: BackendAdapterConfig): AdapterConfig {
  return config as unknown as AdapterConfig;
}

/**
 * The AWS adapter packaged behind the backend-neutral BackendAdapter
 * contract (MCA-1), so orchestration layers (the CLI, or an embedding
 * platform) can select backends by name instead of hard-importing this
 * package. Deploy/preview/destroy lazy-load the Pulumi Automation API so
 * that lower/plan paths never touch provider SDKs.
 */
export const awsAdapter: BackendAdapter<GraphSnapshot, ResourcePlan> = {
  name: 'aws',

  lower(input) {
    return lower({
      intents: input.intents,
      snapshot: input.snapshot,
      adapterConfig: toAdapterConfig(input.adapterConfig),
    });
  },

  generatePlan(lowered: BackendLowerResult, config: BackendAdapterConfig) {
    return generatePlan(lowered as AdapterResult, toAdapterConfig(config));
  },

  async preview(plan, config) {
    const mod = await import('./deployer');
    return mod.preview(plan, toAdapterConfig(config));
  },

  async deploy(plan, config) {
    const mod = await import('./deployer');
    const result = await mod.deploy(plan, toAdapterConfig(config));
    return result;
  },

  async destroy(config) {
    const mod = await import('./deployer');
    return mod.destroy(toAdapterConfig(config));
  },
};
