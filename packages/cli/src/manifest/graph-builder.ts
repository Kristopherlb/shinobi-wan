import type { GraphMutation, NodeType, EdgeType } from '@shinobi/ir';
import { createTestNode, createTestEdge } from '@shinobi/ir';
import type { ServiceManifest, ManifestComponent, ManifestBinding } from './types';

/**
 * Converts a validated ServiceManifest into a sequence of GraphMutations.
 *
 * Each component → addNode mutation
 * Each binding → addEdge mutation with bindingConfig metadata
 *
 * Node IDs use the format: {type}:{componentId}
 * Edge IDs use the format: edge:{type}:{sourceNodeId}:{targetNodeId}
 */
export function manifestToMutations(manifest: ServiceManifest): ReadonlyArray<GraphMutation> {
  const mutations: GraphMutation[] = [];

  // Phase 1: Create nodes from components
  for (const component of manifest.components) {
    mutations.push({
      type: 'addNode',
      node: componentToNode(component),
    });
  }

  // Phase 2: Create edges from bindings
  for (const binding of manifest.bindings) {
    const sourceComponent = manifest.components.find((c) => c.id === binding.source);
    const targetComponent = manifest.components.find((c) => c.id === binding.target);

    if (!sourceComponent || !targetComponent) {
      // This should never happen if the manifest was validated, but guard anyway
      continue;
    }

    mutations.push({
      type: 'addEdge',
      edge: bindingToEdge(binding, sourceComponent, targetComponent),
    });
  }

  return mutations;
}

function componentToNode(component: ManifestComponent) {
  const nodeType = component.type as NodeType;
  const nodeId = `${nodeType}:${component.id}`;

  return createTestNode({
    id: nodeId,
    type: nodeType,
    provenance: { sourceFile: 'manifest.yaml' },
    metadata: {
      properties: {
        platform: component.platform,
        ...(component.config ?? {}),
      },
    },
  });
}

function bindingToEdge(
  binding: ManifestBinding,
  sourceComponent: ManifestComponent,
  targetComponent: ManifestComponent,
) {
  const sourceNodeId = `${sourceComponent.type}:${sourceComponent.id}`;
  const targetNodeId = `${targetComponent.type}:${targetComponent.id}`;
  const edgeType = binding.type as EdgeType;
  const edgeId = `edge:${edgeType}:${sourceNodeId}:${targetNodeId}`;

  return createTestEdge({
    id: edgeId,
    type: edgeType,
    source: sourceNodeId,
    target: targetNodeId,
    provenance: { sourceFile: 'manifest.yaml' },
    metadata: {
      bindingConfig: binding.config as unknown as Record<string, unknown>,
    },
  });
}
