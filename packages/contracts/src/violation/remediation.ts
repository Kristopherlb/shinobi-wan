/**
 * Remediation guidance for a policy violation.
 */
export interface RemediationHint {
  /** Short actionable description */
  readonly summary: string;

  /** Detailed steps (optional) */
  readonly steps?: ReadonlyArray<string>;

  /** Link to documentation (optional) */
  readonly documentationUrl?: string;

  /** Can this be auto-fixed? */
  readonly autoFixable: boolean;
}
