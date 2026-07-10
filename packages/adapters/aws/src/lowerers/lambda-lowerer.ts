import type { Node } from "@shinobi/ir";
import type {
  LoweredResource,
  LoweringContext,
  NodeLowerer,
  ResolvedDeps,
} from "../types";
import { shortName, createStandardTags } from "./utils";

/**
 * Lowers a component node with platform "aws-lambda" → Lambda Function resource.
 */
export class LambdaLowerer implements NodeLowerer {
  readonly platform = "aws-lambda";

  lower(
    node: Node,
    context: LoweringContext,
    resolvedDeps: ResolvedDeps,
  ): ReadonlyArray<LoweredResource> {
    const name = shortName(node.id);
    const props = node.metadata.properties;

    const resources: LoweredResource[] = [];

    // Build environment variables: merge resolved deps + Powertools config
    const envVars: Record<string, unknown> = { ...resolvedDeps.envVars };
    if (props["powertools"] === true) {
      envVars["POWERTOOLS_SERVICE_NAME"] =
        `${context.adapterConfig.serviceName}-${name}`;
      envVars["POWERTOOLS_LOG_LEVEL"] =
        (props["powertoolsLogLevel"] as string) ?? "INFO";
    }

    // Lambda Function
    const functionResource: LoweredResource = {
      name: `${name}-function`,
      resourceType: "aws:lambda:Function",
      properties: {
        functionName: `${context.adapterConfig.serviceName}-${name}`,
        runtime: (props["runtime"] as string) ?? "nodejs20.x",
        handler: (props["handler"] as string) ?? "index.handler",
        memorySize: (props["memorySize"] as number) ?? 128,
        timeout: (props["timeout"] as number) ?? 30,
        role: resolvedDeps.roleName
          ? { ref: resolvedDeps.roleName }
          : undefined,
        ...(context.adapterConfig.codePath
          ? { code: { path: context.adapterConfig.codePath } }
          : {}),
        ...(context.adapterConfig.codeS3
          ? {
              s3Bucket: context.adapterConfig.codeS3.bucket,
              s3Key: context.adapterConfig.codeS3.key,
            }
          : {}),
        ...(props["tracing"] === true
          ? { tracingConfig: { mode: "Active" } }
          : {}),
        ...(Array.isArray(props["layers"]) &&
        (props["layers"] as string[]).length > 0
          ? { layers: props["layers"] }
          : {}),
        environment:
          Object.keys(envVars).length > 0 ? { variables: envVars } : undefined,
        tags: createStandardTags(node.id, "aws-lambda"),
      },
      sourceId: node.id,
      dependsOn: resolvedDeps.roleName ? [resolvedDeps.roleName] : [],
    };

    resources.push(functionResource);

    return resources;
  }
}
