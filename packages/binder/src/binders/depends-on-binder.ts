import type {
  IBinder,
  SupportedEdgePattern,
  BindingContext,
  BinderOutput,
} from '@shinobi/kernel';

/**
 * DependsOnBinder recognizes `dependsOn` ordering edges between any node
 * types. Ordering is structural: the adapter derives resource dependency
 * ordering from the graph itself, so this binder deliberately emits no
 * intents — its purpose is to make `dependsOn` an explicitly supported
 * pattern (with an explainable info diagnostic) instead of an unbound-edge
 * warning that suggests the relationship was ignored by mistake.
 */
export class DependsOnBinder implements IBinder {
  readonly id = 'depends-on-binder';

  readonly supportedEdgeTypes: ReadonlyArray<SupportedEdgePattern> = [
    { edgeType: 'dependsOn', sourceType: 'component', targetType: 'component' },
    { edgeType: 'dependsOn', sourceType: 'component', targetType: 'platform' },
    { edgeType: 'dependsOn', sourceType: 'platform', targetType: 'component' },
    { edgeType: 'dependsOn', sourceType: 'platform', targetType: 'platform' },
  ];

  compileEdge(context: BindingContext): BinderOutput {
    const { edge } = context;
    return {
      intents: [],
      diagnostics: [
        {
          path: `$.edges[${edge.id}]`,
          rule: 'depends-on-ordering',
          message: `dependsOn edge "${edge.id}" declares deployment ordering only; it grants no permissions, network access, or configuration.`,
          severity: 'info',
        },
      ],
    };
  }
}
