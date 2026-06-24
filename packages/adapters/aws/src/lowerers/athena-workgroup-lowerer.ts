import type { Node } from '@shinobi/ir';
import type { LoweredResource, LoweringContext, NodeLowerer, ResolvedDeps } from '../types';
import { shortName, createStandardTags, makeResourceName } from './utils';

/**
 * Lowers a platform node with platform "aws-athena-workgroup" -> Athena Workgroup.
 */
export class AthenaWorkgroupLowerer implements NodeLowerer {
  readonly platform = 'aws-athena-workgroup';

  lower(node: Node, context: LoweringContext, _resolvedDeps: ResolvedDeps): ReadonlyArray<LoweredResource> {
    const name = shortName(node.id);
    const config = node.metadata.properties;
    const extraTags = config['tags'] as Record<string, string> | undefined;
    const tags = createStandardTags(node.id, 'aws-athena-workgroup', extraTags);

    const workgroupName = `${name}-workgroup`;

    const outputLocation = config['outputLocation'] as string | undefined;
    const enforceWorkgroupConfiguration = config['enforceWorkgroupConfiguration'] !== false;
    const publishCloudWatchMetricsEnabled = config['publishCloudWatchMetricsEnabled'] !== false;
    const bytesScannedCutoffPerQuery = config['bytesScannedCutoffPerQuery'] as number | undefined;
    const requesterPaysEnabled = config['requesterPaysEnabled'] === true;
    const encryptionOption = (config['encryptionOption'] as string) ?? 'SSE_S3';
    const kmsKeyArn = config['kmsKeyArn'] as string | undefined;

    const resultConfiguration: Record<string, unknown> = {};
    if (outputLocation) resultConfiguration.outputLocation = outputLocation;

    const encryptionConfiguration: Record<string, unknown> = { encryptionOption };
    if (kmsKeyArn) encryptionConfiguration.kmsKeyArn = kmsKeyArn;
    resultConfiguration.encryptionConfiguration = encryptionConfiguration;

    const engineVersion: Record<string, unknown> = {
      selectedEngineVersion: 'AUTO',
    };

    const configuration: Record<string, unknown> = {
      enforceWorkgroupConfiguration,
      publishCloudWatchMetricsEnabled,
      requesterPaysEnabled,
      resultConfiguration,
      engineVersion,
    };

    if (bytesScannedCutoffPerQuery !== undefined) {
      configuration.bytesScannedCutoffPerQuery = bytesScannedCutoffPerQuery;
    }

    return [
      {
        name: workgroupName,
        resourceType: 'aws:athena:Workgroup',
        properties: {
          name: makeResourceName(node.id, context.adapterConfig.serviceName),
          configuration,
          tags,
        },
        sourceId: node.id,
        dependsOn: [],
      },
    ];
  }
}
