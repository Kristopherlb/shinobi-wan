import { describe, it, expect } from 'vitest';
import { createTestNode, createTestEdge } from '@shinobi/ir';
import type { GraphMutation } from '@shinobi/ir';
import { ComponentPlatformBinder, TriggersBinder, BinderRegistry } from '@shinobi/binder';
import { BaselinePolicyEvaluator } from '@shinobi/policy';
import { runGoldenCase } from '../golden-runner';

/**
 * Golden test for Blueprint BP-I11: Data Lake
 *
 * Architecture:
 *   VPC + Subnet + Security Group + KMS
 *   S3 (raw-data, processed-data)
 *   Glue Catalog + Glue Job + Glue Crawler
 *   Athena Workgroup
 *
 * Platform-only blueprint — platform-to-platform bindsTo edges
 * produce zero intents.
 *
 * Gates: determinism (G-001), compilation (G-002), policy evaluation
 */

function setupBlueprint(): ReadonlyArray<GraphMutation> {
  const dataVpc = createTestNode({
    id: 'platform:data-vpc',
    type: 'platform',
    metadata: { properties: { platform: 'aws-vpc', cidrBlock: '10.0.0.0/16' } },
  });

  const dataSubnet = createTestNode({
    id: 'platform:data-subnet',
    type: 'platform',
    metadata: {
      properties: {
        platform: 'aws-subnet',
        vpcId: 'platform:data-vpc',
        cidrBlock: '10.0.1.0/24',
        availabilityZone: 'us-east-1a',
        mapPublicIpOnLaunch: false,
      },
    },
  });

  const dataSg = createTestNode({
    id: 'platform:data-sg',
    type: 'platform',
    metadata: { properties: { platform: 'aws-security-group', vpcId: 'platform:data-vpc', description: 'Data lake SG' } },
  });

  const encryptionKey = createTestNode({
    id: 'platform:encryption-key',
    type: 'platform',
    metadata: { properties: { platform: 'aws-kms', description: 'Data lake key', enableKeyRotation: true } },
  });

  const rawData = createTestNode({
    id: 'platform:raw-data',
    type: 'platform',
    metadata: { properties: { platform: 'aws-s3', versioning: true } },
  });

  const processedData = createTestNode({
    id: 'platform:processed-data',
    type: 'platform',
    metadata: { properties: { platform: 'aws-s3', versioning: true } },
  });

  const dataCatalog = createTestNode({
    id: 'platform:data-catalog',
    type: 'platform',
    metadata: {
      properties: {
        platform: 'aws-glue-catalog',
        databaseName: 'data_lake_catalog',
        description: 'Central data catalog',
      },
    },
  });

  const etlJob = createTestNode({
    id: 'platform:etl-job',
    type: 'platform',
    metadata: {
      properties: {
        platform: 'aws-glue-job',
        glueVersion: '4.0',
        command: { name: 'glueetl', scriptLocation: 's3://scripts/etl.py' },
        workerType: 'G.1X',
        numberOfWorkers: 5,
        securityConfiguration: 'data-lake-sec-config',
      },
    },
  });

  const dataCrawler = createTestNode({
    id: 'platform:data-crawler',
    type: 'platform',
    metadata: {
      properties: {
        platform: 'aws-glue-crawler',
        databaseName: 'data_lake_catalog',
        s3Targets: [{ path: 's3://raw-data/' }, { path: 's3://processed-data/' }],
        schedule: 'cron(0 12 * * ? *)',
      },
    },
  });

  const queryWorkgroup = createTestNode({
    id: 'platform:query-workgroup',
    type: 'platform',
    metadata: {
      properties: {
        platform: 'aws-athena-workgroup',
        outputLocation: 's3://query-results/',
        encryptionOption: 'SSE_S3',
        bytesScannedCutoffPerQuery: 10737418240,
      },
    },
  });

  const etlReadsRaw = createTestEdge({
    id: 'edge:bindsTo:platform:etl-job:platform:raw-data',
    type: 'bindsTo',
    source: etlJob.id,
    target: rawData.id,
    metadata: { bindingConfig: { resourceType: 'bucket', accessLevel: 'read' } },
  });

  const etlWritesProcessed = createTestEdge({
    id: 'edge:bindsTo:platform:etl-job:platform:processed-data',
    type: 'bindsTo',
    source: etlJob.id,
    target: processedData.id,
    metadata: { bindingConfig: { resourceType: 'bucket', accessLevel: 'write' } },
  });

  const crawlerWritesCatalog = createTestEdge({
    id: 'edge:bindsTo:platform:data-crawler:platform:data-catalog',
    type: 'bindsTo',
    source: dataCrawler.id,
    target: dataCatalog.id,
    metadata: { bindingConfig: { resourceType: 'glue-catalog', accessLevel: 'write' } },
  });

  return [
    { type: 'addNode', node: dataVpc },
    { type: 'addNode', node: dataSubnet },
    { type: 'addNode', node: dataSg },
    { type: 'addNode', node: encryptionKey },
    { type: 'addNode', node: rawData },
    { type: 'addNode', node: processedData },
    { type: 'addNode', node: dataCatalog },
    { type: 'addNode', node: etlJob },
    { type: 'addNode', node: dataCrawler },
    { type: 'addNode', node: queryWorkgroup },
    { type: 'addEdge', edge: etlReadsRaw },
    { type: 'addEdge', edge: etlWritesProcessed },
    { type: 'addEdge', edge: crawlerWritesCatalog },
  ];
}

function makeBinders() {
  const registry = new BinderRegistry();
  registry.register(new ComponentPlatformBinder());
  registry.register(new TriggersBinder());
  return registry.getBinders();
}

describe('Golden: Blueprint BP-I11 — Data Lake', () => {
  const evaluator = new BaselinePolicyEvaluator();

  it('compiles successfully', () => {
    const { compilation } = runGoldenCase({
      setup: setupBlueprint,
      config: { policyPack: 'Baseline' },
      binders: makeBinders(),
      evaluators: [evaluator],
    });

    expect(compilation.validation.valid).toBe(true);
  });

  it('contains all 10 nodes', () => {
    const { compilation } = runGoldenCase({
      setup: setupBlueprint,
      config: { policyPack: 'Baseline' },
      binders: makeBinders(),
      evaluators: [evaluator],
    });

    expect(compilation.snapshot.nodes).toHaveLength(10);
    const ids = compilation.snapshot.nodes.map((n) => n.id);
    expect(ids).toContain('platform:data-vpc');
    expect(ids).toContain('platform:data-subnet');
    expect(ids).toContain('platform:data-sg');
    expect(ids).toContain('platform:encryption-key');
    expect(ids).toContain('platform:raw-data');
    expect(ids).toContain('platform:processed-data');
    expect(ids).toContain('platform:data-catalog');
    expect(ids).toContain('platform:etl-job');
    expect(ids).toContain('platform:data-crawler');
    expect(ids).toContain('platform:query-workgroup');
  });

  it('contains 3 edges', () => {
    const { compilation } = runGoldenCase({
      setup: setupBlueprint,
      config: { policyPack: 'Baseline' },
      binders: makeBinders(),
      evaluators: [evaluator],
    });

    expect(compilation.snapshot.edges).toHaveLength(3);
  });

  it('emits zero intents (platform-to-platform edges)', () => {
    const { compilation } = runGoldenCase({
      setup: setupBlueprint,
      config: { policyPack: 'Baseline' },
      binders: makeBinders(),
      evaluators: [evaluator],
    });

    expect(compilation.intents).toHaveLength(0);
  });

  it('determinism: identical output across two runs', () => {
    const opts = {
      setup: setupBlueprint,
      config: { policyPack: 'Baseline' },
      binders: makeBinders(),
      evaluators: [evaluator],
    };

    const r1 = runGoldenCase(opts);
    const r2 = runGoldenCase(opts);
    expect(r1.serialized).toBe(r2.serialized);
  });

  describe('policy evaluation across packs', () => {
    it.each(['Baseline', 'FedRAMP-Moderate', 'FedRAMP-High'] as const)(
      'evaluates with pack %s without throwing',
      (pack) => {
        const { compilation } = runGoldenCase({
          setup: setupBlueprint,
          config: { policyPack: pack },
          binders: makeBinders(),
          evaluators: [evaluator],
        });

        expect(compilation.policy?.violations).toBeDefined();
      },
    );

    it('glue-job-security-config-missing does not fire (security config set)', () => {
      const { compilation } = runGoldenCase({
        setup: setupBlueprint,
        config: { policyPack: 'Baseline' },
        binders: makeBinders(),
        evaluators: [evaluator],
      });

      const violations = compilation.policy?.violations.filter(
        (v) => v.ruleId === 'glue-job-security-config-missing',
      );
      expect(violations).toHaveLength(0);
    });

    it('athena-workgroup-encryption-disabled does not fire (SSE_S3 set)', () => {
      const { compilation } = runGoldenCase({
        setup: setupBlueprint,
        config: { policyPack: 'Baseline' },
        binders: makeBinders(),
        evaluators: [evaluator],
      });

      const violations = compilation.policy?.violations.filter(
        (v) => v.ruleId === 'athena-workgroup-encryption-disabled',
      );
      expect(violations).toHaveLength(0);
    });

    it('athena-workgroup-bytes-limit-missing does not fire (cutoff set)', () => {
      const { compilation } = runGoldenCase({
        setup: setupBlueprint,
        config: { policyPack: 'Baseline' },
        binders: makeBinders(),
        evaluators: [evaluator],
      });

      const violations = compilation.policy?.violations.filter(
        (v) => v.ruleId === 'athena-workgroup-bytes-limit-missing',
      );
      expect(violations).toHaveLength(0);
    });
  });
});
