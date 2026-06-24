import type { Node } from '@shinobi/ir';
import type { LoweredResource, LoweringContext, NodeLowerer, ResolvedDeps } from '../types';
import { shortName, createStandardTags } from './utils';

/**
 * Lowers a platform node with platform "aws-opensearch-serverless" →
 * OpenSearch Serverless Collection + Security Policy + Access Policy.
 */
export class OpenSearchServerlessLowerer implements NodeLowerer {
  readonly platform = 'aws-opensearch-serverless';

  lower(node: Node, context: LoweringContext, _resolvedDeps: ResolvedDeps): ReadonlyArray<LoweredResource> {
    const name = shortName(node.id);
    const props = node.metadata.properties;
    const serviceName = context.adapterConfig.serviceName;
    const extraTags = (props['tags'] as Record<string, string>) ?? {};

    const resources: LoweredResource[] = [];

    const collectionName = `${name}-collection`;
    const securityPolicyName = `${name}-collection-security-policy`;
    const accessPolicyName = `${name}-collection-access-policy`;

    const collectionType = (props['collectionType'] as string) ?? 'VECTORSEARCH';
    const standbyReplicas = (props['standbyReplicas'] as string) ?? 'ENABLED';
    const encryptionType = (props['encryptionType'] as string) ?? 'AWS_OWNED_KEY';
    const publicAccess = props['publicAccess'] === true;

    // Security Policy (encryption)
    const securityPolicyConfig: Record<string, unknown> = {
      AWSOwnedKey: encryptionType === 'AWS_OWNED_KEY',
    };
    if (props['kmsKeyArn']) {
      securityPolicyConfig['AWSOwnedKey'] = false;
      securityPolicyConfig['KmsARN'] = props['kmsKeyArn'];
    }

    resources.push({
      name: securityPolicyName,
      resourceType: 'aws:opensearchserverless:SecurityPolicy',
      properties: {
        name: `${serviceName}-${name}-enc`,
        type: 'encryption',
        policy: JSON.stringify({
          Rules: [{ ResourceType: 'collection', Resource: [`collection/${serviceName}-${name}`] }],
          ...securityPolicyConfig,
        }),
      },
      sourceId: node.id,
      dependsOn: [],
    });

    // Access Policy
    const allowedPrincipals = (props['allowedPrincipals'] as string[]) ?? [];
    resources.push({
      name: accessPolicyName,
      resourceType: 'aws:opensearchserverless:AccessPolicy',
      properties: {
        name: `${serviceName}-${name}-access`,
        type: 'data',
        policy: JSON.stringify([
          {
            Rules: [
              { ResourceType: 'collection', Resource: [`collection/${serviceName}-${name}`], Permission: ['aoss:*'] },
              { ResourceType: 'index', Resource: [`index/${serviceName}-${name}/*`], Permission: ['aoss:*'] },
            ],
            Principal: allowedPrincipals,
          },
        ]),
      },
      sourceId: node.id,
      dependsOn: [],
    });

    // Collection
    const collectionProperties: Record<string, unknown> = {
      name: `${serviceName}-${name}`,
      type: collectionType,
      standbyReplicas,
      tags: createStandardTags(node.id, 'aws-opensearch-serverless', extraTags),
    };

    if (!publicAccess) {
      collectionProperties['networkAccessPolicy'] = 'VPC';
    }

    resources.push({
      name: collectionName,
      resourceType: 'aws:opensearchserverless:Collection',
      properties: collectionProperties,
      sourceId: node.id,
      dependsOn: [securityPolicyName, accessPolicyName],
    });

    return resources;
  }
}
