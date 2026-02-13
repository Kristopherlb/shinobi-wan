import type { Intent } from './intent-base';

/**
 * Network endpoint in a network intent.
 */
export interface NetworkEndpoint {
  /** Reference to the node */
  readonly nodeRef: string;

  /** Single port (optional) */
  readonly port?: number;

  /** Port range (optional) */
  readonly portRange?: {
    readonly from: number;
    readonly to: number;
  };
}

/**
 * Protocol specification for network rules.
 */
export interface NetworkProtocol {
  /** Protocol type */
  readonly protocol: 'tcp' | 'udp' | 'any';

  /** Allowed ports (optional) */
  readonly ports?: ReadonlyArray<number>;
}

/**
 * Backend-neutral network rule intent.
 *
 * Represents connectivity rules between components.
 * No security group IDs, VPC references, or provider-specific fields.
 */
export interface NetworkIntent extends Intent {
  readonly type: 'network';

  /** Direction of traffic */
  readonly direction: 'ingress' | 'egress';

  /** Source of traffic */
  readonly source: NetworkEndpoint;

  /** Destination of traffic */
  readonly destination: NetworkEndpoint;

  /** Protocol and ports */
  readonly protocol: NetworkProtocol;
}
