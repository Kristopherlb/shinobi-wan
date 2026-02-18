import * as pulumi from '@pulumi/pulumi';
import * as aws from '@pulumi/aws';
import type { ResourcePlan, PlannedResource } from './program-generator';
import type { AdapterConfig } from './types';
import type { PulumiFn } from './program-generator';

/**
 * Registry of Pulumi resource constructors keyed by our resource type strings.
 */
const RESOURCE_CONSTRUCTORS: Record<
  string,
  (name: string, args: Record<string, unknown>, opts?: pulumi.ResourceOptions) => pulumi.Resource
> = {
  'aws:iam:Role': (n, a, o) => new aws.iam.Role(n, a as unknown as aws.iam.RoleArgs, o),
  'aws:iam:Policy': (n, a, o) => new aws.iam.Policy(n, a as unknown as aws.iam.PolicyArgs, o),
  'aws:iam:RolePolicyAttachment': (n, a, o) =>
    new aws.iam.RolePolicyAttachment(n, a as unknown as aws.iam.RolePolicyAttachmentArgs, o),
  'aws:lambda:Function': (n, a, o) =>
    new aws.lambda.Function(n, a as unknown as aws.lambda.FunctionArgs, o),
  'aws:lambda:EventSourceMapping': (n, a, o) =>
    new aws.lambda.EventSourceMapping(n, a as unknown as aws.lambda.EventSourceMappingArgs, o),
  'aws:lambda:Permission': (n, a, o) =>
    new aws.lambda.Permission(n, a as unknown as aws.lambda.PermissionArgs, o),
  'aws:sqs:Queue': (n, a, o) => new aws.sqs.Queue(n, a as aws.sqs.QueueArgs, o),
  'aws:ssm:Parameter': (n, a, o) => new aws.ssm.Parameter(n, a as unknown as aws.ssm.ParameterArgs, o),
  'aws:ec2:SecurityGroupRule': (n, a, o) =>
    new aws.ec2.SecurityGroupRule(n, a as unknown as aws.ec2.SecurityGroupRuleArgs, o),
  'aws:dynamodb:Table': (n, a, o) => new aws.dynamodb.Table(n, a as aws.dynamodb.TableArgs, o),
  'aws:s3:Bucket': (n, a, o) => new aws.s3.Bucket(n, a as aws.s3.BucketArgs, o),
  'aws:s3:BucketVersioningV2': (n, a, o) =>
    new aws.s3.BucketVersioningV2(n, a as unknown as aws.s3.BucketVersioningV2Args, o),
  'aws:apigatewayv2:Api': (n, a, o) =>
    new aws.apigatewayv2.Api(n, a as unknown as aws.apigatewayv2.ApiArgs, o),
  'aws:apigatewayv2:Stage': (n, a, o) =>
    new aws.apigatewayv2.Stage(n, a as unknown as aws.apigatewayv2.StageArgs, o),
  'aws:apigatewayv2:Integration': (n, a, o) =>
    new aws.apigatewayv2.Integration(n, a as unknown as aws.apigatewayv2.IntegrationArgs, o),
  'aws:apigatewayv2:Route': (n, a, o) =>
    new aws.apigatewayv2.Route(n, a as unknown as aws.apigatewayv2.RouteArgs, o),
  'aws:sns:Topic': (n, a, o) => new aws.sns.Topic(n, a as unknown as aws.sns.TopicArgs, o),
};

/**
 * Mapping from (resourceType, propertyName) → which output field to use when
 * resolving a `{ ref }` reference to a previously created resource.
 *
 * Default for unknown combinations is `.arn`.
 */
const REF_OUTPUT_MAP: Record<string, Record<string, string>> = {
  'aws:iam:RolePolicyAttachment': {
    role: 'name',
    policyArn: 'arn',
  },
  'aws:lambda:Function': {
    role: 'arn',
  },
  'aws:lambda:EventSourceMapping': {
    functionName: 'functionName',
    eventSourceArn: 'arn',
  },
};

/**
 * Resolves a `{ ref: 'resource-name' }` or `{ ref: 'resource-name.field' }` value
 * against the live resource registry.
 *
 * Returns a `pulumi.Output` for the appropriate property on the referenced resource.
 */
function resolveRef(
  ref: string,
  propertyName: string,
  consumerResourceType: string,
  registry: Map<string, pulumi.Resource>,
): pulumi.Output<string> {
  // Handle dotted refs like "work-queue-queue.url"
  const dotIdx = ref.indexOf('.');
  let resourceName: string;
  let explicitField: string | undefined;

  if (dotIdx >= 0) {
    resourceName = ref.substring(0, dotIdx);
    explicitField = ref.substring(dotIdx + 1);
  } else {
    resourceName = ref;
  }

  const resource = registry.get(resourceName);
  if (!resource) {
    throw new Error(`Unresolved ref "${ref}": resource "${resourceName}" has not been created`);
  }

  // If explicit field is specified, use it directly
  const field = explicitField ?? resolveOutputField(consumerResourceType, propertyName);

  // Access the output dynamically from the resource
  const res = resource as unknown as Record<string, unknown>;
  const output = res[field];
  if (output && typeof (output as pulumi.Output<string>).apply === 'function') {
    return output as pulumi.Output<string>;
  }

  if (explicitField) {
    throw new Error(`Unresolved ref "${ref}": field "${field}" does not exist on "${resourceName}"`);
  }

  // For implicit field resolution, fallback to arn if available.
  const fallback = res['arn'];
  if (fallback && typeof (fallback as pulumi.Output<string>).apply === 'function') {
    return fallback as pulumi.Output<string>;
  }

  throw new Error(
    `Unresolved ref "${ref}": unable to resolve property "${propertyName}" for consumer "${consumerResourceType}"`,
  );
}

/**
 * Determines which output field to use when resolving a ref based on context.
 */
function resolveOutputField(consumerResourceType: string, propertyName: string): string {
  const typeMap = REF_OUTPUT_MAP[consumerResourceType];
  if (typeMap && typeMap[propertyName]) {
    return typeMap[propertyName];
  }
  return 'arn';
}

/**
 * Recursively resolves all `{ ref }` values in a properties object,
 * replacing them with live Pulumi Output values.
 */
function resolveProperties(
  properties: Readonly<Record<string, unknown>>,
  consumerResourceType: string,
  registry: Map<string, pulumi.Resource>,
): Record<string, unknown> {
  const resolved: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(properties)) {
    resolved[key] = resolveValue(value, key, consumerResourceType, registry);
  }

  return resolved;
}

function resolveValue(
  value: unknown,
  propertyName: string,
  consumerResourceType: string,
  registry: Map<string, pulumi.Resource>,
): unknown {
  if (value === null || value === undefined) {
    return value;
  }

  if (typeof value === 'object' && !Array.isArray(value)) {
    const obj = value as Record<string, unknown>;

    // Check for { ref: 'name' } pattern
    if ('ref' in obj && typeof obj['ref'] === 'string' && Object.keys(obj).length === 1) {
      return resolveRef(obj['ref'], propertyName, consumerResourceType, registry);
    }

    // Recurse into nested objects (e.g., environment.variables)
    const resolved: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(obj)) {
      resolved[k] = resolveValue(v, k, consumerResourceType, registry);
    }
    return resolved;
  }

  if (Array.isArray(value)) {
    return value.map((item) => resolveValue(item, propertyName, consumerResourceType, registry));
  }

  return value;
}

/**
 * Creates a Pulumi inline program function from a ResourcePlan.
 *
 * The returned function, when executed by the Pulumi Automation API,
 * creates all resources in topological order and returns stack outputs.
 */
export function createPulumiProgram(plan: ResourcePlan, _config: AdapterConfig): PulumiFn {
  return async (): Promise<Record<string, unknown>> => {
    const registry = new Map<string, pulumi.Resource>();
    const outputs: Record<string, unknown> = {};

    for (const resource of plan.resources) {
      const constructor = RESOURCE_CONSTRUCTORS[resource.resourceType];
      if (!constructor) {
        pulumi.log.warn(`No Pulumi constructor for resource type: ${resource.resourceType}`);
        continue;
      }

      // Resolve { ref } values to live Pulumi outputs
      const resolvedProps = resolveProperties(
        resource.properties,
        resource.resourceType,
        registry,
      );

      // Build dependency list from the registry
      const dependsOnResources: pulumi.Resource[] = [];
      for (const depName of resource.dependsOn) {
        const dep = registry.get(depName);
        if (dep) {
          dependsOnResources.push(dep);
        }
      }

      const opts: pulumi.ResourceOptions =
        dependsOnResources.length > 0 ? { dependsOn: dependsOnResources } : {};

      const created = constructor(resource.name, resolvedProps, opts);
      registry.set(resource.name, created);
    }

    // Collect stack outputs from plan.outputs
    for (const [key, templateValue] of Object.entries(plan.outputs)) {
      // Template values look like "${resource-name.field}" — resolve to actual outputs
      const match = templateValue.match(/^\$\{(.+?)\.(.+?)\}$/);
      if (match) {
        const [, resourceName, field] = match;
        const resource = registry.get(resourceName);
        if (!resource) {
          throw new Error(
            `Unresolved output "${key}": resource "${resourceName}" was not created from plan`,
          );
        }

          const res = resource as unknown as Record<string, unknown>;
        if (!(field in res)) {
          throw new Error(
            `Unresolved output "${key}": field "${field}" does not exist on resource "${resourceName}"`,
          );
        }
        outputs[key] = res[field];
      } else {
        outputs[key] = templateValue;
      }
    }

    return outputs;
  };
}
