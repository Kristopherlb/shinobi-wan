/**
 * Extracts a short name from a kernel node ID.
 * e.g., "component:api-handler" → "api-handler"
 */
export function shortName(nodeRef: string): string {
  const idx = nodeRef.indexOf(":");
  return idx >= 0 ? nodeRef.substring(idx + 1) : nodeRef;
}

/**
 * Creates standard Shinobi resource tags for lowered resources.
 * Centralizes tagging policy — all lowerers should use this.
 */
export function createStandardTags(
  nodeId: string,
  platform: string,
  extraTags?: Record<string, string>,
): Record<string, string> {
  return {
    "shinobi:node": nodeId,
    "shinobi:platform": platform,
    ...extraTags,
  };
}

/**
 * Creates a fully-qualified resource name from a node ID and service name.
 * e.g., ("component:handler", "my-svc") → "my-svc-handler"
 * e.g., ("component:handler", "my-svc", "dlq") → "my-svc-handler-dlq"
 */
export function makeResourceName(
  nodeId: string,
  serviceName: string,
  suffix?: string,
): string {
  const base = `${serviceName}-${shortName(nodeId)}`;
  return suffix ? `${base}-${suffix}` : base;
}
