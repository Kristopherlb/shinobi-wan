/**
 * @shinobi/kernel - Graph Engine for Shinobi V3
 *
 * The kernel orchestrates the compilation pipeline:
 * graph → validate → bind → policy → frozen output
 */

// Kernel class
export { Kernel } from './kernel';
export type { KernelOptions } from './kernel';

// Types
export type {
  ConfigLayer,
  KernelConfig,
  BindingDiagnostic,
  BindingResult,
  PolicyResult,
  CompilationResult,
  BindingContext,
  BinderOutput,
  PolicyEvaluationContext,
} from './types';

// Interfaces
export type { IBinder, SupportedEdgePattern } from './interfaces';
export type { IPolicyEvaluator } from './interfaces';

// Config resolution
export { resolveConfig, interpolateEnvTokens } from './config';

// Compilation pipeline
export { compilePipeline } from './compilation-pipeline';

// Errors
export { CompilationError, ConfigError, PolicyPackError } from './errors';
export type { CompilationDetail } from './errors';

// Utilities
export { deepFreeze } from './freeze';
