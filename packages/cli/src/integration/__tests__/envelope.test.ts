import { describe, expect, it } from 'vitest';
import { envelopePlanResult, envelopeUpResult, envelopeValidateResult, getOperationPolicy } from '../index';
import type { PlanResult } from '../../commands/plan';
import type { UpResult } from '../../commands/up';
import type { ValidateResult } from '../../commands/validate';

const baseOptions = {
  traceId: 'trace-123',
  toolVersion: '0.1.0',
  contractVersion: '1.0.0',
} as const;

describe('integration envelopes', () => {
  it('builds validate envelope with operation class metadata', () => {
    const validateResult: ValidateResult = {
      success: true,
      errors: [],
      manifest: { service: 'svc', components: 1, bindings: 0 },
    };

    const envelope = envelopeValidateResult(validateResult, {
      ...baseOptions,
      toolId: 'golden.shinobi.validate_plan',
      operationClass: 'plan',
    });

    expect(envelope.success).toBe(true);
    expect(envelope.metadata.operationClass).toBe('plan');
    expect(envelope.metadata.traceId).toBe('trace-123');
    expect(envelope.policy).toEqual(getOperationPolicy('plan'));
  });

  it('builds plan failure envelope with validation code', () => {
    const planResult: PlanResult = {
      success: false,
      validation: {
        success: false,
        errors: [{ path: 'manifest', message: 'bad' }],
      },
      errors: [{ path: 'manifest', message: 'bad' }],
    };

    const envelope = envelopePlanResult(planResult, {
      ...baseOptions,
      toolId: 'golden.shinobi.plan_change',
      operationClass: 'plan',
    });

    expect(envelope.success).toBe(false);
    expect(envelope.error?.code).toBe('INPUT_VALIDATION_FAILED');
    expect(envelope.error?.traceId).toBe('trace-123');
  });

  it('requires retriable_reason when retriable deploy error exists', () => {
    const upResult: UpResult = {
      success: false,
      deployed: false,
      message: 'Deployment failed: timeout',
      plan: {
        success: true,
        validation: {
          success: true,
          errors: [],
        },
        errors: [],
      },
      deployResult: {
        success: false,
        stackName: 'stack',
        outputs: {},
        summary: {},
        error: 'Operation timed out',
        errorDetail: {
          code: 'UPSTREAM_TIMEOUT',
          category: 'timeout',
          source: 'adapter-aws.deployer',
          message: 'Operation timed out',
          retryable: true,
          retriableReason: 'upstream_timeout',
        },
      },
    };

    const envelope = envelopeUpResult(upResult, {
      ...baseOptions,
      toolId: 'golden.shinobi.apply_change',
      operationClass: 'apply',
    });

    expect(envelope.success).toBe(false);
    expect(envelope.error?.retriable).toBe(true);
    expect(envelope.error?.retriableReason).toBe('upstream_timeout');
  });

  it('always emits operationClass metadata', () => {
    const validateResult: ValidateResult = {
      success: true,
      errors: [],
      manifest: { service: 'svc', components: 1, bindings: 0 },
    };
    const envelope = envelopeValidateResult(validateResult, {
      ...baseOptions,
      toolId: 'golden.shinobi.validate_plan',
      operationClass: 'plan',
    });
    expect(envelope.metadata.operationClass).toBe('plan');
  });
});
