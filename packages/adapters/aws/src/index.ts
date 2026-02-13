/**
 * @shinobi/adapter-aws - AWS Adapter for Shinobi V3
 *
 * Lowers backend-neutral intents from the kernel compilation pipeline
 * into AWS-specific Pulumi resources.
 *
 * Boundary rule: This adapter depends ONLY on @shinobi/contracts and @shinobi/ir.
 * It never imports kernel, binder, or policy packages.
 */

// Adapter orchestrator
export { lower } from './adapter';

// Program generator
export { generatePlan } from './program-generator';
export type { PulumiFn, ResourcePlan, PlannedResource } from './program-generator';

// Types
export type {
  LoweringContext,
  AdapterConfig,
  AdapterResult,
  LoweredResource,
  LoweringDiagnostic,
  IntentLowerer,
  NodeLowerer,
  ResolvedDeps,
} from './types';

// Individual lowerers (for custom adapter composition)
export { IamIntentLowerer, NetworkIntentLowerer, ConfigIntentLowerer } from './lowerers';
export { LambdaLowerer, SqsLowerer } from './lowerers';
