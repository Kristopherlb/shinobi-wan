import { describe, it, expect } from "vitest";
import { createTestNode } from "@shinobi/ir";
import { makeDefaultContext, makeDefaultDeps } from "./test-helpers";
import { GlueCatalogLowerer } from "../lowerers/glue-catalog-lowerer";
import { GlueJobLowerer } from "../lowerers/glue-job-lowerer";
import { GlueCrawlerLowerer } from "../lowerers/glue-crawler-lowerer";

const DEFAULT_CONTEXT = makeDefaultContext();
const DEFAULT_DEPS = makeDefaultDeps();

describe("GlueCatalogLowerer", () => {
  const lowerer = new GlueCatalogLowerer();

  it("should emit 1 resource for database with no tables", () => {
    const node = createTestNode({
      id: "platform:data-catalog",
      type: "platform",
      metadata: {
        properties: { platform: "aws-glue-catalog", databaseName: "my_db" },
      },
    });

    const result = lowerer.lower(node, DEFAULT_CONTEXT, DEFAULT_DEPS);
    expect(result).toHaveLength(1);
    expect(result[0]?.resourceType).toBe("aws:glue:CatalogDatabase");
    expect(result[0]?.name).toBe("data-catalog-database");
  });

  it("should emit database + N tables", () => {
    const node = createTestNode({
      id: "platform:data-catalog",
      type: "platform",
      metadata: {
        properties: {
          platform: "aws-glue-catalog",
          databaseName: "analytics_db",
          tables: [
            { name: "events", columns: [{ name: "id", type: "string" }] },
            { name: "users", columns: [{ name: "user_id", type: "bigint" }] },
          ],
        },
      },
    });

    const result = lowerer.lower(node, DEFAULT_CONTEXT, DEFAULT_DEPS);
    expect(result).toHaveLength(3);
    expect(result[0]?.resourceType).toBe("aws:glue:CatalogDatabase");
    expect(result[1]?.resourceType).toBe("aws:glue:CatalogTable");
    expect(result[1]?.name).toBe("data-catalog-table-0");
    expect(result[2]?.resourceType).toBe("aws:glue:CatalogTable");
    expect(result[2]?.name).toBe("data-catalog-table-1");
  });

  it("tables should depend on database", () => {
    const node = createTestNode({
      id: "platform:catalog",
      type: "platform",
      metadata: {
        properties: {
          platform: "aws-glue-catalog",
          databaseName: "db",
          tables: [{ name: "t1", columns: [{ name: "id", type: "string" }] }],
        },
      },
    });

    const result = lowerer.lower(node, DEFAULT_CONTEXT, DEFAULT_DEPS);
    expect(result[1]?.dependsOn).toContain("catalog-database");
  });

  it("should include databaseName in database input", () => {
    const node = createTestNode({
      id: "platform:catalog",
      type: "platform",
      metadata: {
        properties: {
          platform: "aws-glue-catalog",
          databaseName: "my_catalog",
        },
      },
    });

    const result = lowerer.lower(node, DEFAULT_CONTEXT, DEFAULT_DEPS);
    const dbInput = result[0]?.properties?.databaseInput as Record<
      string,
      unknown
    >;
    expect(dbInput?.name).toBe("my_catalog");
  });

  it("should include description and locationUri when provided", () => {
    const node = createTestNode({
      id: "platform:catalog",
      type: "platform",
      metadata: {
        properties: {
          platform: "aws-glue-catalog",
          databaseName: "db",
          description: "Test database",
          locationUri: "s3://my-bucket/data/",
        },
      },
    });

    const result = lowerer.lower(node, DEFAULT_CONTEXT, DEFAULT_DEPS);
    const dbInput = result[0]?.properties?.databaseInput as Record<
      string,
      unknown
    >;
    expect(dbInput?.description).toBe("Test database");
    expect(dbInput?.locationUri).toBe("s3://my-bucket/data/");
  });

  it("should pass through table storage descriptor options", () => {
    const node = createTestNode({
      id: "platform:catalog",
      type: "platform",
      metadata: {
        properties: {
          platform: "aws-glue-catalog",
          databaseName: "db",
          tables: [
            {
              name: "parquet_table",
              columns: [{ name: "col1", type: "string" }],
              inputFormat:
                "org.apache.hadoop.hive.ql.io.parquet.MapredParquetInputFormat",
              outputFormat:
                "org.apache.hadoop.hive.ql.io.parquet.MapredParquetOutputFormat",
              serializationLibrary:
                "org.apache.hadoop.hive.ql.io.parquet.serde.ParquetHiveSerDe",
              location: "s3://bucket/data/",
            },
          ],
        },
      },
    });

    const result = lowerer.lower(node, DEFAULT_CONTEXT, DEFAULT_DEPS);
    const tableInput = result[1]?.properties?.tableInput as Record<
      string,
      unknown
    >;
    const sd = tableInput?.storageDescriptor as Record<string, unknown>;
    expect(sd?.inputFormat).toBe(
      "org.apache.hadoop.hive.ql.io.parquet.MapredParquetInputFormat",
    );
    expect(sd?.location).toBe("s3://bucket/data/");
    expect(sd?.serDeInfo).toEqual({
      serializationLibrary:
        "org.apache.hadoop.hive.ql.io.parquet.serde.ParquetHiveSerDe",
    });
  });

  it("should include standard tags", () => {
    const node = createTestNode({
      id: "platform:catalog",
      type: "platform",
      metadata: {
        properties: { platform: "aws-glue-catalog", databaseName: "db" },
      },
    });

    const result = lowerer.lower(node, DEFAULT_CONTEXT, DEFAULT_DEPS);
    const tags = result[0]?.properties?.tags as Record<string, string>;
    expect(tags?.["shinobi:node"]).toBe("platform:catalog");
    expect(tags?.["shinobi:platform"]).toBe("aws-glue-catalog");
  });

  it("should merge custom tags", () => {
    const node = createTestNode({
      id: "platform:catalog",
      type: "platform",
      metadata: {
        properties: {
          platform: "aws-glue-catalog",
          databaseName: "db",
          tags: { environment: "prod" },
        },
      },
    });

    const result = lowerer.lower(node, DEFAULT_CONTEXT, DEFAULT_DEPS);
    const tags = result[0]?.properties?.tags as Record<string, string>;
    expect(tags?.environment).toBe("prod");
  });
});

describe("GlueJobLowerer", () => {
  const lowerer = new GlueJobLowerer();

  it("should emit 2 resources (job + log group)", () => {
    const node = createTestNode({
      id: "platform:etl-job",
      type: "platform",
      metadata: {
        properties: {
          platform: "aws-glue-job",
          command: { name: "glueetl", scriptLocation: "s3://scripts/etl.py" },
        },
      },
    });

    const result = lowerer.lower(node, DEFAULT_CONTEXT, DEFAULT_DEPS);
    expect(result).toHaveLength(2);
    expect(result[0]?.resourceType).toBe("aws:glue:Job");
    expect(result[1]?.resourceType).toBe("aws:cloudwatch:LogGroup");
  });

  it("should follow naming pattern", () => {
    const node = createTestNode({
      id: "platform:etl-job",
      type: "platform",
      metadata: { properties: { platform: "aws-glue-job" } },
    });

    const result = lowerer.lower(node, DEFAULT_CONTEXT, DEFAULT_DEPS);
    expect(result[0]?.name).toBe("etl-job-job");
    expect(result[1]?.name).toBe("etl-job-job-log-group");
  });

  it("should use default Glue version 4.0", () => {
    const node = createTestNode({
      id: "platform:job",
      type: "platform",
      metadata: { properties: { platform: "aws-glue-job" } },
    });

    const result = lowerer.lower(node, DEFAULT_CONTEXT, DEFAULT_DEPS);
    expect(result[0]?.properties?.glueVersion).toBe("4.0");
  });

  it("should respect custom worker config", () => {
    const node = createTestNode({
      id: "platform:job",
      type: "platform",
      metadata: {
        properties: {
          platform: "aws-glue-job",
          workerType: "G.2X",
          numberOfWorkers: 10,
          timeout: 600,
        },
      },
    });

    const result = lowerer.lower(node, DEFAULT_CONTEXT, DEFAULT_DEPS);
    expect(result[0]?.properties?.workerType).toBe("G.2X");
    expect(result[0]?.properties?.numberOfWorkers).toBe(10);
    expect(result[0]?.properties?.timeout).toBe(600);
  });

  it("should include security configuration when provided", () => {
    const node = createTestNode({
      id: "platform:job",
      type: "platform",
      metadata: {
        properties: {
          platform: "aws-glue-job",
          securityConfiguration: "my-sec-config",
        },
      },
    });

    const result = lowerer.lower(node, DEFAULT_CONTEXT, DEFAULT_DEPS);
    expect(result[0]?.properties?.securityConfiguration).toBe("my-sec-config");
  });

  it("should omit security configuration when not provided", () => {
    const node = createTestNode({
      id: "platform:job",
      type: "platform",
      metadata: { properties: { platform: "aws-glue-job" } },
    });

    const result = lowerer.lower(node, DEFAULT_CONTEXT, DEFAULT_DEPS);
    expect(result[0]?.properties?.securityConfiguration).toBeUndefined();
  });

  it("should include default arguments when provided", () => {
    const node = createTestNode({
      id: "platform:job",
      type: "platform",
      metadata: {
        properties: {
          platform: "aws-glue-job",
          defaultArguments: { "--enable-spark-ui": "true" },
        },
      },
    });

    const result = lowerer.lower(node, DEFAULT_CONTEXT, DEFAULT_DEPS);
    expect(result[0]?.properties?.defaultArguments).toEqual({
      "--enable-spark-ui": "true",
    });
  });

  it("should include standard tags", () => {
    const node = createTestNode({
      id: "platform:job",
      type: "platform",
      metadata: { properties: { platform: "aws-glue-job" } },
    });

    const result = lowerer.lower(node, DEFAULT_CONTEXT, DEFAULT_DEPS);
    const tags = result[0]?.properties?.tags as Record<string, string>;
    expect(tags?.["shinobi:platform"]).toBe("aws-glue-job");
  });
});

describe("GlueCrawlerLowerer", () => {
  const lowerer = new GlueCrawlerLowerer();

  it("should emit 1 resource (crawler)", () => {
    const node = createTestNode({
      id: "platform:data-crawler",
      type: "platform",
      metadata: {
        properties: {
          platform: "aws-glue-crawler",
          databaseName: "my_db",
          s3Targets: [{ path: "s3://bucket/data/" }],
        },
      },
    });

    const result = lowerer.lower(node, DEFAULT_CONTEXT, DEFAULT_DEPS);
    expect(result).toHaveLength(1);
    expect(result[0]?.resourceType).toBe("aws:glue:Crawler");
    expect(result[0]?.name).toBe("data-crawler-crawler");
  });

  it("should include database name and s3 targets", () => {
    const node = createTestNode({
      id: "platform:crawler",
      type: "platform",
      metadata: {
        properties: {
          platform: "aws-glue-crawler",
          databaseName: "analytics_db",
          s3Targets: [{ path: "s3://raw-data/", exclusions: ["temp/**"] }],
        },
      },
    });

    const result = lowerer.lower(node, DEFAULT_CONTEXT, DEFAULT_DEPS);
    expect(result[0]?.properties?.databaseName).toBe("analytics_db");
    expect(result[0]?.properties?.s3Targets).toEqual([
      { path: "s3://raw-data/", exclusions: ["temp/**"] },
    ]);
  });

  it("should use default schema change policy", () => {
    const node = createTestNode({
      id: "platform:crawler",
      type: "platform",
      metadata: {
        properties: {
          platform: "aws-glue-crawler",
          databaseName: "db",
          s3Targets: [{ path: "s3://data/" }],
        },
      },
    });

    const result = lowerer.lower(node, DEFAULT_CONTEXT, DEFAULT_DEPS);
    expect(result[0]?.properties?.schemaChangePolicy).toEqual({
      updateBehavior: "UPDATE_IN_DATABASE",
      deleteBehavior: "DEPRECATE_IN_DATABASE",
    });
  });

  it("should include schedule when provided", () => {
    const node = createTestNode({
      id: "platform:crawler",
      type: "platform",
      metadata: {
        properties: {
          platform: "aws-glue-crawler",
          databaseName: "db",
          s3Targets: [{ path: "s3://data/" }],
          schedule: "cron(0 12 * * ? *)",
        },
      },
    });

    const result = lowerer.lower(node, DEFAULT_CONTEXT, DEFAULT_DEPS);
    expect(result[0]?.properties?.schedule).toBe("cron(0 12 * * ? *)");
  });

  it("should include standard tags", () => {
    const node = createTestNode({
      id: "platform:crawler",
      type: "platform",
      metadata: {
        properties: {
          platform: "aws-glue-crawler",
          databaseName: "db",
          s3Targets: [],
        },
      },
    });

    const result = lowerer.lower(node, DEFAULT_CONTEXT, DEFAULT_DEPS);
    const tags = result[0]?.properties?.tags as Record<string, string>;
    expect(tags?.["shinobi:platform"]).toBe("aws-glue-crawler");
  });
});
