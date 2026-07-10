import type { Node } from '@shinobi/ir';
import type {
  LoweredResource,
  LoweringContext,
  NodeLowerer,
  ResolvedDeps,
} from '../types';
import { shortName, createStandardTags } from './utils';

/**
 * Lowers a platform node with platform "aws-guardduty" →
 * GuardDuty Detector.
 */
export class GuardDutyLowerer implements NodeLowerer {
  readonly platform = 'aws-guardduty';

  lower(
    node: Node,
    context: LoweringContext,
    _resolvedDeps: ResolvedDeps,
  ): ReadonlyArray<LoweredResource> {
    const name = shortName(node.id);
    const props = node.metadata.properties;
    const extraTags = (props['tags'] as Record<string, string>) ?? {};

    const resources: LoweredResource[] = [];

    const detectorName = `${name}-guardduty-detector`;

    const enabled = props['enabled'] !== false;
    const findingPublishingFrequency =
      (props['findingPublishingFrequency'] as string) ?? 'FIFTEEN_MINUTES';
    const s3DataSource = props['s3DataSource'] !== false;
    const kubernetesDataSource = props['kubernetesDataSource'] === true;
    const malwareProtection = props['malwareProtection'] === true;

    resources.push({
      name: detectorName,
      resourceType: 'aws:guardduty:Detector',
      properties: {
        enable: enabled,
        findingPublishingFrequency,
        datasources: {
          s3Logs: { enable: s3DataSource },
          kubernetes: { auditLogs: { enable: kubernetesDataSource } },
          malwareProtection: {
            scanEc2InstanceWithFindings: {
              ebsVolumes: { enable: malwareProtection },
            },
          },
        },
        tags: createStandardTags(node.id, 'aws-guardduty', extraTags),
      },
      sourceId: node.id,
      dependsOn: [],
    });

    return resources;
  }
}
