/**
 * @shinobi/conformance - Golden Test & Triad Matrix Framework
 *
 * Validates the full Kernel + Binder + Policy pipeline end-to-end
 * through golden tests with zero regression tolerance.
 */

// Types
export type { GoldenCase, TriadCell, GoldenResult } from './types';

// Golden runner
export { runGoldenCase } from './golden-runner';
export type { RunGoldenCaseOptions } from './golden-runner';
