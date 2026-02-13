import type { Intent } from '@shinobi/contracts';
import type { GraphSnapshot, Node, Edge } from '@shinobi/ir';
import { validateGraph, validateIntent } from '@shinobi/validation';
import type { ValidatorOptions } from '@shinobi/validation';
import type {
  KernelConfig,
  CompilationResult,
  BindingDiagnostic,
  PolicyResult,
} from './types';
import type { IBinder } from './interfaces/binder-interface';
import type { IPolicyEvaluator } from './interfaces/policy-evaluator-interface';
import { CompilationError, PolicyPackError } from './errors';
import { resolveConfig } from './config';
import { deepFreeze } from './freeze';

/**
 * Runs the four-phase compilation pipeline:
 *   1. Snapshot & Validate
 *   2. Bind (edges → intents)
 *   3. Policy evaluation
 *   4. Freeze & Return
 */
export function compilePipeline(
  snapshot: GraphSnapshot,
  config: KernelConfig,
  binders: ReadonlyArray<IBinder>,
  evaluators: ReadonlyArray<IPolicyEvaluator>
): CompilationResult {
  const resolvedConfig = resolveConfig(config);
  const validationOptions: ValidatorOptions = config.validationOptions ?? {
    strict: true,
    level: 'full',
    collectAll: true,
  };

  // Phase 1: Validate
  const validation = validateGraph(snapshot, validationOptions);
  if (!validation.valid) {
    return deepFreeze({
      snapshot,
      intents: [],
      bindingDiagnostics: [],
      validation,
      resolvedConfig,
    });
  }

  // Phase 2: Bind
  const { intents, diagnostics } = bindEdges(snapshot, binders, resolvedConfig);

  // Validate emitted intents
  for (const intent of intents) {
    const intentValidation = validateIntent(intent, validationOptions);
    if (!intentValidation.valid) {
      const details = intentValidation.errors.map((e) => ({
        path: e.path,
        message: e.message,
      }));
      throw new CompilationError('binding', details, 'Binder emitted invalid intent');
    }
  }

  // Phase 3: Policy
  let policy: PolicyResult | undefined;
  if (config.policyPack) {
    policy = evaluatePolicy(
      snapshot,
      intents,
      config.policyPack,
      evaluators,
      resolvedConfig
    );
  }

  // Phase 4: Freeze & Return
  return deepFreeze({
    snapshot,
    intents,
    bindingDiagnostics: diagnostics,
    policy,
    validation,
    resolvedConfig,
  });
}

/**
 * Phase 2: For each edge, find a matching binder and compile.
 * Unbound edges produce a diagnostic rather than failing.
 * Intents are sorted by (type, sourceEdgeId) for determinism.
 */
function bindEdges(
  snapshot: GraphSnapshot,
  binders: ReadonlyArray<IBinder>,
  resolvedConfig: Readonly<Record<string, unknown>>
): { intents: Intent[]; diagnostics: BindingDiagnostic[] } {
  const allIntents: Intent[] = [];
  const allDiagnostics: BindingDiagnostic[] = [];

  // Build a lookup of nodes by ID
  const nodeMap = new Map<string, Node>();
  for (const node of snapshot.nodes) {
    nodeMap.set(node.id, node);
  }

  for (const edge of snapshot.edges) {
    const sourceNode = nodeMap.get(edge.source);
    const targetNode = nodeMap.get(edge.target);

    if (!sourceNode || !targetNode) {
      // Should not happen if validation passed, but be defensive
      allDiagnostics.push({
        path: `$.edges[${edge.id}]`,
        rule: 'referential-integrity',
        message: `Edge references missing node(s): source=${edge.source}, target=${edge.target}`,
        severity: 'error',
      });
      continue;
    }

    const binder = findBinder(binders, edge, sourceNode, targetNode);
    if (!binder) {
      allDiagnostics.push({
        path: `$.edges[${edge.id}]`,
        rule: 'unbound-edge',
        message: `No binder registered for edge type="${edge.type}" source="${sourceNode.type}" target="${targetNode.type}"`,
        severity: 'warning',
      });
      continue;
    }

    const result = binder.compileEdge({
      edge,
      sourceNode,
      targetNode,
      config: resolvedConfig,
    });

    allIntents.push(...result.intents);
    allDiagnostics.push(...result.diagnostics);
  }

  // Sort intents deterministically by (type, sourceEdgeId)
  allIntents.sort((a, b) => {
    const typeCmp = a.type.localeCompare(b.type);
    if (typeCmp !== 0) return typeCmp;
    return a.sourceEdgeId.localeCompare(b.sourceEdgeId);
  });

  return { intents: allIntents, diagnostics: allDiagnostics };
}

/**
 * Find a binder that supports the given edge pattern.
 */
function findBinder(
  binders: ReadonlyArray<IBinder>,
  edge: Edge,
  sourceNode: Node,
  targetNode: Node
): IBinder | undefined {
  return binders.find((b) =>
    b.supportedEdgeTypes.some(
      (pattern) =>
        pattern.edgeType === edge.type &&
        pattern.sourceType === sourceNode.type &&
        pattern.targetType === targetNode.type
    )
  );
}

/**
 * Phase 3: Evaluate policy pack against the graph and intents.
 * Violations are sorted by (severity, ruleId, target.id) for determinism.
 *
 * @throws PolicyPackError if no evaluator supports the requested pack
 */
function evaluatePolicy(
  snapshot: GraphSnapshot,
  intents: ReadonlyArray<Intent>,
  policyPack: string,
  evaluators: ReadonlyArray<IPolicyEvaluator>,
  resolvedConfig: Readonly<Record<string, unknown>>
): PolicyResult {
  const evaluator = evaluators.find((e) =>
    e.supportedPacks.includes(policyPack)
  );

  if (!evaluator) {
    const availablePacks = [
      ...new Set(evaluators.flatMap((e) => [...e.supportedPacks])),
    ].sort();
    throw new PolicyPackError(policyPack, availablePacks);
  }

  const violations = [...evaluator.evaluate({
    snapshot,
    intents,
    policyPack,
    config: resolvedConfig,
  })];

  // Sort violations deterministically
  const severityOrder: Record<string, number> = { error: 0, warning: 1, info: 2 };
  violations.sort((a, b) => {
    const sevCmp = (severityOrder[a.severity] ?? 3) - (severityOrder[b.severity] ?? 3);
    if (sevCmp !== 0) return sevCmp;
    const ruleCmp = a.ruleId.localeCompare(b.ruleId);
    if (ruleCmp !== 0) return ruleCmp;
    return a.target.id.localeCompare(b.target.id);
  });

  return {
    violations,
    compliant: violations.every((v) => v.severity !== 'error'),
    policyPack,
  };
}
