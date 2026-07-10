import type { Node } from "@shinobi/ir";
import type {
  LoweredResource,
  LoweringContext,
  NodeLowerer,
  ResolvedDeps,
} from "../types";
import { shortName, createStandardTags, makeResourceName } from "./utils";

/**
 * Lowers a platform node with platform "aws-sagemaker-pipeline" ->
 * SageMaker Pipeline + CloudWatch Log Group.
 */
export class SageMakerPipelineLowerer implements NodeLowerer {
  readonly platform = "aws-sagemaker-pipeline";

  lower(
    node: Node,
    context: LoweringContext,
    _resolvedDeps: ResolvedDeps,
  ): ReadonlyArray<LoweredResource> {
    const name = shortName(node.id);
    const config = node.metadata.properties;
    const extraTags = config["tags"] as Record<string, string> | undefined;
    const tags = createStandardTags(
      node.id,
      "aws-sagemaker-pipeline",
      extraTags,
    );

    const pipelineName = `${name}-pipeline`;
    const logGroupName = `${name}-pipeline-log-group`;

    const pipelineDefinition = config["pipelineDefinition"] as
      | string
      | undefined;
    const pipelineDescription = (config["pipelineDescription"] as string) ?? "";
    const roleArn = config["roleArn"] as string | undefined;
    const parallelismConfiguration = config["parallelismConfiguration"] as
      | Record<string, unknown>
      | undefined;

    const pipelineProperties: Record<string, unknown> = {
      pipelineName: makeResourceName(
        node.id,
        context.adapterConfig.serviceName,
      ),
      pipelineDescription,
      tags,
    };

    if (pipelineDefinition)
      pipelineProperties.pipelineDefinition = pipelineDefinition;
    if (roleArn) pipelineProperties.roleArn = roleArn;
    if (parallelismConfiguration) {
      pipelineProperties.parallelismConfiguration = parallelismConfiguration;
    }

    const resources: LoweredResource[] = [];

    resources.push({
      name: pipelineName,
      resourceType: "aws:sagemaker:Pipeline",
      properties: pipelineProperties,
      sourceId: node.id,
      dependsOn: [],
    });

    resources.push({
      name: logGroupName,
      resourceType: "aws:cloudwatch:LogGroup",
      properties: {
        name: `/aws/sagemaker/pipelines/${makeResourceName(node.id, context.adapterConfig.serviceName)}`,
        tags,
      },
      sourceId: node.id,
      dependsOn: [],
    });

    return resources;
  }
}
