import { describe, it, expect } from "vitest";
import { LambdaLowerer } from "../lowerers/lambda-lowerer";
import { SqsLowerer } from "../lowerers/sqs-lowerer";
import { makeNode, makeContext, DEFAULT_ADAPTER_CONFIG } from "./test-helpers";
import type { ResolvedDeps } from "../types";

describe("LambdaLowerer", () => {
  const lowerer = new LambdaLowerer();

  const lambdaNode = makeNode({
    id: "component:api-handler",
    type: "component",
    metadata: {
      properties: {
        platform: "aws-lambda",
        runtime: "nodejs20.x",
        handler: "index.handler",
        memorySize: 256,
        timeout: 30,
      },
    },
  });

  const deps: ResolvedDeps = {
    roleName: "api-handler-exec-role",
    envVars: { QUEUE_URL: { ref: "work-queue-queue.url" } },
    securityGroups: [],
  };

  it("produces a Lambda Function resource", () => {
    const resources = lowerer.lower(lambdaNode, makeContext(), deps);

    expect(resources).toHaveLength(1);
    expect(resources[0].resourceType).toBe("aws:lambda:Function");
  });

  it("function name includes service name prefix", () => {
    const resources = lowerer.lower(lambdaNode, makeContext(), deps);

    expect(resources[0].properties["functionName"]).toBe(
      "my-lambda-sqs-api-handler",
    );
  });

  it("passes through runtime, handler, memorySize, timeout", () => {
    const resources = lowerer.lower(lambdaNode, makeContext(), deps);

    expect(resources[0].properties["runtime"]).toBe("nodejs20.x");
    expect(resources[0].properties["handler"]).toBe("index.handler");
    expect(resources[0].properties["memorySize"]).toBe(256);
    expect(resources[0].properties["timeout"]).toBe(30);
  });

  it("references IAM role from resolved deps", () => {
    const resources = lowerer.lower(lambdaNode, makeContext(), deps);

    expect(resources[0].properties["role"]).toEqual({
      ref: "api-handler-exec-role",
    });
    expect(resources[0].dependsOn).toContain("api-handler-exec-role");
  });

  it("includes environment variables from resolved deps", () => {
    const resources = lowerer.lower(lambdaNode, makeContext(), deps);

    const env = resources[0].properties["environment"] as Record<
      string,
      unknown
    >;
    expect(env["variables"]).toEqual({
      QUEUE_URL: { ref: "work-queue-queue.url" },
    });
  });

  it("omits environment when no env vars", () => {
    const noDeps: ResolvedDeps = { envVars: {}, securityGroups: [] };
    const resources = lowerer.lower(lambdaNode, makeContext(), noDeps);

    expect(resources[0].properties["environment"]).toBeUndefined();
  });

  it("includes code path when configured", () => {
    const ctx = makeContext({
      adapterConfig: {
        ...DEFAULT_ADAPTER_CONFIG,
        codePath: "./dist/handler.zip",
      },
    });
    const resources = lowerer.lower(lambdaNode, ctx, deps);

    expect(resources[0].properties["code"]).toEqual({
      path: "./dist/handler.zip",
    });
  });

  it("carries shinobi tags", () => {
    const resources = lowerer.lower(lambdaNode, makeContext(), deps);

    const tags = resources[0].properties["tags"] as Record<string, string>;
    expect(tags["shinobi:node"]).toBe("component:api-handler");
    expect(tags["shinobi:platform"]).toBe("aws-lambda");
  });
});

describe("SqsLowerer", () => {
  const lowerer = new SqsLowerer();

  const sqsNode = makeNode({
    id: "platform:work-queue",
    type: "platform",
    metadata: {
      properties: {
        platform: "aws-sqs",
        visibilityTimeout: 300,
      },
    },
  });

  const deps: ResolvedDeps = { envVars: {}, securityGroups: [] };

  it("produces an SQS Queue resource", () => {
    const resources = lowerer.lower(sqsNode, makeContext(), deps);

    expect(resources).toHaveLength(1);
    expect(resources[0].resourceType).toBe("aws:sqs:Queue");
  });

  it("queue name includes service name prefix", () => {
    const resources = lowerer.lower(sqsNode, makeContext(), deps);

    expect(resources[0].properties["name"]).toBe("my-lambda-sqs-work-queue");
  });

  it("uses visibility timeout from node properties", () => {
    const resources = lowerer.lower(sqsNode, makeContext(), deps);

    expect(resources[0].properties["visibilityTimeoutSeconds"]).toBe(300);
  });

  it("uses default visibility timeout when not specified", () => {
    const node = makeNode({
      id: "platform:basic-queue",
      type: "platform",
      metadata: { properties: { platform: "aws-sqs" } },
    });
    const resources = lowerer.lower(node, makeContext(), deps);

    expect(resources[0].properties["visibilityTimeoutSeconds"]).toBe(30);
  });

  it("carries shinobi tags", () => {
    const resources = lowerer.lower(sqsNode, makeContext(), deps);

    const tags = resources[0].properties["tags"] as Record<string, string>;
    expect(tags["shinobi:node"]).toBe("platform:work-queue");
    expect(tags["shinobi:platform"]).toBe("aws-sqs");
  });

  describe("DLQ support", () => {
    const dlqNode = makeNode({
      id: "platform:work-queue",
      type: "platform",
      metadata: {
        properties: {
          platform: "aws-sqs",
          visibilityTimeout: 300,
          deadLetterQueue: true,
        },
      },
    });

    it("emits two resources when deadLetterQueue is true", () => {
      const resources = lowerer.lower(dlqNode, makeContext(), deps);
      expect(resources).toHaveLength(2);
    });

    it("creates DLQ resource before main queue", () => {
      const resources = lowerer.lower(dlqNode, makeContext(), deps);
      expect(resources[0].name).toBe("work-queue-dlq");
      expect(resources[0].resourceType).toBe("aws:sqs:Queue");
      expect(resources[1].name).toBe("work-queue-queue");
    });

    it("DLQ uses -dlq suffix in name", () => {
      const resources = lowerer.lower(dlqNode, makeContext(), deps);
      expect(resources[0].properties["name"]).toBe(
        "my-lambda-sqs-work-queue-dlq",
      );
    });

    it("DLQ has 14-day default retention", () => {
      const resources = lowerer.lower(dlqNode, makeContext(), deps);
      expect(resources[0].properties["messageRetentionSeconds"]).toBe(1209600);
    });

    it("DLQ has dead-letter-queue role tag", () => {
      const resources = lowerer.lower(dlqNode, makeContext(), deps);
      const tags = resources[0].properties["tags"] as Record<string, string>;
      expect(tags["shinobi:role"]).toBe("dead-letter-queue");
    });

    it("main queue has redrivePolicy pointing to DLQ", () => {
      const resources = lowerer.lower(dlqNode, makeContext(), deps);
      const mainQueue = resources[1];
      const policy = JSON.parse(
        mainQueue.properties["redrivePolicy"] as string,
      );
      expect(policy.deadLetterTargetArn).toEqual({ ref: "work-queue-dlq" });
      expect(policy.maxReceiveCount).toBe(3);
    });

    it("main queue depends on DLQ", () => {
      const resources = lowerer.lower(dlqNode, makeContext(), deps);
      expect(resources[1].dependsOn).toContain("work-queue-dlq");
    });

    it("uses custom maxReceiveCount from config", () => {
      const customNode = makeNode({
        id: "platform:work-queue",
        type: "platform",
        metadata: {
          properties: {
            platform: "aws-sqs",
            deadLetterQueue: true,
            maxReceiveCount: 5,
          },
        },
      });
      const resources = lowerer.lower(customNode, makeContext(), deps);
      const policy = JSON.parse(
        resources[1].properties["redrivePolicy"] as string,
      );
      expect(policy.maxReceiveCount).toBe(5);
    });
  });
});

describe("LambdaLowerer — tracing + Powertools", () => {
  const lowerer = new LambdaLowerer();
  const deps: ResolvedDeps = { envVars: {}, securityGroups: [] };

  it("adds tracingConfig when tracing is true", () => {
    const node = makeNode({
      id: "component:traced-handler",
      type: "component",
      metadata: {
        properties: {
          platform: "aws-lambda",
          tracing: true,
        },
      },
    });
    const resources = lowerer.lower(node, makeContext(), deps);
    expect(resources[0].properties["tracingConfig"]).toEqual({
      mode: "Active",
    });
  });

  it("omits tracingConfig when tracing is not set", () => {
    const node = makeNode({
      id: "component:handler",
      type: "component",
      metadata: { properties: { platform: "aws-lambda" } },
    });
    const resources = lowerer.lower(node, makeContext(), deps);
    expect(resources[0].properties["tracingConfig"]).toBeUndefined();
  });

  it("adds Powertools env vars when powertools is true", () => {
    const node = makeNode({
      id: "component:pw-handler",
      type: "component",
      metadata: {
        properties: {
          platform: "aws-lambda",
          powertools: true,
        },
      },
    });
    const resources = lowerer.lower(node, makeContext(), deps);
    const env = resources[0].properties["environment"] as Record<
      string,
      unknown
    >;
    const vars = env?.["variables"] as Record<string, unknown>;
    expect(vars["POWERTOOLS_SERVICE_NAME"]).toBe("my-lambda-sqs-pw-handler");
    expect(vars["POWERTOOLS_LOG_LEVEL"]).toBe("INFO");
  });

  it("uses custom log level for Powertools", () => {
    const node = makeNode({
      id: "component:pw-handler",
      type: "component",
      metadata: {
        properties: {
          platform: "aws-lambda",
          powertools: true,
          powertoolsLogLevel: "DEBUG",
        },
      },
    });
    const resources = lowerer.lower(node, makeContext(), deps);
    const env = resources[0].properties["environment"] as Record<
      string,
      unknown
    >;
    const vars = env?.["variables"] as Record<string, unknown>;
    expect(vars["POWERTOOLS_LOG_LEVEL"]).toBe("DEBUG");
  });

  it("merges Powertools env vars with resolved deps env vars", () => {
    const node = makeNode({
      id: "component:pw-handler",
      type: "component",
      metadata: {
        properties: {
          platform: "aws-lambda",
          powertools: true,
        },
      },
    });
    const depsWithEnv: ResolvedDeps = {
      envVars: { QUEUE_URL: { ref: "work-queue-queue.url" } },
      securityGroups: [],
    };
    const resources = lowerer.lower(node, makeContext(), depsWithEnv);
    const env = resources[0].properties["environment"] as Record<
      string,
      unknown
    >;
    const vars = env?.["variables"] as Record<string, unknown>;
    expect(vars["QUEUE_URL"]).toEqual({ ref: "work-queue-queue.url" });
    expect(vars["POWERTOOLS_SERVICE_NAME"]).toBeDefined();
  });

  it("adds layers from config", () => {
    const layerArns = ["arn:aws:lambda:us-east-1:123:layer:my-layer:1"];
    const node = makeNode({
      id: "component:layered-handler",
      type: "component",
      metadata: {
        properties: {
          platform: "aws-lambda",
          layers: layerArns,
        },
      },
    });
    const resources = lowerer.lower(node, makeContext(), deps);
    expect(resources[0].properties["layers"]).toEqual(layerArns);
  });

  it("omits layers when not configured", () => {
    const node = makeNode({
      id: "component:handler",
      type: "component",
      metadata: { properties: { platform: "aws-lambda" } },
    });
    const resources = lowerer.lower(node, makeContext(), deps);
    expect(resources[0].properties["layers"]).toBeUndefined();
  });

  it("tracing + Powertools output is deterministic", () => {
    const node = makeNode({
      id: "component:full-handler",
      type: "component",
      metadata: {
        properties: {
          platform: "aws-lambda",
          tracing: true,
          powertools: true,
        },
      },
    });
    const r1 = lowerer.lower(node, makeContext(), deps);
    const r2 = lowerer.lower(node, makeContext(), deps);
    expect(JSON.stringify(r1)).toBe(JSON.stringify(r2));
  });

  it("combines tracing and powertools and layers", () => {
    const node = makeNode({
      id: "component:full-handler",
      type: "component",
      metadata: {
        properties: {
          platform: "aws-lambda",
          tracing: true,
          powertools: true,
          layers: ["arn:aws:lambda:us-east-1:123:layer:powertools:5"],
        },
      },
    });
    const resources = lowerer.lower(node, makeContext(), deps);
    expect(resources[0].properties["tracingConfig"]).toEqual({
      mode: "Active",
    });
    expect(resources[0].properties["layers"]).toHaveLength(1);
    const env = resources[0].properties["environment"] as Record<
      string,
      unknown
    >;
    expect(env?.["variables"]).toBeDefined();
  });
});
