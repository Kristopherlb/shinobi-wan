/**
 * Kernel error classes with structured fields for JSON consumption (KL-006).
 */

export interface CompilationDetail {
  readonly path: string;
  readonly message: string;
}

/**
 * Error thrown when compilation fails at a specific phase.
 */
export class CompilationError extends Error {
  readonly phase: 'validation' | 'binding' | 'policy';
  readonly details: ReadonlyArray<CompilationDetail>;

  constructor(
    phase: CompilationError['phase'],
    details: ReadonlyArray<CompilationDetail>,
    message?: string
  ) {
    super(message ?? `Compilation failed in ${phase} phase with ${details.length} error(s)`);
    this.name = 'CompilationError';
    this.phase = phase;
    this.details = details;
  }
}

/**
 * Error thrown for configuration issues (KL-007).
 */
export class ConfigError extends Error {
  readonly key: string;
  readonly reason: string;

  constructor(key: string, reason: string) {
    super(`Config error for key "${key}": ${reason}`);
    this.name = 'ConfigError';
    this.key = key;
    this.reason = reason;
  }
}

/**
 * Error thrown when a requested policy pack has no evaluator (KL-008).
 */
export class PolicyPackError extends Error {
  readonly requestedPack: string;
  readonly availablePacks: ReadonlyArray<string>;

  constructor(requestedPack: string, availablePacks: ReadonlyArray<string>) {
    super(
      `Policy pack "${requestedPack}" not found. Available: [${availablePacks.join(', ')}]`
    );
    this.name = 'PolicyPackError';
    this.requestedPack = requestedPack;
    this.availablePacks = availablePacks;
  }
}
