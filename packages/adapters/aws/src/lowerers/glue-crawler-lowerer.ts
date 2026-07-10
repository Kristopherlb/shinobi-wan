import type { Node } from '@shinobi/ir';
import type {
  LoweredResource,
  LoweringContext,
  NodeLowerer,
  ResolvedDeps,
} from '../types';
import { shortName, createStandardTags, makeResourceName } from './utils';

/**
 * Lowers a platform node with platform "aws-glue-crawler" -> Glue Crawler.
 */
export class GlueCrawlerLowerer implements NodeLowerer {
  readonly platform = 'aws-glue-crawler';

  lower(
    node: Node,
    context: LoweringContext,
    _resolvedDeps: ResolvedDeps,
  ): ReadonlyArray<LoweredResource> {
    const name = shortName(node.id);
    const config = node.metadata.properties;
    const extraTags = config['tags'] as Record<string, string> | undefined;
    const tags = createStandardTags(node.id, 'aws-glue-crawler', extraTags);

    const crawlerName = `${name}-crawler`;

    const databaseName = config['databaseName'] as string | undefined;
    const s3Targets = config['s3Targets'] as
      | ReadonlyArray<Record<string, unknown>>
      | undefined;
    const schedule = config['schedule'] as string | undefined;
    const schemaChangePolicy = (config['schemaChangePolicy'] as
      | Record<string, string>
      | undefined) ?? {
      updateBehavior: 'UPDATE_IN_DATABASE',
      deleteBehavior: 'DEPRECATE_IN_DATABASE',
    };
    const recrawlPolicy =
      (config['recrawlPolicy'] as string) ?? 'CRAWL_EVERYTHING';
    const roleArn = config['roleArn'] as string | undefined;
    const tablePrefix = config['tablePrefix'] as string | undefined;

    const properties: Record<string, unknown> = {
      name: makeResourceName(node.id, context.adapterConfig.serviceName),
      databaseName,
      s3Targets,
      schemaChangePolicy,
      recrawlPolicy: { recrawlBehavior: recrawlPolicy },
      tags,
    };

    if (schedule) properties.schedule = schedule;
    if (roleArn) properties.role = roleArn;
    if (tablePrefix) properties.tablePrefix = tablePrefix;

    return [
      {
        name: crawlerName,
        resourceType: 'aws:glue:Crawler',
        properties,
        sourceId: node.id,
        dependsOn: [],
      },
    ];
  }
}
