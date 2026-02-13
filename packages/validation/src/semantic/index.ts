// Reference validation
export {
  validateReferences,
  validateEdgeReferences,
  validateArtifactReferences,
} from './reference-validator';

// Forbidden patterns
export {
  detectBackendHandles,
  detectPackBranching,
  BACKEND_HANDLE_PATTERNS,
} from './forbidden-patterns';

// Least privilege
export {
  validateLeastPrivilege,
  detectWildcardResources,
  WILDCARD_PATTERNS,
} from './least-privilege';

// Capability compatibility
export {
  validateCapabilityCompatibility,
  checkActionCompatibility,
} from './capability-validator';
