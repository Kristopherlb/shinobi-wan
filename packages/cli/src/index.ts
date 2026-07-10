/**
 * @shinobi/cli - Command-line interface for Shinobi V3
 *
 * Provides manifest parsing, validation, planning, and deployment commands.
 */

// Manifest parsing
export { parseManifest, manifestToMutations } from './manifest';
export type {
  ServiceManifest,
  ManifestComponent,
  ManifestBinding,
  ManifestBindingConfig,
  ManifestError,
  ManifestParseResult,
} from './manifest';

// Commands
export { validate, plan, planAsync, up } from './commands';
export type {
  ValidateOptions,
  ValidateResult,
  PlanOptions,
  PlanResult,
  PlanAsyncOptions,
  UpOptions,
  UpResult,
} from './commands';

// Harmony integration contracts
export { getOperationPolicy, getIntegrationFeatureFlags } from './integration';
export type {
  OperationClass,
  OperationPolicy,
  ToolResponseEnvelope,
  ToolErrorEnvelope,
  AsyncOperationHandle,
  IntegrationFeatureFlags,
} from './integration';

// Harmony MCP wrapper integration
export { invokeHarmonyTool, getOperationStatus } from './mcp';
export type {
  HarmonyToolId,
  HarmonyToolCallRequest,
  HarmonyToolCallResult,
} from './mcp';

// CLI entry point
export { createCli } from './cli';
