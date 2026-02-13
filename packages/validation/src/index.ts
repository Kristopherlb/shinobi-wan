/**
 * @shinobi/validation - Validation Pipeline for Shinobi V3
 *
 * This package provides schema, semantic, and determinism validation
 * with structured, stable error output (KL-006 compliant).
 *
 * Pipeline: schema → semantic → determinism
 */

// Error types and utilities
export type { ValidationError, ValidationResult, ValidatorOptions } from './errors';
export { createError, createResult, sortErrors, SEVERITY_ORDER } from './errors';

// Orchestrator (main entry points)
export {
  validateGraph,
  validateCapabilityContract,
  validateIntent,
  validateViolation,
} from './orchestrator';

// Schema validators
export {
  // Field validators
  hasRequiredField,
  hasRequiredFields,
  rejectUnknownFields,
  validateEnumField,
  validateStringField,
  type RequiredFieldDef,
  // Graph validators
  validateNodeSchema,
  validateEdgeSchema,
  validateArtifactSchema,
  validateSnapshotSchema,
  // Contract validators
  validateCapabilityIdFormat,
  validateCapabilityContractSchema,
  validateIntentSchema,
  validateViolationSchema,
} from './schema';

// Semantic validators
export {
  // Reference validation
  validateReferences,
  validateEdgeReferences,
  validateArtifactReferences,
  // Forbidden patterns
  detectBackendHandles,
  detectPackBranching,
  BACKEND_HANDLE_PATTERNS,
  // Least privilege
  validateLeastPrivilege,
  detectWildcardResources,
  WILDCARD_PATTERNS,
  // Capability compatibility
  validateCapabilityCompatibility,
  checkActionCompatibility,
} from './semantic';

// Determinism validators
export {
  // Ordering validation
  validateCanonicalOrdering,
  isCanonicallyOrdered,
  // Hash validation
  validateSemanticHash,
  validateSnapshotHashes,
  // Stable ID validation
  validateStableNodeId,
  validateStableEdgeId,
  validateStableArtifactId,
  validateSnapshotIds,
} from './determinism';
