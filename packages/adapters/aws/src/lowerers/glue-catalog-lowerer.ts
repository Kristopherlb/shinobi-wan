import type { Node } from '@shinobi/ir';
import type { LoweredResource, LoweringContext, NodeLowerer, ResolvedDeps } from '../types';
import { shortName, createStandardTags, makeResourceName } from './utils';

interface GlueTableConfig {
  readonly name: string;
  readonly columns: ReadonlyArray<{ name: string; type: string }>;
  readonly inputFormat?: string;
  readonly outputFormat?: string;
  readonly serializationLibrary?: string;
  readonly location?: string;
}

/**
 * Lowers a platform node with platform "aws-glue-catalog" ->
 * Glue Catalog Database + N Catalog Tables.
 */
export class GlueCatalogLowerer implements NodeLowerer {
  readonly platform = 'aws-glue-catalog';

  lower(node: Node, context: LoweringContext, _resolvedDeps: ResolvedDeps): ReadonlyArray<LoweredResource> {
    const name = shortName(node.id);
    const config = node.metadata.properties;
    const extraTags = config['tags'] as Record<string, string> | undefined;
    const tags = createStandardTags(node.id, 'aws-glue-catalog', extraTags);

    const dbName = `${name}-database`;
    const databaseName = (config['databaseName'] as string) ?? makeResourceName(node.id, context.adapterConfig.serviceName);
    const description = (config['description'] as string) ?? '';
    const locationUri = config['locationUri'] as string | undefined;

    const resources: LoweredResource[] = [];

    const dbProperties: Record<string, unknown> = {
      catalogId: undefined,
      databaseInput: {
        name: databaseName,
        description,
        ...(locationUri ? { locationUri } : {}),
      },
      tags,
    };

    resources.push({
      name: dbName,
      resourceType: 'aws:glue:CatalogDatabase',
      properties: dbProperties,
      sourceId: node.id,
      dependsOn: [],
    });

    const tables = Array.isArray(config['tables']) ? (config['tables'] as GlueTableConfig[]) : [];

    for (let i = 0; i < tables.length; i++) {
      const table = tables[i];
      const tableName = `${name}-table-${i}`;

      const storageDescriptor: Record<string, unknown> = {
        columns: table.columns,
      };

      if (table.inputFormat) storageDescriptor.inputFormat = table.inputFormat;
      if (table.outputFormat) storageDescriptor.outputFormat = table.outputFormat;
      if (table.serializationLibrary) {
        storageDescriptor.serDeInfo = { serializationLibrary: table.serializationLibrary };
      }
      if (table.location) storageDescriptor.location = table.location;

      resources.push({
        name: tableName,
        resourceType: 'aws:glue:CatalogTable',
        properties: {
          databaseName: { ref: `${dbName}.name` },
          name: table.name,
          tableInput: {
            name: table.name,
            storageDescriptor,
          },
          tags,
        },
        sourceId: node.id,
        dependsOn: [dbName],
      });
    }

    return resources;
  }
}
