import type { OperationClass, OperationPolicy } from './types';

const POLICIES: Record<OperationClass, OperationPolicy> = {
  read: {
    operationClass: 'read',
    defaultTimeoutMs: 5_000,
    maxTimeoutMs: 15_000,
    retryPolicy: {
      maxAttempts: 2,
      initialIntervalSeconds: 1,
      backoffCoefficient: 2,
    },
    idempotency: 'recommended',
    mode: 'await',
  },
  plan: {
    operationClass: 'plan',
    defaultTimeoutMs: 10_000,
    maxTimeoutMs: 30_000,
    retryPolicy: {
      maxAttempts: 2,
      initialIntervalSeconds: 2,
      backoffCoefficient: 2,
    },
    idempotency: 'required',
    mode: 'await',
  },
  apply: {
    operationClass: 'apply',
    defaultTimeoutMs: 30_000,
    maxTimeoutMs: 120_000,
    retryPolicy: {
      maxAttempts: 1,
      initialIntervalSeconds: 1,
      backoffCoefficient: 1,
    },
    idempotency: 'required',
    mode: 'start',
  },
};

export function getOperationPolicy(operationClass: OperationClass): OperationPolicy {
  return POLICIES[operationClass];
}
