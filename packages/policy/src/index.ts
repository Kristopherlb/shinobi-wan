/**
 * @shinobi/policy - Policy Evaluation Engine for Shinobi V3
 *
 * Policy evaluators inspect intents against rule catalogs with
 * severity driven by pack selection (Baseline / FedRAMP-Moderate / FedRAMP-High).
 */

// Evaluators
export { BaselinePolicyEvaluator } from './evaluators';

// Violation factory
export { createViolation } from './violation-factory';
export type { CreateViolationOptions } from './violation-factory';

// Rule catalog
export { RULE_CATALOG, getRuleById } from './rules';
export type { PolicyRule } from './rules';

// Severity map
export { SEVERITY_MAP, SUPPORTED_PACKS, getSeverity } from './severity-map';
export type { SupportedPack } from './severity-map';
