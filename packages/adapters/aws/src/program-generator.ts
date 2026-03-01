import type { AdapterResult, LoweredResource, AdapterConfig } from './types';

/**
 * A Pulumi inline program function signature.
 */
export type PulumiFn = () => Promise<Record<string, unknown>>;

/** Maps resource type → stack output entries (suffix + field). */
export const OUTPUT_MAP: Record<string, ReadonlyArray<{ suffix: string; field: string }>> = {
  'aws:lambda:Function': [{ suffix: 'arn', field: 'arn' }],
  'aws:sqs:Queue': [{ suffix: 'url', field: 'url' }, { suffix: 'arn', field: 'arn' }],
  'aws:iam:Role': [{ suffix: 'arn', field: 'arn' }],
  'aws:dynamodb:Table': [{ suffix: 'name', field: 'name' }, { suffix: 'arn', field: 'arn' }],
  'aws:s3:Bucket': [{ suffix: 'bucket', field: 'bucket' }, { suffix: 'arn', field: 'arn' }],
  'aws:apigatewayv2:Api': [{ suffix: 'id', field: 'id' }, { suffix: 'url', field: 'apiEndpoint' }],
  'aws:sns:Topic': [{ suffix: 'arn', field: 'arn' }],
  'aws:cloudfront:Distribution': [{ suffix: 'domainName', field: 'domainName' }, { suffix: 'arn', field: 'arn' }],
  'aws:cloudfront:OriginAccessControl': [{ suffix: 'id', field: 'id' }],
  'aws:wafv2:WebAcl': [{ suffix: 'arn', field: 'arn' }],
  'aws:acm:Certificate': [{ suffix: 'arn', field: 'arn' }],
  'aws:cloudfront:Function': [{ suffix: 'arn', field: 'arn' }],
  'aws:scheduler:Schedule': [{ suffix: 'arn', field: 'arn' }],
  'aws:scheduler:ScheduleGroup': [{ suffix: 'arn', field: 'arn' }],
  'aws:sfn:StateMachine': [{ suffix: 'arn', field: 'arn' }, { suffix: 'stateMachineArn', field: 'stateMachineArn' }],
  'aws:cloudwatch:LogGroup': [{ suffix: 'arn', field: 'arn' }],
  'aws:ec2:Vpc': [{ suffix: 'id', field: 'id' }, { suffix: 'arn', field: 'arn' }],
  'aws:ec2:Subnet': [{ suffix: 'id', field: 'id' }, { suffix: 'arn', field: 'arn' }],
  'aws:ec2:SecurityGroup': [{ suffix: 'id', field: 'id' }, { suffix: 'arn', field: 'arn' }],
  'aws:ec2:InternetGateway': [{ suffix: 'id', field: 'id' }],
  'aws:ecr:Repository': [{ suffix: 'repositoryUrl', field: 'repositoryUrl' }, { suffix: 'arn', field: 'arn' }],
  'aws:ecs:Cluster': [{ suffix: 'arn', field: 'arn' }, { suffix: 'name', field: 'name' }],
  'aws:ecs:TaskDefinition': [{ suffix: 'arn', field: 'arn' }],
  'aws:ecs:Service': [{ suffix: 'name', field: 'name' }, { suffix: 'arn', field: 'id' }],
  'aws:lb:LoadBalancer': [{ suffix: 'dnsName', field: 'dnsName' }, { suffix: 'arn', field: 'arn' }],
  'aws:lb:TargetGroup': [{ suffix: 'arn', field: 'arn' }],
  'aws:lb:Listener': [{ suffix: 'arn', field: 'arn' }],
};

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
    const outputEntries = OUTPUT_MAP[resource.resourceType];
    if (outputEntries) {
      for (const entry of outputEntries) {
        outputs[`${resource.name}-${entry.suffix}`] = `\${${resource.name}.${entry.field}}`;
      }
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
