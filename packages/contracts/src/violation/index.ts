// Violation contract exports
export {
  SEVERITY_LEVELS,
  type Severity,
} from './severity';

export {
  type RemediationHint,
} from './remediation';

export {
  type Violation,
  type ViolationTarget,
  createViolationId,
  isValidViolationId,
} from './violation';
