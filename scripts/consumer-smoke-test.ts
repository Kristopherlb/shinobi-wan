/**
 * Consumer smoke test: imports from @shinobi/kernel (package boundary), runs
 * validatePlan and planChange against a fixture, asserts envelope structure and
 * deterministic keys. Run after build: pnpm build && pnpm smoke:consumer
 */
import {
  contractVersion,
  validatePlan,
  planChange,
  type ToolResponseEnvelope,
} from '@shinobi/kernel';

const TRACE_ID = 'consumer-smoke';
const FIXTURE = { nodes: [], edges: [], artifacts: [] };

function assert(condition: boolean, message: string): void {
  if (!condition) {
    console.error('Assertion failed:', message);
    process.exit(1);
  }
}

async function main(): Promise<void> {
  assert(typeof contractVersion === 'string' && contractVersion.length > 0, 'contractVersion is non-empty string');

  const validateResult = await validatePlan({
    mode: 'plan',
    snapshot: FIXTURE,
    traceId: TRACE_ID,
  });

  assert(validateResult != null, 'validatePlan returns envelope');
  assert(typeof validateResult.success === 'boolean', 'envelope has success');
  assert(validateResult.metadata != null, 'envelope has metadata');
  assert(validateResult.metadata.contractVersion === contractVersion, 'metadata.contractVersion matches export');
  assert(validateResult.metadata.operationClass === 'plan', 'metadata.operationClass is plan');
  assert(validateResult.metadata.traceId === TRACE_ID, 'metadata.traceId matches input');
  assert(typeof validateResult.metadata.timestamp === 'string', 'metadata.timestamp is string');

  const roundTrip = JSON.parse(JSON.stringify(validateResult)) as ToolResponseEnvelope;
  assert(roundTrip.metadata.contractVersion === contractVersion, 'envelope is JSON-serializable and deterministic');

  const planResult = await planChange({
    mode: 'plan',
    snapshot: FIXTURE,
    traceId: TRACE_ID,
  });

  assert(planResult != null, 'planChange returns envelope');
  assert(planResult.metadata.operationClass === 'plan', 'planChange envelope has operationClass plan');
  assert(planResult.metadata.contractVersion === contractVersion, 'planChange envelope has contractVersion');

  console.log('Consumer smoke: validatePlan and planChange envelopes OK');
  process.exit(0);
}

main().catch((err) => {
  console.error('Consumer smoke failed:', err);
  process.exit(1);
});
