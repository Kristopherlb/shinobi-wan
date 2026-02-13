import type { Intent, Violation, Severity } from '@shinobi/contracts';
import type { GraphSnapshot, Node, Edge } from '@shinobi/ir';
import type { ValidationResult, ValidatorOptions } from '@shinobi/validation';

/**
 * Source layer for configuration precedence (KL-007).
 */
export interface ConfigLayer {
  readonly source: 'defaults' | 'environment' | 'overrides';
  readonly values: Readonly<Record<string, unknown>>;
}

/**
 * Kernel configuration.
 * Config is injected, never read from process.env (determinism guarantee).
 */
export interface KernelConfig {
  /** Ordered config layers: defaults → environment → overrides */
  readonly layers?: ReadonlyArray<ConfigLayer>;

  /** Environment variables for ${env:KEY} interpolation */
  readonly environment?: Readonly<Record<string, string>>;

  /** Explicit policy pack selection (KL-008) */
  readonly policyPack?: string;

  /** Validation options passed to the validation pipeline */
  readonly validationOptions?: ValidatorOptions;
}

/**
 * Structured diagnostic emitted by binders.
 */
export interface BindingDiagnostic {
  readonly path: string;
  readonly rule: string;
  readonly message: string;
  readonly severity: Severity;
}

/**
 * Result of binding a single edge.
 */
export interface BindingResult {
  readonly edgeId: string;
  readonly intents: ReadonlyArray<Intent>;
  readonly diagnostics: ReadonlyArray<BindingDiagnostic>;
}

/**
 * Result of policy evaluation.
 */
export interface PolicyResult {
  readonly violations: ReadonlyArray<Violation>;
  readonly compliant: boolean;
  readonly policyPack: string;
}

/**
 * Full compilation pipeline output.
 */
export interface CompilationResult {
  readonly snapshot: GraphSnapshot;
  readonly intents: ReadonlyArray<Intent>;
  readonly bindingDiagnostics: ReadonlyArray<BindingDiagnostic>;
  readonly policy?: PolicyResult;
  readonly validation: ValidationResult;
  readonly resolvedConfig: Readonly<Record<string, unknown>>;
}

/**
 * Context passed to binders when compiling an edge.
 */
export interface BindingContext {
  readonly edge: Edge;
  readonly sourceNode: Node;
  readonly targetNode: Node;
  readonly config: Readonly<Record<string, unknown>>;
}

/**
 * Output returned by a binder for a single edge.
 */
export interface BinderOutput {
  readonly intents: ReadonlyArray<Intent>;
  readonly diagnostics: ReadonlyArray<BindingDiagnostic>;
}

/**
 * Context passed to policy evaluators.
 */
export interface PolicyEvaluationContext {
  readonly snapshot: GraphSnapshot;
  readonly intents: ReadonlyArray<Intent>;
  readonly policyPack: string;
  readonly config: Readonly<Record<string, unknown>>;
}
