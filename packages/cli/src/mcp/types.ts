import type {
  AsyncOperationHandle,
  ToolResponseEnvelope,
} from '../integration';

export type HarmonyToolId =
  | 'golden.shinobi.validate_plan'
  | 'golden.shinobi.plan_change'
  | 'golden.shinobi.apply_change'
  | 'golden.shinobi.rollback_change'
  | 'golden.shinobi.read_entities'
  | 'golden.shinobi.read_activity';

export interface HarmonyToolCallRequest<TInput = Record<string, unknown>> {
  readonly toolId: HarmonyToolId;
  readonly traceId: string;
  readonly input: TInput;
}

export interface ValidatePlanInput {
  readonly manifestPath: string;
  readonly policyPack?: string;
}

export interface PlanChangeInput extends ValidatePlanInput {
  readonly region?: string;
  readonly codePath?: string;
}

export interface ApplyApprovalEvidence {
  readonly approvalId: string;
  readonly approverRole: string;
  readonly approverId: string;
  readonly decision: 'approved';
  readonly decidedAt: string;
  readonly slaMinutes: number;
}

export interface ApplyChangeInput extends PlanChangeInput {
  readonly planFingerprint: string;
  readonly idempotencyKey: string;
  readonly mode?: 'start' | 'await';
  readonly approval?: ApplyApprovalEvidence;
}

export interface ReadInput {
  readonly manifestPath: string;
  readonly policyPack?: string;
}

export interface HarmonyToolCallResult<TData = unknown> {
  readonly envelope: ToolResponseEnvelope<TData>;
  readonly handle?: AsyncOperationHandle;
}
