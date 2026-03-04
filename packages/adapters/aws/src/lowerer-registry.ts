import type { NodeLowerer } from './types';
import {
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
  EksClusterLowerer,
  EksNodeGroupLowerer,
  SecretsManagerLowerer,
  KmsLowerer,
  ElastiCacheLowerer,
  BudgetsLowerer,
  ConfigRulesLowerer,
  BedrockLowerer,
  SageMakerBatchTransformLowerer,
  OpenSearchDomainLowerer,
  KinesisFirehoseLowerer,
  LogSubscriptionFilterLowerer,
  OpenSearchServerlessLowerer,
  RdsClusterLowerer,
  RdsProxyLowerer,
  SageMakerEndpointLowerer,
  ConfigRecorderLowerer,
  SecurityHubLowerer,
  GuardDutyLowerer,
  CloudTrailLowerer,
  GlueCatalogLowerer,
  GlueJobLowerer,
  GlueCrawlerLowerer,
  AthenaWorkgroupLowerer,
  SageMakerPipelineLowerer,
  MskClusterLowerer,
  MskConfigurationLowerer,
  TransitGatewayLowerer,
  TgwVpcAttachmentLowerer,
  NatGatewayLowerer,
  NetworkFirewallLowerer,
  Route53ZoneLowerer,
  Route53RecordLowerer,
  EksAddonLowerer,
  EksGpuNodeGroupLowerer,
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
  registry.register(new CloudFrontLowerer());
  registry.register(new WafLowerer());
  registry.register(new AcmLowerer());
  registry.register(new CloudFrontFunctionLowerer());
  registry.register(new EventBridgeLowerer());
  registry.register(new StepFunctionsLowerer());
  registry.register(new VpcLowerer());
  registry.register(new SubnetLowerer());
  registry.register(new SecurityGroupLowerer());
  registry.register(new EcrLowerer());
  registry.register(new EcsClusterLowerer());
  registry.register(new EcsTaskDefinitionLowerer());
  registry.register(new EcsServiceLowerer());
  registry.register(new AlbLowerer());
  registry.register(new EksClusterLowerer());
  registry.register(new EksNodeGroupLowerer());
  registry.register(new SecretsManagerLowerer());
  registry.register(new KmsLowerer());
  registry.register(new ElastiCacheLowerer());
  registry.register(new BudgetsLowerer());
  registry.register(new ConfigRulesLowerer());
  registry.register(new BedrockLowerer());
  registry.register(new SageMakerBatchTransformLowerer());
  registry.register(new OpenSearchDomainLowerer());
  registry.register(new KinesisFirehoseLowerer());
  registry.register(new LogSubscriptionFilterLowerer());
  registry.register(new OpenSearchServerlessLowerer());
  registry.register(new RdsClusterLowerer());
  registry.register(new RdsProxyLowerer());
  registry.register(new SageMakerEndpointLowerer());
  registry.register(new ConfigRecorderLowerer());
  registry.register(new SecurityHubLowerer());
  registry.register(new GuardDutyLowerer());
  registry.register(new CloudTrailLowerer());
  registry.register(new GlueCatalogLowerer());
  registry.register(new GlueJobLowerer());
  registry.register(new GlueCrawlerLowerer());
  registry.register(new AthenaWorkgroupLowerer());
  registry.register(new SageMakerPipelineLowerer());
  registry.register(new MskClusterLowerer());
  registry.register(new MskConfigurationLowerer());
  registry.register(new TransitGatewayLowerer());
  registry.register(new TgwVpcAttachmentLowerer());
  registry.register(new NatGatewayLowerer());
  registry.register(new NetworkFirewallLowerer());
  registry.register(new Route53ZoneLowerer());
  registry.register(new Route53RecordLowerer());
  registry.register(new EksAddonLowerer());
  registry.register(new EksGpuNodeGroupLowerer());
  return registry;
}
