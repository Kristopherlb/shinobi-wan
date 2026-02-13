import { describe, it, expect } from 'vitest';
import {
  createNodeId,
  createEdgeId,
  createArtifactId,
  computeSemanticHash,
  isValidNodeId,
  isValidEdgeId,
  isValidArtifactId,
} from '../id-generation';
import type { Node, Edge, DerivedArtifact } from '../types';

describe('createNodeId', () => {
  it('creates ID in format {type}:{canonicalPath}', () => {
    const id = createNodeId('component', 'services/api-gateway');
    expect(id).toBe('component:services/api-gateway');
  });

  it('handles paths with multiple segments', () => {
    const id = createNodeId('config', 'env/production/database');
    expect(id).toBe('config:env/production/database');
  });

  it('is deterministic - same inputs produce same output', () => {
    const id1 = createNodeId('capability', 'queue/sqs');
    const id2 = createNodeId('capability', 'queue/sqs');
    expect(id1).toBe(id2);
  });
});

describe('createEdgeId', () => {
  it('creates ID in format edge:{type}:{sourceId}:{targetId}', () => {
    const id = createEdgeId('bindsTo', 'component:api', 'capability:queue');
    expect(id).toBe('edge:bindsTo:component:api:capability:queue');
  });

  it('is deterministic - same inputs produce same output', () => {
    const id1 = createEdgeId('dependsOn', 'component:a', 'component:b');
    const id2 = createEdgeId('dependsOn', 'component:a', 'component:b');
    expect(id1).toBe(id2);
  });
});

describe('createArtifactId', () => {
  it('creates ID in format artifact:{type}:{sourceNodeId}', () => {
    const id = createArtifactId('iam-policy', 'component:api');
    expect(id).toBe('artifact:iam-policy:component:api');
  });

  it('is deterministic - same inputs produce same output', () => {
    const id1 = createArtifactId('network-rule', 'component:gateway');
    const id2 = createArtifactId('network-rule', 'component:gateway');
    expect(id1).toBe(id2);
  });
});

describe('computeSemanticHash', () => {
  it('produces SHA-256 hash prefixed with sha256:', () => {
    const hash = computeSemanticHash({ id: 'test', type: 'component' });
    expect(hash).toMatch(/^sha256:[a-f0-9]{64}$/);
  });

  it('is deterministic - same semantic content produces same hash', () => {
    const content = { id: 'component:api', type: 'component', properties: {} };
    const hash1 = computeSemanticHash(content);
    const hash2 = computeSemanticHash(content);
    expect(hash1).toBe(hash2);
  });

  it('is key-order independent', () => {
    const content1 = { b: 1, a: 2, c: 3 };
    const content2 = { c: 3, a: 2, b: 1 };
    expect(computeSemanticHash(content1)).toBe(computeSemanticHash(content2));
  });

  it('produces different hashes for different content', () => {
    const hash1 = computeSemanticHash({ value: 1 });
    const hash2 = computeSemanticHash({ value: 2 });
    expect(hash1).not.toBe(hash2);
  });
});

describe('isValidNodeId', () => {
  it('accepts valid node IDs', () => {
    expect(isValidNodeId('component:services/api')).toBe(true);
    expect(isValidNodeId('capability:queue/sqs')).toBe(true);
    expect(isValidNodeId('platform:aws')).toBe(true);
    expect(isValidNodeId('config:env/prod')).toBe(true);
    expect(isValidNodeId('secret:keys/api')).toBe(true);
  });

  it('rejects invalid node IDs', () => {
    expect(isValidNodeId('')).toBe(false);
    expect(isValidNodeId('invalid')).toBe(false);
    expect(isValidNodeId('edge:bindsTo:a:b')).toBe(false);
    expect(isValidNodeId('artifact:iam:x')).toBe(false);
    expect(isValidNodeId('unknown:path')).toBe(false);
  });
});

describe('isValidEdgeId', () => {
  it('accepts valid edge IDs', () => {
    expect(isValidEdgeId('edge:bindsTo:component:a:capability:b')).toBe(true);
    expect(isValidEdgeId('edge:dependsOn:component:x:component:y')).toBe(true);
    expect(isValidEdgeId('edge:triggers:component:a:component:b')).toBe(true);
    expect(isValidEdgeId('edge:contains:component:a:component:b')).toBe(true);
  });

  it('rejects invalid edge IDs', () => {
    expect(isValidEdgeId('')).toBe(false);
    expect(isValidEdgeId('component:api')).toBe(false);
    expect(isValidEdgeId('edge:invalid:a:b')).toBe(false);
    expect(isValidEdgeId('edge:bindsTo')).toBe(false);
  });
});

describe('isValidArtifactId', () => {
  it('accepts valid artifact IDs', () => {
    expect(isValidArtifactId('artifact:iam-policy:component:api')).toBe(true);
    expect(isValidArtifactId('artifact:network-rule:component:gateway')).toBe(true);
    expect(isValidArtifactId('artifact:config-map:component:app')).toBe(true);
    expect(isValidArtifactId('artifact:telemetry-config:component:svc')).toBe(true);
  });

  it('rejects invalid artifact IDs', () => {
    expect(isValidArtifactId('')).toBe(false);
    expect(isValidArtifactId('component:api')).toBe(false);
    expect(isValidArtifactId('artifact:invalid:x')).toBe(false);
    expect(isValidArtifactId('artifact:iam-policy')).toBe(false);
  });
});

describe('semantic hash integration', () => {
  it('excludes ephemeral fields from hash computation for nodes', () => {
    const baseNode: Partial<Node> = {
      id: 'component:api',
      type: 'component',
      provenance: { sourceFile: 'src/api.ts' },
      metadata: { properties: { port: 8080 } },
    };

    // Same semantic content, different line numbers
    const hash1 = computeSemanticHash({
      ...baseNode,
      provenance: { ...baseNode.provenance, lineNumber: 10 },
    });
    const hash2 = computeSemanticHash({
      ...baseNode,
      provenance: { ...baseNode.provenance, lineNumber: 20 },
    });

    expect(hash1).toBe(hash2);
  });

  it('excludes display-only metadata from hash computation', () => {
    const baseNode: Partial<Node> = {
      id: 'component:api',
      type: 'component',
      provenance: { sourceFile: 'src/api.ts' },
      metadata: { properties: { port: 8080 } },
    };

    // Same semantic content, different labels
    const hash1 = computeSemanticHash({
      ...baseNode,
      metadata: { ...baseNode.metadata!, label: 'API Service' },
    });
    const hash2 = computeSemanticHash({
      ...baseNode,
      metadata: { ...baseNode.metadata!, label: 'Backend API' },
    });

    expect(hash1).toBe(hash2);
  });

  it('detects semantic changes in properties', () => {
    const node1: Partial<Node> = {
      id: 'component:api',
      type: 'component',
      metadata: { properties: { port: 8080 } },
    };
    const node2: Partial<Node> = {
      id: 'component:api',
      type: 'component',
      metadata: { properties: { port: 9090 } },
    };

    const hash1 = computeSemanticHash(node1);
    const hash2 = computeSemanticHash(node2);

    expect(hash1).not.toBe(hash2);
  });
});
