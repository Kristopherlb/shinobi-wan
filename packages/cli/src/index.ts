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
export { validate, plan, up } from './commands';
export type {
  ValidateOptions,
  ValidateResult,
  PlanOptions,
  PlanResult,
  UpOptions,
  UpResult,
} from './commands';

// CLI entry point
export { createCli } from './cli';
