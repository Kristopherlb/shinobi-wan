import { describe, it, expect } from "vitest";
import { SageMakerBatchTransformLowerer } from "../lowerers/sagemaker-batch-transform-lowerer";
import { makeNode, makeDefaultContext, makeDefaultDeps } from "./test-helpers";

const DEFAULT_CONTEXT = makeDefaultContext({
  adapterConfig: { region: "us-east-1", serviceName: "my-service" },
});
const DEFAULT_DEPS = makeDefaultDeps();

describe("SageMakerBatchTransformLowerer", () => {
  const lowerer = new SageMakerBatchTransformLowerer();

  it("has correct platform", () => {
    expect(lowerer.platform).toBe("aws-sagemaker-batch-transform");
  });

  it("produces Model resource", () => {
    const node = makeNode({
      id: "platform:inference-model",
      type: "platform",
      metadata: { properties: { platform: "aws-sagemaker-batch-transform" } },
    });

    const resources = lowerer.lower(node, DEFAULT_CONTEXT, DEFAULT_DEPS);
    expect(resources).toHaveLength(1);
    expect(resources[0].resourceType).toBe("aws:sagemaker:Model");
  });

  it("uses correct naming convention", () => {
    const node = makeNode({
      id: "platform:inference-model",
      type: "platform",
      metadata: { properties: { platform: "aws-sagemaker-batch-transform" } },
    });

    const resources = lowerer.lower(node, DEFAULT_CONTEXT, DEFAULT_DEPS);
    expect(resources[0].name).toBe("inference-model-model");
    expect(resources[0].properties["name"]).toBe("my-service-inference-model");
  });

  it("sets correct tags", () => {
    const node = makeNode({
      id: "platform:model",
      type: "platform",
      metadata: { properties: { platform: "aws-sagemaker-batch-transform" } },
    });

    const resources = lowerer.lower(node, DEFAULT_CONTEXT, DEFAULT_DEPS);
    const tags = resources[0].properties["tags"] as Record<string, string>;
    expect(tags["shinobi:node"]).toBe("platform:model");
    expect(tags["shinobi:platform"]).toBe("aws-sagemaker-batch-transform");
  });

  it("uses default execution role ref when not provided", () => {
    const node = makeNode({
      id: "platform:model",
      type: "platform",
      metadata: { properties: { platform: "aws-sagemaker-batch-transform" } },
    });

    const resources = lowerer.lower(node, DEFAULT_CONTEXT, DEFAULT_DEPS);
    expect(resources[0].properties["executionRoleArn"]).toEqual({
      ref: "model-exec-role",
    });
  });

  it("uses explicit execution role ARN when provided", () => {
    const node = makeNode({
      id: "platform:model",
      type: "platform",
      metadata: {
        properties: {
          platform: "aws-sagemaker-batch-transform",
          executionRoleArn: "arn:aws:iam::123:role/my-role",
        },
      },
    });

    const resources = lowerer.lower(node, DEFAULT_CONTEXT, DEFAULT_DEPS);
    expect(resources[0].properties["executionRoleArn"]).toBe(
      "arn:aws:iam::123:role/my-role",
    );
  });

  it("includes primary container when modelImage is provided", () => {
    const node = makeNode({
      id: "platform:model",
      type: "platform",
      metadata: {
        properties: {
          platform: "aws-sagemaker-batch-transform",
          modelImage:
            "123456789.dkr.ecr.us-east-1.amazonaws.com/my-model:latest",
          modelDataUrl: "s3://my-bucket/model.tar.gz",
        },
      },
    });

    const resources = lowerer.lower(node, DEFAULT_CONTEXT, DEFAULT_DEPS);
    const container = resources[0].properties["primaryContainer"] as Record<
      string,
      unknown
    >;
    expect(container["image"]).toBe(
      "123456789.dkr.ecr.us-east-1.amazonaws.com/my-model:latest",
    );
    expect(container["modelDataUrl"]).toBe("s3://my-bucket/model.tar.gz");
  });

  it("does not include primaryContainer when no image/data", () => {
    const node = makeNode({
      id: "platform:model",
      type: "platform",
      metadata: { properties: { platform: "aws-sagemaker-batch-transform" } },
    });

    const resources = lowerer.lower(node, DEFAULT_CONTEXT, DEFAULT_DEPS);
    expect(resources[0].properties["primaryContainer"]).toBeUndefined();
  });

  it("includes VPC config when provided", () => {
    const vpcConfig = {
      subnetIds: ["subnet-1", "subnet-2"],
      securityGroupIds: ["sg-1"],
    };
    const node = makeNode({
      id: "platform:model",
      type: "platform",
      metadata: {
        properties: { platform: "aws-sagemaker-batch-transform", vpcConfig },
      },
    });

    const resources = lowerer.lower(node, DEFAULT_CONTEXT, DEFAULT_DEPS);
    expect(resources[0].properties["vpcConfig"]).toEqual(vpcConfig);
  });

  it("has no dependencies", () => {
    const node = makeNode({
      id: "platform:model",
      type: "platform",
      metadata: { properties: { platform: "aws-sagemaker-batch-transform" } },
    });

    const resources = lowerer.lower(node, DEFAULT_CONTEXT, DEFAULT_DEPS);
    expect(resources[0].dependsOn).toEqual([]);
  });

  it("sets sourceId to node ID", () => {
    const node = makeNode({
      id: "platform:model",
      type: "platform",
      metadata: { properties: { platform: "aws-sagemaker-batch-transform" } },
    });

    const resources = lowerer.lower(node, DEFAULT_CONTEXT, DEFAULT_DEPS);
    expect(resources[0].sourceId).toBe("platform:model");
  });

  it("output is deterministic", () => {
    const node = makeNode({
      id: "platform:model",
      type: "platform",
      metadata: { properties: { platform: "aws-sagemaker-batch-transform" } },
    });

    const r1 = lowerer.lower(node, DEFAULT_CONTEXT, DEFAULT_DEPS);
    const r2 = lowerer.lower(node, DEFAULT_CONTEXT, DEFAULT_DEPS);
    expect(JSON.stringify(r1)).toBe(JSON.stringify(r2));
  });

  it("passes custom tags", () => {
    const node = makeNode({
      id: "platform:model",
      type: "platform",
      metadata: {
        properties: {
          platform: "aws-sagemaker-batch-transform",
          tags: { team: "ml" },
        },
      },
    });

    const resources = lowerer.lower(node, DEFAULT_CONTEXT, DEFAULT_DEPS);
    const tags = resources[0].properties["tags"] as Record<string, string>;
    expect(tags["team"]).toBe("ml");
  });
});
