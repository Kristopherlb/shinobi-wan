/**
 * Extracts a short name from a kernel node ID.
 * e.g., "component:api-handler" → "api-handler"
 */
export function shortName(nodeRef: string): string {
  const idx = nodeRef.indexOf(':');
  return idx >= 0 ? nodeRef.substring(idx + 1) : nodeRef;
}
