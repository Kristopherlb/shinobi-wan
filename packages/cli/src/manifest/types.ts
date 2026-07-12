import type { ConfigValueSource } from '@shinobi/contracts';

/**
 * A binding entry in the service manifest.
 */
export interface ManifestBinding {
  readonly source: string;
  readonly target: string;
  readonly type: 'bindsTo' | 'triggers' | 'dependsOn' | 'contains';
  readonly config: ManifestBindingConfig;
}

/**
 * Binding configuration from the manifest YAML.
 */
export interface ManifestBindingConfig {
  readonly resourceType: string;
  readonly accessLevel?: string;
  readonly actions?: ReadonlyArray<string>;
  readonly network?: {
    readonly port?: number;
    readonly protocol?: 'tcp' | 'udp' | 'any';
  };
  readonly configKeys?: ReadonlyArray<{
    readonly key: string;
    readonly valueSource: ConfigValueSource;
  }>;
}

/**
 * A component entry in the service manifest.
 */
export interface ManifestComponent {
  readonly id: string;
  readonly type: 'component' | 'platform';
  readonly platform: string;
  readonly config?: Readonly<Record<string, unknown>>;
}

/**
 * A policy exception (waiver) declared in the manifest — Standard 5.
 */
export interface ManifestException {
  readonly ruleId: string;
  readonly target: string;
  readonly expires: string;
  readonly justification: string;
  readonly approvedBy?: string;
}

/**
 * The top-level service manifest model (parsed from YAML).
 */
export interface ServiceManifest {
  readonly service: string;
  readonly components: ReadonlyArray<ManifestComponent>;
  readonly bindings: ReadonlyArray<ManifestBinding>;
  readonly policyPack?: string;
  readonly exceptions?: ReadonlyArray<ManifestException>;
}

/**
 * Validation error from manifest parsing.
 */
export interface ManifestError {
  readonly path: string;
  readonly message: string;
}

/**
 * Result of manifest parsing.
 */
export type ManifestParseResult =
  | { readonly ok: true; readonly manifest: ServiceManifest }
  | { readonly ok: false; readonly errors: ReadonlyArray<ManifestError> };
