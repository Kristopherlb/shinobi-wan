import type { AdapterResult, LoweredResource, AdapterConfig } from './types';

/**
 * A Pulumi inline program function signature.
 */
export type PulumiFn = () => Promise<Record<string, unknown>>;

/**
 * Resource creation plan — an intermediate representation of the
 * Pulumi program that can be inspected in tests without running Pulumi.
 */
export interface ResourcePlan {
  /** Ordered list of resources to create */
  readonly resources: ReadonlyArray<PlannedResource>;
  /** Stack outputs */
  readonly outputs: Readonly<Record<string, string>>;
}

/**
 * A single resource in the creation plan.
 */
export interface PlannedResource {
  readonly name: string;
  readonly resourceType: string;
  readonly properties: Readonly<Record<string, unknown>>;
  readonly dependsOn: ReadonlyArray<string>;
}

/**
 * Generates a resource plan from an AdapterResult.
 * This is the testable core — it transforms LoweredResources
 * into a deterministic plan without requiring the Pulumi runtime.
 */
export function generatePlan(result: AdapterResult, config: AdapterConfig): ResourcePlan {
  const planned: PlannedResource[] = [];
  const outputs: Record<string, string> = {};

  // Topologically sort resources by dependencies
  const sorted = topologicalSort(result.resources);

  for (const resource of sorted) {
    planned.push({
      name: resource.name,
      resourceType: resource.resourceType,
      properties: resource.properties,
      dependsOn: resource.dependsOn as string[],
    });

    // Collect outputs based on resource type
    switch (resource.resourceType) {
      case 'aws:lambda:Function':
        outputs[`${resource.name}-arn`] = `\${${resource.name}.arn}`;
        break;
      case 'aws:sqs:Queue':
        outputs[`${resource.name}-url`] = `\${${resource.name}.url}`;
        outputs[`${resource.name}-arn`] = `\${${resource.name}.arn}`;
        break;
      case 'aws:iam:Role':
        outputs[`${resource.name}-arn`] = `\${${resource.name}.arn}`;
        break;
    }
  }

  return { resources: planned, outputs };
}

/**
 * Topologically sorts resources by their dependency graph.
 * Resources with no dependencies come first.
 */
function topologicalSort(resources: ReadonlyArray<LoweredResource>): ReadonlyArray<LoweredResource> {
  const nameToResource = new Map<string, LoweredResource>();
  for (const r of resources) {
    nameToResource.set(r.name, r);
  }

  const visited = new Set<string>();
  const sorted: LoweredResource[] = [];

  function visit(name: string): void {
    if (visited.has(name)) return;
    visited.add(name);

    const resource = nameToResource.get(name);
    if (!resource) return;

    for (const dep of resource.dependsOn) {
      visit(dep);
    }

    sorted.push(resource);
  }

  // Visit in deterministic (alphabetical) order
  const names = [...nameToResource.keys()].sort();
  for (const name of names) {
    visit(name);
  }

  return sorted;
}
