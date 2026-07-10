import type { Node } from "@shinobi/ir";
import type {
  LoweredResource,
  LoweringContext,
  NodeLowerer,
  ResolvedDeps,
} from "../types";
import { shortName, createStandardTags, makeResourceName } from "./utils";

/**
 * Lowers a platform node with platform "aws-alb" → Application Load Balancer + Target Group + Listeners.
 *
 * Emits four resources:
 * 1. LoadBalancer (aws:lb:LoadBalancer) — ALB with subnets and security groups
 * 2. TargetGroup (aws:lb:TargetGroup) — target group with health check configuration
 * 3. HTTPS Listener (aws:lb:Listener) — port 443 with certificate and forward action
 * 4. HTTP Listener (aws:lb:Listener) — port 80 with redirect to HTTPS
 */
export class AlbLowerer implements NodeLowerer {
  readonly platform = "aws-alb";

  lower(
    node: Node,
    context: LoweringContext,
    _resolvedDeps: ResolvedDeps,
  ): ReadonlyArray<LoweredResource> {
    const name = shortName(node.id);
    const config = node.metadata.properties;
    const extraTags = config["tags"] as Record<string, string> | undefined;

    const resources: LoweredResource[] = [];

    const albName = `${name}-alb`;
    const tgName = `${name}-tg`;
    const httpsListenerName = `${name}-listener-https`;
    const httpListenerName = `${name}-listener-http`;

    const tags = createStandardTags(node.id, "aws-alb", extraTags);

    // Resolve subnet and security group references
    const subnets = (config["subnets"] as string[] | undefined) ?? [];
    const securityGroups =
      (config["securityGroups"] as string[] | undefined) ?? [];

    // 1. Load Balancer
    resources.push({
      name: albName,
      resourceType: "aws:lb:LoadBalancer",
      properties: {
        name: makeResourceName(node.id, context.adapterConfig.serviceName),
        internal: config["internal"] === true,
        loadBalancerType: "application",
        subnets: subnets.map((s) => ({ ref: `${shortName(s)}-subnet` })),
        securityGroups: securityGroups.map((sg) => ({
          ref: `${shortName(sg)}-sg`,
        })),
        tags,
      },
      sourceId: node.id,
      dependsOn: [],
    });

    // 2. Target Group
    const vpcRef = config["vpcId"] as string | undefined;

    // Health check — support custom config or defaults
    const customHealthCheck = config["healthCheck"] as
      | Record<string, unknown>
      | undefined;
    const healthCheck = customHealthCheck ?? {
      path: (config["healthCheckPath"] as string) ?? "/health",
      interval: 30,
      timeout: 5,
      healthyThreshold: 2,
      unhealthyThreshold: 3,
    };

    resources.push({
      name: tgName,
      resourceType: "aws:lb:TargetGroup",
      properties: {
        name: makeResourceName(node.id, context.adapterConfig.serviceName),
        port: Number(config["targetPort"] ?? 80),
        protocol: "HTTP",
        targetType: "ip",
        vpcId: vpcRef ? { ref: `${shortName(vpcRef)}-vpc` } : undefined,
        healthCheck,
        tags,
      },
      sourceId: node.id,
      dependsOn: [albName],
    });

    // 3. HTTPS Listener
    const certificateRef = config["certificateRef"] as string | undefined;
    const certificateArn = config["certificateArn"] as string | undefined;
    const certificateValue = certificateRef
      ? { ref: `${shortName(certificateRef)}-cert` }
      : certificateArn;

    resources.push({
      name: httpsListenerName,
      resourceType: "aws:lb:Listener",
      properties: {
        loadBalancerArn: { ref: albName },
        port: 443,
        protocol: "HTTPS",
        certificateArn: certificateValue,
        defaultActions: [
          {
            type: "forward",
            targetGroupArn: { ref: `${tgName}.arn` },
          },
        ],
        sslPolicy:
          (config["sslPolicy"] as string) ??
          "ELBSecurityPolicy-TLS13-1-2-2021-06",
      },
      sourceId: node.id,
      dependsOn: [albName, tgName],
    });

    // 4. HTTP Listener (redirect to HTTPS)
    resources.push({
      name: httpListenerName,
      resourceType: "aws:lb:Listener",
      properties: {
        loadBalancerArn: { ref: albName },
        port: 80,
        protocol: "HTTP",
        defaultActions: [
          {
            type: "redirect",
            redirect: {
              protocol: "HTTPS",
              port: "443",
              statusCode: "HTTP_301",
            },
          },
        ],
      },
      sourceId: node.id,
      dependsOn: [albName, tgName],
    });

    return resources;
  }
}
