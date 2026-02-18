import type { NodeLowerer } from './types';
import {
  LambdaLowerer,
  SqsLowerer,
  DynamoDbLowerer,
  S3Lowerer,
  ApiGatewayLowerer,
  SnsLowerer,
} from './lowerers';

export interface RegisterNodeLowererOptions {
  readonly overwrite?: boolean;
}

/**
 * Registry for node lowerers keyed by platform.
 * Keeps lookup deterministic and allows controlled extension.
 */
export class NodeLowererRegistry {
  private readonly byPlatform = new Map<string, NodeLowerer>();

  register(lowerer: NodeLowerer, options?: RegisterNodeLowererOptions): void {
    const existing = this.byPlatform.get(lowerer.platform);
    if (existing && !options?.overwrite) {
      throw new Error(`Node lowerer already registered for platform '${lowerer.platform}'`);
    }
    this.byPlatform.set(lowerer.platform, lowerer);
  }

  get(platform: string): NodeLowerer | undefined {
    return this.byPlatform.get(platform);
  }

  list(): ReadonlyArray<NodeLowerer> {
    return [...this.byPlatform.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([, lowerer]) => lowerer);
  }
}

export function createDefaultNodeLowererRegistry(): NodeLowererRegistry {
  const registry = new NodeLowererRegistry();
  registry.register(new LambdaLowerer());
  registry.register(new SqsLowerer());
  registry.register(new DynamoDbLowerer());
  registry.register(new S3Lowerer());
  registry.register(new ApiGatewayLowerer());
  registry.register(new SnsLowerer());
  return registry;
}
