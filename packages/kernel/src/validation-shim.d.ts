/**
 * Shim for @shinobi/validation when that package is built without dts (dist-only).
 * Ensures kernel's dts build can resolve the module. Remove when validation emits .d.ts.
 */
declare module '@shinobi/validation' {
  import type { Intent } from '@shinobi/contracts';

  export interface ValidationError {
    readonly path: string;
    readonly rule: string;
    readonly message: string;
    readonly severity: string;
    readonly allowedValues?: ReadonlyArray<string>;
    readonly remediation?: string;
    readonly kernelLaw?: string;
  }

  export interface ValidationResult {
    readonly valid: boolean;
    readonly errors: ReadonlyArray<ValidationError>;
    readonly schemaVersion: '1.0.0';
  }

  export interface ValidatorOptions {
    readonly strict?: boolean;
    readonly level?: 'schema' | 'semantic' | 'full';
    readonly collectAll?: boolean;
  }

  export function validateGraph(snapshot: unknown, options?: ValidatorOptions): ValidationResult;
  export function validateIntent(intent: Intent, options?: ValidatorOptions): ValidationResult;
}
