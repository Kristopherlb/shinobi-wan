import type { Node } from '@shinobi/ir';
import type { LoweredResource, LoweringContext, NodeLowerer, ResolvedDeps } from '../types';
import { shortName, createStandardTags } from './utils';

/**
 * Lowers a platform node with platform "aws-cloudfront" → CloudFront Distribution + OAC.
 *
 * Emits:
 *   - OriginAccessControl (for S3 OAC)
 *   - Distribution (with S3 origin via OAC, TLSv1.2, cache behavior)
 */
export class CloudFrontLowerer implements NodeLowerer {
  readonly platform = 'aws-cloudfront';

  lower(node: Node, context: LoweringContext, _resolvedDeps: ResolvedDeps): ReadonlyArray<LoweredResource> {
    const name = shortName(node.id);
    const props = node.metadata.properties;
    const serviceName = context.adapterConfig.serviceName;

    const resources: LoweredResource[] = [];

    const oacName = `${name}-oac`;
    const distName = `${name}-distribution`;

    // 1. Origin Access Control
    resources.push({
      name: oacName,
      resourceType: 'aws:cloudfront:OriginAccessControl',
      properties: {
        name: `${serviceName}-${name}-oac`,
        originAccessControlOriginType: 's3',
        signingBehavior: 'always',
        signingProtocol: 'sigv4',
        description: `OAC for ${serviceName}-${name}`,
      },
      sourceId: node.id,
      dependsOn: [],
    });

    // 2. CloudFront Distribution
    const priceClass = (props['priceClass'] as string) ?? 'PriceClass_100';
    const defaultTtl = (props['defaultTtl'] as number) ?? 86400;
    const maxTtl = (props['maxTtl'] as number) ?? 31536000;
    const minTtl = (props['minTtl'] as number) ?? 0;
    const sslProtocol = (props['minimumProtocolVersion'] as string) ?? 'TLSv1.2_2021';
    const defaultRootObject = (props['defaultRootObject'] as string) ?? 'index.html';
    const compress = props['compress'] !== false;

    // Resolve origin bucket from edges
    const originBucket = this.resolveOriginBucket(node, context);

    const distribution: Record<string, unknown> = {
      enabled: true,
      defaultRootObject,
      priceClass,
      origins: [
        {
          domainName: originBucket
            ? { ref: `${shortName(originBucket)}-bucket.bucketRegionalDomainName` }
            : `${serviceName}-${name}.s3.amazonaws.com`,
          originId: `${serviceName}-${name}-s3-origin`,
          originAccessControlId: { ref: oacName },
          s3OriginConfig: {
            originAccessIdentity: '',
          },
        },
      ],
      defaultCacheBehavior: {
        allowedMethods: ['GET', 'HEAD'],
        cachedMethods: ['GET', 'HEAD'],
        targetOriginId: `${serviceName}-${name}-s3-origin`,
        viewerProtocolPolicy: 'redirect-to-https',
        compress,
        forwardedValues: {
          queryString: false,
          cookies: { forward: 'none' },
        },
        minTtl,
        defaultTtl,
        maxTtl,
      },
      viewerCertificate: {
        cloudfrontDefaultCertificate: !props['certificateDomain'],
        ...(props['certificateDomain']
          ? {
              minimumProtocolVersion: sslProtocol,
              sslSupportMethod: 'sni-only',
            }
          : {}),
      },
      restrictions: {
        geoRestriction: {
          restrictionType: 'none',
        },
      },
      tags: createStandardTags(node.id, 'aws-cloudfront'),
    };

    // Add custom domain aliases if provided
    if (props['aliases']) {
      distribution['aliases'] = props['aliases'];
    }

    // Add WAF association if wafAclArn is configured
    if (props['wafAclArn']) {
      distribution['webAclId'] = props['wafAclArn'];
    }

    resources.push({
      name: distName,
      resourceType: 'aws:cloudfront:Distribution',
      properties: distribution,
      sourceId: node.id,
      dependsOn: [oacName],
    });

    return resources;
  }

  /**
   * Find the S3 bucket node connected to this CloudFront distribution via bindsTo edge.
   */
  private resolveOriginBucket(node: Node, context: LoweringContext): string | undefined {
    for (const edge of context.snapshot.edges) {
      if (edge.type !== 'bindsTo') continue;
      if (edge.source !== node.id) continue;

      const target = context.snapshot.nodes.find((n) => n.id === edge.target);
      if (target?.metadata.properties['platform'] === 'aws-s3') {
        return target.id;
      }
    }
    return undefined;
  }
}
