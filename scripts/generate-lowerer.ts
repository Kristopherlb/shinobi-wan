#!/usr/bin/env npx tsx
/**
 * Lowerer Generator Script
 *
 * Generates consistent boilerplate for new AWS adapter lowerers.
 *
 * Usage:
 *   npx tsx scripts/generate-lowerer.ts --platform aws-ecs-cluster --resource-type cluster
 *
 * What it creates:
 * 1. packages/adapters/aws/src/lowerers/{platform}-lowerer.ts
 * 2. packages/adapters/aws/src/__tests__/{platform}-lowerer.test.ts
 *
 * What it prints (to be added manually):
 * - Export line for lowerers/index.ts
 * - Registration line for lowerer-registry.ts
 * - ACTION_MAP stub for iam-lowerer.ts
 * - PLATFORM_REF_MAP stub for reference-utils.ts
 * - OUTPUT_MAP stub for program-generator.ts
 * - ARN pattern stub for resolveArnPatternFromNode()
 */

import { writeFileSync, existsSync } from 'fs';
import { resolve } from 'path';

const args = process.argv.slice(2);
const platformIdx = args.indexOf('--platform');
const resourceTypeIdx = args.indexOf('--resource-type');

if (platformIdx === -1 || resourceTypeIdx === -1) {
  console.error('Usage: npx tsx scripts/generate-lowerer.ts --platform <aws-xxx> --resource-type <type>');
  process.exit(1);
}

const platform = args[platformIdx + 1];
const resourceType = args[resourceTypeIdx + 1];

if (!platform || !resourceType) {
  console.error('Both --platform and --resource-type are required');
  process.exit(1);
}

// Derive names
const platformSuffix = platform.replace(/^aws-/, '');
const className = platformSuffix
  .split('-')
  .map((s) => s.charAt(0).toUpperCase() + s.slice(1))
  .join('');
const lowererClassName = `${className}Lowerer`;
const fileName = `${platformSuffix}-lowerer`;

const ADAPTERS_DIR = resolve(__dirname, '../packages/adapters/aws/src');
const LOWERER_PATH = resolve(ADAPTERS_DIR, `lowerers/${fileName}.ts`);
const TEST_PATH = resolve(ADAPTERS_DIR, `__tests__/${fileName}.test.ts`);

// Guard against overwriting
if (existsSync(LOWERER_PATH)) {
  console.error(`Lowerer already exists: ${LOWERER_PATH}`);
  process.exit(1);
}

// Determine Pulumi resource type placeholder
const pulumiType = `aws:${platformSuffix.replace(/-/g, ':')}:Resource`;

// Generate lowerer source
const lowererSource = `import type { Node } from '@shinobi/ir';
import type { LoweredResource, LoweringContext, NodeLowerer, ResolvedDeps } from '../types';
import { shortName } from './utils';

/**
 * Lowers a platform node with platform "${platform}" → ${className} resources.
 */
export class ${lowererClassName} implements NodeLowerer {
  readonly platform = '${platform}';

  lower(node: Node, context: LoweringContext, _resolvedDeps: ResolvedDeps): ReadonlyArray<LoweredResource> {
    const name = shortName(node.id);

    const resources: LoweredResource[] = [];

    resources.push({
      name: \`\${name}-${resourceType}\`,
      resourceType: '${pulumiType}',
      properties: {
        name: \`\${context.adapterConfig.serviceName}-\${name}\`,
        tags: {
          'shinobi:node': node.id,
          'shinobi:platform': '${platform}',
        },
      },
      sourceId: node.id,
      dependsOn: [],
    });

    return resources;
  }
}
`;

// Generate test source
const testSource = `import { describe, it, expect } from 'vitest';
import { ${lowererClassName} } from '../lowerers/${fileName}';
import { makeNode } from './test-helpers';
import type { LoweringContext, ResolvedDeps } from '../types';
import { createSnapshot } from '@shinobi/ir';

const DEFAULT_CONTEXT: LoweringContext = {
  intents: [],
  snapshot: createSnapshot([], []),
  adapterConfig: {
    region: 'us-east-1',
    serviceName: 'my-service',
  },
};

const DEFAULT_DEPS: ResolvedDeps = {
  envVars: {},
  securityGroups: [],
};

describe('${lowererClassName}', () => {
  const lowerer = new ${lowererClassName}();

  it('has correct platform', () => {
    expect(lowerer.platform).toBe('${platform}');
  });

  it('produces ${className} resource', () => {
    const node = makeNode({
      id: 'platform:my-${resourceType}',
      type: 'platform',
      metadata: { properties: { platform: '${platform}' } },
    });

    const resources = lowerer.lower(node, DEFAULT_CONTEXT, DEFAULT_DEPS);
    expect(resources).toHaveLength(1);
    expect(resources[0].resourceType).toBe('${pulumiType}');
  });

  it('uses correct naming convention', () => {
    const node = makeNode({
      id: 'platform:my-${resourceType}',
      type: 'platform',
      metadata: { properties: { platform: '${platform}' } },
    });

    const resources = lowerer.lower(node, DEFAULT_CONTEXT, DEFAULT_DEPS);
    expect(resources[0].name).toBe('my-${resourceType}-${resourceType}');
    expect(resources[0].properties['name']).toBe('my-service-my-${resourceType}');
  });

  it('sets correct tags', () => {
    const node = makeNode({
      id: 'platform:my-${resourceType}',
      type: 'platform',
      metadata: { properties: { platform: '${platform}' } },
    });

    const resources = lowerer.lower(node, DEFAULT_CONTEXT, DEFAULT_DEPS);
    const tags = resources[0].properties['tags'] as Record<string, string>;
    expect(tags['shinobi:node']).toBe('platform:my-${resourceType}');
    expect(tags['shinobi:platform']).toBe('${platform}');
  });

  it('sets sourceId to node ID', () => {
    const node = makeNode({
      id: 'platform:my-${resourceType}',
      type: 'platform',
      metadata: { properties: { platform: '${platform}' } },
    });

    const resources = lowerer.lower(node, DEFAULT_CONTEXT, DEFAULT_DEPS);
    expect(resources[0].sourceId).toBe('platform:my-${resourceType}');
  });

  it('output is deterministic', () => {
    const node = makeNode({
      id: 'platform:my-${resourceType}',
      type: 'platform',
      metadata: { properties: { platform: '${platform}' } },
    });

    const r1 = lowerer.lower(node, DEFAULT_CONTEXT, DEFAULT_DEPS);
    const r2 = lowerer.lower(node, DEFAULT_CONTEXT, DEFAULT_DEPS);
    expect(JSON.stringify(r1)).toBe(JSON.stringify(r2));
  });
});
`;

writeFileSync(LOWERER_PATH, lowererSource);
writeFileSync(TEST_PATH, testSource);

console.log(`Created lowerer: ${LOWERER_PATH}`);
console.log(`Created tests:   ${TEST_PATH}`);
console.log('');
console.log('=== Manual additions needed ===');
console.log('');
console.log(`// lowerers/index.ts:`);
console.log(`export { ${lowererClassName} } from './${fileName}';`);
console.log('');
console.log(`// lowerer-registry.ts (in createDefaultNodeLowererRegistry):`);
console.log(`registry.register(new ${lowererClassName}());`);
console.log('');
console.log(`// iam-lowerer.ts ACTION_MAP:`);
console.log(`  ${resourceType}: {`);
console.log(`    read: ['TODO:GetItem'],`);
console.log(`    write: ['TODO:PutItem'],`);
console.log(`    admin: ['TODO:*'],`);
console.log(`  },`);
console.log('');
console.log(`// reference-utils.ts PLATFORM_REF_MAP:`);
console.log(`  '${platform}': { suffix: '${resourceType}', defaultField: 'arn' },`);
console.log('');
console.log(`// program-generator.ts OUTPUT_MAP:`);
console.log(`  '${pulumiType}': [{ suffix: 'arn', field: 'arn' }],`);
console.log('');
console.log(`// iam-lowerer.ts resolveArnPatternFromNode():`);
console.log(`      case '${platform}':`);
console.log(`        return \`arn:aws:TODO:*:*:\${name}\`;`);
