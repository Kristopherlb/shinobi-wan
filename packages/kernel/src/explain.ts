import type { CompilationResult } from './types';

/**
 * A single "why" entry: what exists, why it exists, and where it came from
 * (KL-006 ExplainableDiagnostics + the Explainability standard).
 */
export interface WhyEntry {
  /** What is being explained */
  readonly kind: 'intent' | 'violation' | 'binding-diagnostic';
  /** Stable identifier of the explained subject */
  readonly subject: string;
  /** Human-readable causal explanation */
  readonly because: string;
  /** Machine-usable origin pointers */
  readonly origin: {
    readonly edgeId?: string;
    readonly sourceNodeId?: string;
    readonly targetNodeId?: string;
    readonly ruleId?: string;
    readonly targetId?: string;
  };
  /** Suggested next step, when one exists */
  readonly remediation?: string;
}

export interface WhyReport {
  readonly entries: ReadonlyArray<WhyEntry>;
}

/**
 * Produces a deterministic why/provenance report for a compilation:
 * every intent traces back to the edge (and node pair) that produced it,
 * every policy violation carries its rule rationale and remediation, and
 * suppressed violations name the exception that suppressed them.
 *
 * Pure function of the CompilationResult — no clock, no environment.
 */
export function explainCompilation(result: CompilationResult): WhyReport {
  const entries: WhyEntry[] = [];

  const edges = new Map(result.snapshot.edges.map((e) => [e.id, e]));

  for (const intent of result.intents) {
    const edge = edges.get(intent.sourceEdgeId);
    entries.push({
      kind: 'intent',
      subject: `${intent.type}:${intent.sourceEdgeId}`,
      because: edge
        ? `The manifest declares a "${edge.type}" relationship from "${edge.source}" to "${edge.target}"; the registered binder for that edge pattern derives a ${intent.type} intent from it.`
        : `Derived from edge "${intent.sourceEdgeId}" (edge not present in snapshot).`,
      origin: {
        edgeId: intent.sourceEdgeId,
        ...(edge
          ? { sourceNodeId: edge.source, targetNodeId: edge.target }
          : {}),
      },
    });
  }

  for (const d of result.bindingDiagnostics) {
    entries.push({
      kind: 'binding-diagnostic',
      subject: `${d.rule}:${d.path}`,
      because: d.message,
      origin: {},
      ...(d.rule === 'unbound-edge'
        ? {
            remediation:
              'Register a binder supporting this edge pattern, or remove the relationship from the manifest.',
          }
        : {}),
    });
  }

  for (const v of result.policy?.violations ?? []) {
    const suppressedNote = v.suppressed
      ? ` Enforcement is suppressed by a declared exception (expires ${v.exception?.expires}): ${v.exception?.justification}.`
      : '';
    entries.push({
      kind: 'violation',
      subject: v.id,
      because: `Policy pack "${v.policyPack}" evaluates rule "${v.ruleName}" (${v.ruleId}) against ${v.target.type} "${v.target.id}": ${v.message}${suppressedNote}`,
      origin: { ruleId: v.ruleId, targetId: v.target.id },
      remediation: v.remediation.summary,
    });
  }

  // Deterministic ordering: kind, then subject
  entries.sort((a, b) => {
    const kindCmp = a.kind.localeCompare(b.kind);
    if (kindCmp !== 0) return kindCmp;
    return a.subject.localeCompare(b.subject);
  });

  return { entries };
}
