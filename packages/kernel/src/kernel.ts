/* eslint-disable @typescript-eslint/triple-slash-reference -- shim needed for dts when @shinobi/validation has no .d.ts */
/// <reference path="./validation-shim.d.ts" />
import type { Node, Edge, DerivedArtifact, GraphSnapshot, GraphMutation, MutationResult } from '@shinobi/ir';
import { Graph } from '@shinobi/ir';
import { validateGraph } from '@shinobi/validation';
import type { ValidationResult } from '@shinobi/validation';
import type { KernelConfig, CompilationResult } from './types';
import type { IBinder } from './interfaces/binder-interface';
import type { IPolicyEvaluator } from './interfaces/policy-evaluator-interface';
import { compilePipeline } from './compilation-pipeline';
import { resolveConfig } from './config';
import { deepFreeze } from './freeze';

/**
 * Options for constructing a Kernel instance.
 */
export interface KernelOptions {
  /** Kernel configuration (KL-007) */
  readonly config?: KernelConfig;

  /** Binder implementations for edge compilation */
  readonly binders?: ReadonlyArray<IBinder>;

  /** Policy evaluator implementations */
  readonly evaluators?: ReadonlyArray<IPolicyEvaluator>;
}

/**
 * Kernel is the main orchestrator for the Shinobi graph engine.
 *
 * It wraps a Graph instance (composition, not inheritance) and integrates
 * validation, binding, and policy evaluation through the compilation pipeline.
 *
 * Key design decisions:
 * - Binders and evaluators are injected at construction (DI)
 * - Config is injected, never read from process.env (KL-007)
 * - Policy pack must be explicit or absent (KL-008)
 * - Validation runs during snapshot()/compile(), not per-mutation
 */
export class Kernel {
  private readonly graph: Graph;
  private readonly config: KernelConfig;
  private readonly binders: ReadonlyArray<IBinder>;
  private readonly evaluators: ReadonlyArray<IPolicyEvaluator>;

  constructor(options?: KernelOptions) {
    this.graph = new Graph();
    this.config = options?.config ?? {};
    this.binders = options?.binders ?? [];
    this.evaluators = options?.evaluators ?? [];
  }

  /**
   * Apply a batch of mutations to the graph.
   * Delegates directly to Graph.applyMutation().
   */
  applyMutation(mutations: ReadonlyArray<GraphMutation>): MutationResult {
    return this.graph.applyMutation(mutations);
  }

  /**
   * Take a validated, frozen snapshot of the current graph state.
   * Runs validation but not binding or policy evaluation.
   */
  snapshot(): Readonly<GraphSnapshot> {
    const snap = this.graph.toSnapshot();
    return deepFreeze(snap);
  }

  /**
   * Validate the current graph state.
   */
  validate(): ValidationResult {
    const snap = this.graph.toSnapshot();
    return validateGraph(snap, this.config.validationOptions);
  }

  /**
   * Run the full compilation pipeline: validate → bind → policy → freeze.
   */
  compile(): CompilationResult {
    const snap = this.graph.toSnapshot();
    return compilePipeline(snap, this.config, this.binders, this.evaluators);
  }

  /**
   * Get the resolved (merged + interpolated) configuration.
   */
  getResolvedConfig(): Readonly<Record<string, unknown>> {
    return resolveConfig(this.config);
  }

  // --- Query pass-through ---

  getNode(id: string): Node | undefined {
    return this.graph.getNode(id);
  }

  getEdge(id: string): Edge | undefined {
    return this.graph.getEdge(id);
  }

  getArtifact(id: string): DerivedArtifact | undefined {
    return this.graph.getArtifact(id);
  }

  hasNode(id: string): boolean {
    return this.graph.hasNode(id);
  }

  hasEdge(id: string): boolean {
    return this.graph.hasEdge(id);
  }

  hasArtifact(id: string): boolean {
    return this.graph.hasArtifact(id);
  }
}
