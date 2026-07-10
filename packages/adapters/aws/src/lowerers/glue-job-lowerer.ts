import type { Node } from "@shinobi/ir";
import type {
  LoweredResource,
  LoweringContext,
  NodeLowerer,
  ResolvedDeps,
} from "../types";
import { shortName, createStandardTags, makeResourceName } from "./utils";

/**
 * Lowers a platform node with platform "aws-glue-job" ->
 * Glue Job + CloudWatch Log Group.
 */
export class GlueJobLowerer implements NodeLowerer {
  readonly platform = "aws-glue-job";

  lower(
    node: Node,
    context: LoweringContext,
    _resolvedDeps: ResolvedDeps,
  ): ReadonlyArray<LoweredResource> {
    const name = shortName(node.id);
    const config = node.metadata.properties;
    const extraTags = config["tags"] as Record<string, string> | undefined;
    const tags = createStandardTags(node.id, "aws-glue-job", extraTags);

    const jobName = `${name}-job`;
    const logGroupName = `${name}-job-log-group`;

    const glueVersion = (config["glueVersion"] as string) ?? "4.0";
    const command = config["command"] as Record<string, unknown> | undefined;
    const workerType = (config["workerType"] as string) ?? "G.1X";
    const numberOfWorkers = (config["numberOfWorkers"] as number) ?? 2;
    const maxRetries = (config["maxRetries"] as number) ?? 0;
    const timeout = (config["timeout"] as number) ?? 2880;
    const maxConcurrentRuns = (config["maxConcurrentRuns"] as number) ?? 1;
    const defaultArguments = config["defaultArguments"] as
      | Record<string, string>
      | undefined;
    const securityConfiguration = config["securityConfiguration"] as
      | string
      | undefined;
    const connections = config["connections"] as string[] | undefined;
    const roleArn = config["roleArn"] as string | undefined;

    const resources: LoweredResource[] = [];

    const jobProperties: Record<string, unknown> = {
      name: makeResourceName(node.id, context.adapterConfig.serviceName),
      glueVersion,
      command,
      workerType,
      numberOfWorkers,
      maxRetries,
      timeout,
      executionProperty: { maxConcurrentRuns },
      tags,
    };

    if (defaultArguments) jobProperties.defaultArguments = defaultArguments;
    if (securityConfiguration)
      jobProperties.securityConfiguration = securityConfiguration;
    if (connections) jobProperties.connections = connections;
    if (roleArn) jobProperties.roleArn = roleArn;

    resources.push({
      name: jobName,
      resourceType: "aws:glue:Job",
      properties: jobProperties,
      sourceId: node.id,
      dependsOn: [],
    });

    resources.push({
      name: logGroupName,
      resourceType: "aws:cloudwatch:LogGroup",
      properties: {
        name: `/aws/glue/${makeResourceName(node.id, context.adapterConfig.serviceName)}`,
        tags,
      },
      sourceId: node.id,
      dependsOn: [],
    });

    return resources;
  }
}
