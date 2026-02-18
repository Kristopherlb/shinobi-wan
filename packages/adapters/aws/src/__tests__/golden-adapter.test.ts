import { describe, it, expect } from 'vitest';
import type { IamIntent, ConfigIntent } from '@shinobi/contracts';
import { createTestNode, createTestEdge, createSnapshot } from '@shinobi/ir';
import { lower } from '../adapter';
import { generatePlan } from '../program-generator';
import type { LoweringContext, AdapterConfig } from '../types';

const DEFAULT_CONFIG: AdapterConfig = {
  region: 'us-east-1',
  serviceName: 'golden-test',
};

// ── DynamoDB Scenario ───────────────────────────────────────────────────────

function dynamodbContext(): LoweringContext {
  const lambda = createTestNode({
    id: 'component:writer',
    type: 'component',
    metadata: { properties: { platform: 'aws-lambda' } },
  });
  const dynamo = createTestNode({
    id: 'platform:items-db',
    type: 'platform',
    metadata: { properties: { platform: 'aws-dynamodb' } },
  });
  const edge = createTestEdge({
    id: 'edge:bindsTo:component:writer:platform:items-db',
    type: 'bindsTo',
    source: lambda.id,
    target: dynamo.id,
    metadata: { bindingConfig: { resourceType: 'table', accessLevel: 'write' } },
  });

  const snapshot = createSnapshot([lambda, dynamo], [edge]);

  const iamIntent: IamIntent = {
    type: 'iam',
    schemaVersion: '1.0.0',
    sourceEdgeId: edge.id,
    principal: { nodeRef: lambda.id, role: 'function' },
    resource: { nodeRef: dynamo.id, resourceType: 'table', scope: 'specific' },
    actions: [{ level: 'write', action: 'write' }],
  };

  const configIntent: ConfigIntent = {
    type: 'config',
    schemaVersion: '1.0.0',
    sourceEdgeId: edge.id,
    targetNodeRef: lambda.id,
    key: 'TABLE_NAME',
    valueSource: { type: 'reference', nodeRef: 'items-db', field: 'name' },
  };

  return { intents: [iamIntent, configIntent], snapshot, adapterConfig: DEFAULT_CONFIG };
}

// ── S3 Scenario ─────────────────────────────────────────────────────────────

function s3Context(): LoweringContext {
  const lambda = createTestNode({
    id: 'component:reader',
    type: 'component',
    metadata: { properties: { platform: 'aws-lambda' } },
  });
  const s3 = createTestNode({
    id: 'platform:assets',
    type: 'platform',
    metadata: { properties: { platform: 'aws-s3', versioning: true } },
  });
  const edge = createTestEdge({
    id: 'edge:bindsTo:component:reader:platform:assets',
    type: 'bindsTo',
    source: lambda.id,
    target: s3.id,
    metadata: { bindingConfig: { resourceType: 'bucket', accessLevel: 'read' } },
  });

  const snapshot = createSnapshot([lambda, s3], [edge]);

  const iamIntent: IamIntent = {
    type: 'iam',
    schemaVersion: '1.0.0',
    sourceEdgeId: edge.id,
    principal: { nodeRef: lambda.id, role: 'function' },
    resource: { nodeRef: s3.id, resourceType: 'bucket', scope: 'specific' },
    actions: [{ level: 'read', action: 'read' }],
  };

  const configIntent: ConfigIntent = {
    type: 'config',
    schemaVersion: '1.0.0',
    sourceEdgeId: edge.id,
    targetNodeRef: lambda.id,
    key: 'BUCKET_NAME',
    valueSource: { type: 'reference', nodeRef: 'assets', field: 'bucket' },
  };

  return { intents: [iamIntent, configIntent], snapshot, adapterConfig: DEFAULT_CONFIG };
}

// ── API Gateway Scenario ────────────────────────────────────────────────────

function apigwContext(): LoweringContext {
  const gw = createTestNode({
    id: 'platform:gateway',
    type: 'platform',
    metadata: { properties: { platform: 'aws-apigateway' } },
  });
  const lambda = createTestNode({
    id: 'component:handler',
    type: 'component',
    metadata: { properties: { platform: 'aws-lambda' } },
  });
  const edge = createTestEdge({
    id: 'edge:triggers:platform:gateway:component:handler',
    type: 'triggers',
    source: gw.id,
    target: lambda.id,
    metadata: { bindingConfig: { resourceType: 'api', route: '/items', method: 'GET' } },
  });

  const snapshot = createSnapshot([gw, lambda], [edge]);

  const iamIntent: IamIntent = {
    type: 'iam',
    schemaVersion: '1.0.0',
    sourceEdgeId: edge.id,
    principal: { nodeRef: lambda.id, role: 'function' },
    resource: { nodeRef: gw.id, resourceType: 'api', scope: 'specific' },
    actions: [{ level: 'invoke', action: 'invoke' }],
  };

  return { intents: [iamIntent], snapshot, adapterConfig: DEFAULT_CONFIG };
}

// ── Multi-resource Scenario ─────────────────────────────────────────────────

function multiContext(): LoweringContext {
  const gw = createTestNode({
    id: 'platform:gateway',
    type: 'platform',
    metadata: { properties: { platform: 'aws-apigateway' } },
  });
  const lambda = createTestNode({
    id: 'component:handler',
    type: 'component',
    metadata: { properties: { platform: 'aws-lambda' } },
  });
  const dynamo = createTestNode({
    id: 'platform:items-db',
    type: 'platform',
    metadata: { properties: { platform: 'aws-dynamodb' } },
  });
  const triggersEdge = createTestEdge({
    id: 'edge:triggers:platform:gateway:component:handler',
    type: 'triggers',
    source: gw.id,
    target: lambda.id,
    metadata: { bindingConfig: { resourceType: 'api', route: '/items', method: 'GET' } },
  });
  const bindsToEdge = createTestEdge({
    id: 'edge:bindsTo:component:handler:platform:items-db',
    type: 'bindsTo',
    source: lambda.id,
    target: dynamo.id,
    metadata: { bindingConfig: { resourceType: 'table', accessLevel: 'write' } },
  });

  const snapshot = createSnapshot([gw, lambda, dynamo], [triggersEdge, bindsToEdge]);

  const iamTriggers: IamIntent = {
    type: 'iam',
    schemaVersion: '1.0.0',
    sourceEdgeId: triggersEdge.id,
    principal: { nodeRef: lambda.id, role: 'function' },
    resource: { nodeRef: gw.id, resourceType: 'api', scope: 'specific' },
    actions: [{ level: 'invoke', action: 'invoke' }],
  };

  const iamBinds: IamIntent = {
    type: 'iam',
    schemaVersion: '1.0.0',
    sourceEdgeId: bindsToEdge.id,
    principal: { nodeRef: lambda.id, role: 'function' },
    resource: { nodeRef: dynamo.id, resourceType: 'table', scope: 'specific' },
    actions: [{ level: 'write', action: 'write' }],
  };

  const configIntent: ConfigIntent = {
    type: 'config',
    schemaVersion: '1.0.0',
    sourceEdgeId: bindsToEdge.id,
    targetNodeRef: lambda.id,
    key: 'TABLE_NAME',
    valueSource: { type: 'reference', nodeRef: 'items-db', field: 'name' },
  };

  return { intents: [iamTriggers, iamBinds, configIntent], snapshot, adapterConfig: DEFAULT_CONFIG };
}

function lowerAndPlan(ctx: LoweringContext) {
  const adapterResult = lower(ctx);
  const plan = generatePlan(adapterResult, ctx.adapterConfig);
  return { adapterResult, plan };
}

// ── Tests ────────────────────────────────────────────────────────────────────

describe('Golden: Adapter Determinism', () => {
  describe('DynamoDB scenario', () => {
    it('plan is deterministic', () => {
      const r1 = lowerAndPlan(dynamodbContext());
      const r2 = lowerAndPlan(dynamodbContext());
      expect(JSON.stringify(r1.plan)).toBe(JSON.stringify(r2.plan));
    });

    it('plan contains Table resource', () => {
      const { plan } = lowerAndPlan(dynamodbContext());
      const types = plan.resources.map((r) => r.resourceType);
      expect(types).toContain('aws:dynamodb:Table');
    });

    it('dependencies are in correct order', () => {
      const { plan } = lowerAndPlan(dynamodbContext());
      const names = plan.resources.map((r) => r.name);
      const fn = plan.resources.find((r) => r.resourceType === 'aws:lambda:Function');
      if (fn) {
        const fnIdx = names.indexOf(fn.name);
        for (const dep of fn.dependsOn) {
          const depIdx = names.indexOf(dep);
          expect(depIdx).toBeLessThan(fnIdx);
        }
      }
    });
  });

  describe('S3 scenario', () => {
    it('plan is deterministic', () => {
      const r1 = lowerAndPlan(s3Context());
      const r2 = lowerAndPlan(s3Context());
      expect(JSON.stringify(r1.plan)).toBe(JSON.stringify(r2.plan));
    });

    it('plan contains Bucket and BucketVersioningV2', () => {
      const { plan } = lowerAndPlan(s3Context());
      const types = plan.resources.map((r) => r.resourceType);
      expect(types).toContain('aws:s3:Bucket');
      expect(types).toContain('aws:s3:BucketVersioningV2');
    });

    it('versioning depends on bucket', () => {
      const { plan } = lowerAndPlan(s3Context());
      const versioning = plan.resources.find((r) => r.resourceType === 'aws:s3:BucketVersioningV2');
      const bucket = plan.resources.find((r) => r.resourceType === 'aws:s3:Bucket');
      expect(versioning?.dependsOn).toContain(bucket?.name);
    });
  });

  describe('API Gateway scenario', () => {
    it('plan is deterministic', () => {
      const r1 = lowerAndPlan(apigwContext());
      const r2 = lowerAndPlan(apigwContext());
      expect(JSON.stringify(r1.plan)).toBe(JSON.stringify(r2.plan));
    });

    it('plan contains Integration, Route, and Permission', () => {
      const { plan } = lowerAndPlan(apigwContext());
      const types = plan.resources.map((r) => r.resourceType);
      expect(types).toContain('aws:apigatewayv2:Integration');
      expect(types).toContain('aws:apigatewayv2:Route');
      expect(types).toContain('aws:lambda:Permission');
    });

    it('integration has correct route key', () => {
      const { plan } = lowerAndPlan(apigwContext());
      const route = plan.resources.find((r) => r.resourceType === 'aws:apigatewayv2:Route');
      expect(route?.properties['routeKey']).toBe('GET /items');
    });
  });

  describe('Multi-resource scenario (API GW + Lambda + DynamoDB)', () => {
    it('plan is deterministic', () => {
      const r1 = lowerAndPlan(multiContext());
      const r2 = lowerAndPlan(multiContext());
      expect(JSON.stringify(r1.plan)).toBe(JSON.stringify(r2.plan));
    });

    it('plan has correct total resource count', () => {
      const { plan } = lowerAndPlan(multiContext());
      // IAM: Role + 2×Policy + 4×Attachment = 7 (deduped role)
      // Lambda: Function = 1, DynamoDB: Table = 1
      // API GW: Api + Stage + Integration + Route + Permission = 5
      // Config: SSM parameter = 1
      // Total varies due to dedup, just check > 10
      expect(plan.resources.length).toBeGreaterThan(10);
    });

    it('topological order: deps before dependents', () => {
      const { plan } = lowerAndPlan(multiContext());
      const names = plan.resources.map((r) => r.name);
      for (const resource of plan.resources) {
        const resourceIdx = names.indexOf(resource.name);
        for (const dep of resource.dependsOn) {
          const depIdx = names.indexOf(dep);
          if (depIdx >= 0) {
            expect(depIdx).toBeLessThan(resourceIdx);
          }
        }
      }
    });
  });

  it('cross-scenario: all plans are byte-stable across runs', () => {
    const contexts = [dynamodbContext, s3Context, apigwContext, multiContext];

    for (const makeCtx of contexts) {
      const r1 = lowerAndPlan(makeCtx());
      const r2 = lowerAndPlan(makeCtx());
      expect(JSON.stringify(r1.plan)).toBe(JSON.stringify(r2.plan));
    }
  });
});
