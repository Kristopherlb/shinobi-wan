import type { CompilationResult } from '@shinobi/kernel';

/**
 * A single golden test case definition.
 * Each golden case documents which conformance gates it covers.
 */
export interface GoldenCase {
  /** Stable case ID, e.g. 'golden:baseline:clean-graph' */
  readonly id: string;
  /** Human-readable description */
  readonly description: string;
  /** Gate IDs covered, e.g. ['G-001', 'G-002'] */
  readonly gates: ReadonlyArray<string>;
}

/**
 * A triad matrix cell: one (scenario × policyPack) combination.
 */
export interface TriadCell {
  /** Scenario name, e.g. 'admin-wildcard', 'clean-read' */
  readonly scenario: string;
  /** Policy pack name, e.g. 'Baseline', 'FedRAMP-High' */
  readonly policyPack: string;
}

/**
 * Result from running a golden case through the compilation pipeline.
 */
export interface GoldenResult {
  /** The full compilation result */
  readonly compilation: CompilationResult;
  /** JSON.stringify of the compilation result for snapshot comparison */
  readonly serialized: string;
}
