import type { Intent } from './intent-base';

/**
 * Source of a configuration value.
 */
export type ConfigValueSource =
  | { readonly type: 'literal'; readonly value: string | number | boolean }
  | { readonly type: 'reference'; readonly nodeRef: string; readonly field: string }
  | { readonly type: 'secret'; readonly secretRef: string };

/**
 * Runtime configuration intent.
 *
 * Represents configuration values to be injected into components.
 */
export interface ConfigIntent extends Intent {
  readonly type: 'config';

  /** Target node receiving config */
  readonly targetNodeRef: string;

  /** Configuration key */
  readonly key: string;

  /** Value source */
  readonly valueSource: ConfigValueSource;
}
