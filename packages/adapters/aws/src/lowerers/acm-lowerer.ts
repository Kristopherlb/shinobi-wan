import type { Node } from '@shinobi/ir';
import type { LoweredResource, LoweringContext, NodeLowerer, ResolvedDeps } from '../types';
import { shortName } from './utils';

/**
 * Lowers a platform node with platform "aws-acm" → ACM Certificate.
 *
 * Emits:
 *   - Certificate (DNS validation)
 */
export class AcmLowerer implements NodeLowerer {
  readonly platform = 'aws-acm';

  lower(node: Node, context: LoweringContext, _resolvedDeps: ResolvedDeps): ReadonlyArray<LoweredResource> {
    const name = shortName(node.id);
    const props = node.metadata.properties;
    const serviceName = context.adapterConfig.serviceName;

    const resources: LoweredResource[] = [];

    const certName = `${name}-cert`;

    const domainName = (props['domainName'] as string) ?? `${serviceName}.example.com`;
    const validationMethod = (props['validationMethod'] as string) ?? 'DNS';

    const certProperties: Record<string, unknown> = {
      domainName,
      validationMethod,
      tags: {
        'shinobi:node': node.id,
        'shinobi:platform': 'aws-acm',
      },
    };

    // Add Subject Alternative Names if provided
    if (props['subjectAlternativeNames']) {
      certProperties['subjectAlternativeNames'] = props['subjectAlternativeNames'];
    }

    resources.push({
      name: certName,
      resourceType: 'aws:acm:Certificate',
      properties: certProperties,
      sourceId: node.id,
      dependsOn: [],
    });

    return resources;
  }
}
