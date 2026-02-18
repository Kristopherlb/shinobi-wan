import type { IntegrationFeatureFlags } from './types';
import { CONTRACT_VERSION, DEFAULT_TOOL_VERSION } from './contract';

function parseBoolean(value: string | undefined, defaultValue: boolean): boolean {
  if (value === undefined) return defaultValue;
  return value === 'true';
}

function parsePositiveInteger(value: string | undefined, defaultValue: number): number {
  if (!value) return defaultValue;
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : defaultValue;
}

export function getIntegrationFeatureFlags(
  env: NodeJS.ProcessEnv = process.env,
): IntegrationFeatureFlags {
  return {
    wrapperModeEnabled: parseBoolean(env.SHINOBI_WRAPPER_MODE_ENABLED, false),
    applyEnabled: parseBoolean(env.SHINOBI_APPLY_ENABLED, false),
    applyMode: env.SHINOBI_APPLY_MODE === 'await' ? 'await' : 'start',
    approvalRequired: parseBoolean(env.SHINOBI_APPROVAL_REQUIRED, true),
    approvalMaxSlaMinutes: parsePositiveInteger(env.SHINOBI_APPROVAL_MAX_SLA_MINUTES, 60),
    contractVersion: env.SHINOBI_CONTRACT_VERSION ?? CONTRACT_VERSION,
    toolVersion: env.SHINOBI_TOOL_VERSION ?? DEFAULT_TOOL_VERSION,
    maxConcurrency: parsePositiveInteger(env.SHINOBI_MAX_CONCURRENCY, 5),
  };
}
