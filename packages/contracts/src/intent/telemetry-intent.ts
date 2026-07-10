import type { Intent } from './intent-base';

/**
 * Telemetry configuration options.
 */
export interface TelemetryConfig {
  /** Whether telemetry is enabled */
  readonly enabled: boolean;

  /** Sampling rate (0.0 - 1.0) */
  readonly samplingRate?: number;

  /** Destination for telemetry data */
  readonly destination?: string;
}

/**
 * Telemetry/observability intent.
 *
 * Represents telemetry configuration for components.
 */
export interface TelemetryIntent extends Intent {
  readonly type: 'telemetry';

  /** What to observe */
  readonly targetNodeRef: string;

  /** Type of telemetry */
  readonly telemetryType: 'metrics' | 'traces' | 'logs';

  /** Configuration */
  readonly config: TelemetryConfig;
}
