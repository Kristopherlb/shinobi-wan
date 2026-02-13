import { describe, it, expect } from 'vitest';
import { parseManifest } from '../parser';

const VALID_MANIFEST = `
service: my-lambda-sqs
components:
  - id: api-handler
    type: component
    platform: aws-lambda
    config:
      runtime: nodejs20.x
      handler: index.handler
      memorySize: 256
      timeout: 30
  - id: work-queue
    type: platform
    platform: aws-sqs
    config:
      visibilityTimeout: 300
bindings:
  - source: api-handler
    target: work-queue
    type: bindsTo
    config:
      resourceType: queue
      accessLevel: write
      network:
        port: 443
        protocol: tcp
      configKeys:
        - key: QUEUE_URL
          valueSource:
            type: reference
            nodeRef: work-queue
            field: url
policyPack: Baseline
`;

describe('parseManifest', () => {
  it('parses a valid manifest', () => {
    const result = parseManifest(VALID_MANIFEST);
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.manifest.service).toBe('my-lambda-sqs');
    expect(result.manifest.components).toHaveLength(2);
    expect(result.manifest.bindings).toHaveLength(1);
    expect(result.manifest.policyPack).toBe('Baseline');
  });

  it('parses component fields correctly', () => {
    const result = parseManifest(VALID_MANIFEST);
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    const lambda = result.manifest.components[0];
    expect(lambda.id).toBe('api-handler');
    expect(lambda.type).toBe('component');
    expect(lambda.platform).toBe('aws-lambda');
    expect(lambda.config).toEqual({
      runtime: 'nodejs20.x',
      handler: 'index.handler',
      memorySize: 256,
      timeout: 30,
    });

    const sqs = result.manifest.components[1];
    expect(sqs.id).toBe('work-queue');
    expect(sqs.type).toBe('platform');
    expect(sqs.platform).toBe('aws-sqs');
  });

  it('parses binding fields correctly', () => {
    const result = parseManifest(VALID_MANIFEST);
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    const binding = result.manifest.bindings[0];
    expect(binding.source).toBe('api-handler');
    expect(binding.target).toBe('work-queue');
    expect(binding.type).toBe('bindsTo');
    expect(binding.config.resourceType).toBe('queue');
    expect(binding.config.accessLevel).toBe('write');
    expect(binding.config.network).toEqual({ port: 443, protocol: 'tcp' });
    expect(binding.config.configKeys).toHaveLength(1);
    expect(binding.config.configKeys?.[0].key).toBe('QUEUE_URL');
  });

  it('allows manifest without policyPack', () => {
    const yaml = `
service: simple
components:
  - id: svc
    type: component
    platform: aws-lambda
bindings: []
`;
    const result = parseManifest(yaml);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.manifest.policyPack).toBeUndefined();
  });

  it('allows component without config', () => {
    const yaml = `
service: simple
components:
  - id: svc
    type: component
    platform: aws-lambda
bindings: []
`;
    const result = parseManifest(yaml);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.manifest.components[0].config).toBeUndefined();
  });

  // --- Error cases ---

  it('rejects invalid YAML', () => {
    const result = parseManifest('{ invalid yaml ::');
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.errors[0].path).toBe('$');
    expect(result.errors[0].message).toContain('YAML parse error');
  });

  it('rejects non-object YAML', () => {
    const result = parseManifest('just a string');
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.errors[0].message).toBe('Manifest must be a YAML object');
  });

  it('rejects missing service field', () => {
    const yaml = `
components: []
bindings: []
`;
    const result = parseManifest(yaml);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.errors.some((e) => e.path === '$.service')).toBe(true);
  });

  it('rejects missing components field', () => {
    const yaml = `
service: test
bindings: []
`;
    const result = parseManifest(yaml);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.errors.some((e) => e.path === '$.components')).toBe(true);
  });

  it('rejects missing bindings field', () => {
    const yaml = `
service: test
components: []
`;
    const result = parseManifest(yaml);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.errors.some((e) => e.path === '$.bindings')).toBe(true);
  });

  it('rejects invalid component type', () => {
    const yaml = `
service: test
components:
  - id: svc
    type: invalid-type
    platform: aws-lambda
bindings: []
`;
    const result = parseManifest(yaml);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.errors.some((e) => e.path === '$.components[0].type')).toBe(true);
  });

  it('rejects missing component id', () => {
    const yaml = `
service: test
components:
  - type: component
    platform: aws-lambda
bindings: []
`;
    const result = parseManifest(yaml);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.errors.some((e) => e.path === '$.components[0].id')).toBe(true);
  });

  it('rejects missing component platform', () => {
    const yaml = `
service: test
components:
  - id: svc
    type: component
bindings: []
`;
    const result = parseManifest(yaml);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.errors.some((e) => e.path === '$.components[0].platform')).toBe(true);
  });

  it('rejects duplicate component ids', () => {
    const yaml = `
service: test
components:
  - id: svc
    type: component
    platform: aws-lambda
  - id: svc
    type: platform
    platform: aws-sqs
bindings: []
`;
    const result = parseManifest(yaml);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.errors.some((e) => e.message.includes('duplicate'))).toBe(true);
  });

  it('rejects invalid binding edge type', () => {
    const yaml = `
service: test
components:
  - id: svc
    type: component
    platform: aws-lambda
  - id: db
    type: platform
    platform: aws-rds
bindings:
  - source: svc
    target: db
    type: invalidEdge
    config:
      resourceType: database
`;
    const result = parseManifest(yaml);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.errors.some((e) => e.path === '$.bindings[0].type')).toBe(true);
  });

  it('rejects binding with missing resourceType', () => {
    const yaml = `
service: test
components:
  - id: svc
    type: component
    platform: aws-lambda
  - id: db
    type: platform
    platform: aws-rds
bindings:
  - source: svc
    target: db
    type: bindsTo
    config:
      accessLevel: read
`;
    const result = parseManifest(yaml);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.errors.some((e) => e.path === '$.bindings[0].config.resourceType')).toBe(true);
  });

  it('rejects binding referencing unknown component', () => {
    const yaml = `
service: test
components:
  - id: svc
    type: component
    platform: aws-lambda
bindings:
  - source: svc
    target: nonexistent
    type: bindsTo
    config:
      resourceType: queue
`;
    const result = parseManifest(yaml);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.errors.some((e) => e.message.includes("'nonexistent'"))).toBe(true);
  });

  it('determinism: same input produces same output', () => {
    const r1 = parseManifest(VALID_MANIFEST);
    const r2 = parseManifest(VALID_MANIFEST);
    expect(JSON.stringify(r1)).toBe(JSON.stringify(r2));
  });
});
