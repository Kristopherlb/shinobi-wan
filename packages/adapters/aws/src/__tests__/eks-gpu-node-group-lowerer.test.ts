import { describe, it, expect } from "vitest";
import { createTestNode } from "@shinobi/ir";
import { makeDefaultContext, makeDefaultDeps } from "./test-helpers";
import { EksGpuNodeGroupLowerer } from "../lowerers/eks-gpu-node-group-lowerer";

const DEFAULT_CONTEXT = makeDefaultContext();
const DEFAULT_DEPS = makeDefaultDeps();

describe("EksGpuNodeGroupLowerer", () => {
  const lowerer = new EksGpuNodeGroupLowerer();

  it("should emit 1 resource (gpu node group)", () => {
    const node = createTestNode({
      id: "platform:gpu-nodes",
      type: "platform",
      metadata: {
        properties: {
          platform: "aws-eks-gpu-node-group",
          clusterRef: "platform:llm-cluster",
          subnetIds: ["platform:subnet-1"],
        },
      },
    });

    const result = lowerer.lower(node, DEFAULT_CONTEXT, DEFAULT_DEPS);
    expect(result).toHaveLength(1);
    expect(result[0]?.resourceType).toBe("aws:eks:NodeGroup");
    expect(result[0]?.name).toBe("gpu-nodes-gpu-node-group");
  });

  it("should default to g5.xlarge instances", () => {
    const node = createTestNode({
      id: "platform:gpu-nodes",
      type: "platform",
      metadata: { properties: { platform: "aws-eks-gpu-node-group" } },
    });

    const result = lowerer.lower(node, DEFAULT_CONTEXT, DEFAULT_DEPS);
    expect(result[0]?.properties?.instanceTypes).toEqual(["g5.xlarge"]);
  });

  it("should default to GPU AMI type", () => {
    const node = createTestNode({
      id: "platform:gpu-nodes",
      type: "platform",
      metadata: { properties: { platform: "aws-eks-gpu-node-group" } },
    });

    const result = lowerer.lower(node, DEFAULT_CONTEXT, DEFAULT_DEPS);
    expect(result[0]?.properties?.amiType).toBe("AL2_x86_64_GPU");
  });

  it("should default to ON_DEMAND capacity", () => {
    const node = createTestNode({
      id: "platform:gpu-nodes",
      type: "platform",
      metadata: { properties: { platform: "aws-eks-gpu-node-group" } },
    });

    const result = lowerer.lower(node, DEFAULT_CONTEXT, DEFAULT_DEPS);
    expect(result[0]?.properties?.capacityType).toBe("ON_DEMAND");
  });

  it("should default to 100GB disk", () => {
    const node = createTestNode({
      id: "platform:gpu-nodes",
      type: "platform",
      metadata: { properties: { platform: "aws-eks-gpu-node-group" } },
    });

    const result = lowerer.lower(node, DEFAULT_CONTEXT, DEFAULT_DEPS);
    expect(result[0]?.properties?.diskSize).toBe(100);
  });

  it("should include default GPU labels", () => {
    const node = createTestNode({
      id: "platform:gpu-nodes",
      type: "platform",
      metadata: { properties: { platform: "aws-eks-gpu-node-group" } },
    });

    const result = lowerer.lower(node, DEFAULT_CONTEXT, DEFAULT_DEPS);
    expect(result[0]?.properties?.labels).toEqual({ "nvidia.com/gpu": "true" });
  });

  it("should include default GPU taints", () => {
    const node = createTestNode({
      id: "platform:gpu-nodes",
      type: "platform",
      metadata: { properties: { platform: "aws-eks-gpu-node-group" } },
    });

    const result = lowerer.lower(node, DEFAULT_CONTEXT, DEFAULT_DEPS);
    expect(result[0]?.properties?.taints).toEqual([
      { key: "nvidia.com/gpu", value: "true", effect: "NO_SCHEDULE" },
    ]);
  });

  it("should default scaling config", () => {
    const node = createTestNode({
      id: "platform:gpu-nodes",
      type: "platform",
      metadata: { properties: { platform: "aws-eks-gpu-node-group" } },
    });

    const result = lowerer.lower(node, DEFAULT_CONTEXT, DEFAULT_DEPS);
    expect(result[0]?.properties?.scalingConfig).toEqual({
      desiredSize: 1,
      minSize: 0,
      maxSize: 4,
    });
  });

  it("should respect custom instance types and scaling", () => {
    const node = createTestNode({
      id: "platform:gpu-nodes",
      type: "platform",
      metadata: {
        properties: {
          platform: "aws-eks-gpu-node-group",
          instanceTypes: ["p4d.24xlarge"],
          scalingConfig: { desiredSize: 2, minSize: 1, maxSize: 8 },
        },
      },
    });

    const result = lowerer.lower(node, DEFAULT_CONTEXT, DEFAULT_DEPS);
    expect(result[0]?.properties?.instanceTypes).toEqual(["p4d.24xlarge"]);
    expect(result[0]?.properties?.scalingConfig).toEqual({
      desiredSize: 2,
      minSize: 1,
      maxSize: 8,
    });
  });

  it("should resolve cluster ref", () => {
    const node = createTestNode({
      id: "platform:gpu-nodes",
      type: "platform",
      metadata: {
        properties: {
          platform: "aws-eks-gpu-node-group",
          clusterRef: "platform:my-cluster",
        },
      },
    });

    const result = lowerer.lower(node, DEFAULT_CONTEXT, DEFAULT_DEPS);
    expect(result[0]?.properties?.clusterName).toEqual({
      ref: "my-cluster-cluster.name",
    });
  });

  it("should resolve subnet refs", () => {
    const node = createTestNode({
      id: "platform:gpu-nodes",
      type: "platform",
      metadata: {
        properties: {
          platform: "aws-eks-gpu-node-group",
          subnetIds: ["platform:subnet-1", "platform:subnet-2"],
        },
      },
    });

    const result = lowerer.lower(node, DEFAULT_CONTEXT, DEFAULT_DEPS);
    expect(result[0]?.properties?.subnetIds).toEqual([
      { ref: "subnet-1-subnet" },
      { ref: "subnet-2-subnet" },
    ]);
  });

  it("should include standard tags", () => {
    const node = createTestNode({
      id: "platform:gpu-nodes",
      type: "platform",
      metadata: { properties: { platform: "aws-eks-gpu-node-group" } },
    });

    const result = lowerer.lower(node, DEFAULT_CONTEXT, DEFAULT_DEPS);
    const tags = result[0]?.properties?.tags as Record<string, string>;
    expect(tags?.["shinobi:platform"]).toBe("aws-eks-gpu-node-group");
  });
});
