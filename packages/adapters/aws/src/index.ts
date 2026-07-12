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
export { lower, lowerAsync } from './adapter';
export type { LowerAsyncOptions, LowerOptions } from './adapter';
export {
  NodeLowererRegistry,
  createDefaultNodeLowererRegistry,
} from './lowerer-registry';

// Program generator
export { generatePlan } from './program-generator';
export type {
  PulumiFn,
  ResourcePlan,
  PlannedResource,
} from './program-generator';

// Pulumi program builder: import from './pulumi-program' directly when
// composing a custom deployer — it is intentionally not re-exported here
// because it loads provider SDKs at module scope.

// Deployer (Pulumi Automation API). deploy/preview are lazy wrappers so that
// importing this package (e.g. for validate/plan) never loads Pulumi; the
// provider SDK is required only when a deploy or preview actually runs.
export { classifyError } from './deployer-errors';
export type { DeployerError, DeployerErrorCategory } from './deployer-errors';
export type {
  DeployResult,
  PreviewResult,
  DestroyResult,
  DeployOptions,
  DeployerEvent,
} from './deployer';
import type {
  DeployOptions as DeployOptionsT,
  DeployResult as DeployResultT,
  PreviewResult as PreviewResultT,
  DestroyResult as DestroyResultT,
} from './deployer';
import type { ResourcePlan as ResourcePlanT } from './program-generator';
import type { AdapterConfig as AdapterConfigT } from './types';

export async function deploy(
  plan: ResourcePlanT,
  config: AdapterConfigT,
  options?: DeployOptionsT,
): Promise<DeployResultT> {
  const mod = await import('./deployer');
  return mod.deploy(plan, config, options);
}

export async function preview(
  plan: ResourcePlanT,
  config: AdapterConfigT,
  options?: DeployOptionsT,
): Promise<PreviewResultT> {
  const mod = await import('./deployer');
  return mod.preview(plan, config, options);
}

export async function destroy(
  config: AdapterConfigT,
  options?: DeployOptionsT,
): Promise<DestroyResultT> {
  const mod = await import('./deployer');
  return mod.destroy(config, options);
}

// Backend-neutral adapter contract implementation (MCA-1)
export { awsAdapter } from './backend-adapter';

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
export {
  IamIntentLowerer,
  NetworkIntentLowerer,
  ConfigIntentLowerer,
  TelemetryIntentLowerer,
} from './lowerers';
export {
  LambdaLowerer,
  SqsLowerer,
  DynamoDbLowerer,
  S3Lowerer,
  ApiGatewayLowerer,
  SnsLowerer,
  CloudFrontLowerer,
  WafLowerer,
  AcmLowerer,
  CloudFrontFunctionLowerer,
  EventBridgeLowerer,
  StepFunctionsLowerer,
  VpcLowerer,
  SubnetLowerer,
  SecurityGroupLowerer,
  EcrLowerer,
  EcsClusterLowerer,
  EcsTaskDefinitionLowerer,
  EcsServiceLowerer,
  AlbLowerer,
} from './lowerers';
