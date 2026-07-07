/**
 * Deployer error classification. Kept free of Pulumi imports so that
 * error types and classifyError can be used without loading provider SDKs.
 */

// ── Error classification ────────────────────────────────────────────────────

export type DeployerErrorCategory =
  | 'pulumi-runtime'
  | 'aws-credentials'
  | 'stack-conflict'
  | 'timeout'
  | 'unknown';

export interface DeployerError {
  readonly code:
    | 'AUTH_FAILURE'
    | 'CONFLICT'
    | 'RATE_LIMIT'
    | 'UPSTREAM_TIMEOUT'
    | 'RUNNER_ERROR'
    | 'UPSTREAM_UNAVAILABLE';
  readonly category: DeployerErrorCategory;
  readonly source: 'adapter-aws.deployer';
  readonly message: string;
  readonly originalError?: Error;
  readonly retryable: boolean;
  readonly retriableReason?:
    | 'rate_limit'
    | 'upstream_timeout'
    | 'upstream_5xx'
    | 'transport_unavailable'
    | 'worker_unavailable'
    | 'dependency_unavailable';
}

export function classifyError(err: unknown): DeployerError {
  const message = err instanceof Error ? err.message : String(err);
  const originalError = err instanceof Error ? err : undefined;

  if (
    /NoCredentialProviders|ExpiredToken|InvalidClientTokenId|security token/i.test(
      message,
    )
  ) {
    return {
      code: 'AUTH_FAILURE',
      category: 'aws-credentials',
      source: 'adapter-aws.deployer',
      message,
      originalError,
      retryable: false,
    };
  }

  if (/conflict|already being updated|UPDATE_IN_PROGRESS/i.test(message)) {
    return {
      code: 'CONFLICT',
      category: 'stack-conflict',
      source: 'adapter-aws.deployer',
      message,
      originalError,
      retryable: false,
    };
  }

  if (/timed? ?out/i.test(message)) {
    return {
      code: 'UPSTREAM_TIMEOUT',
      category: 'timeout',
      source: 'adapter-aws.deployer',
      message,
      originalError,
      retryable: true,
      retriableReason: 'upstream_timeout',
    };
  }

  if (/rate.?limit|too many requests|429/i.test(message)) {
    return {
      code: 'RATE_LIMIT',
      category: 'unknown',
      source: 'adapter-aws.deployer',
      message,
      originalError,
      retryable: true,
      retriableReason: 'rate_limit',
    };
  }

  if (/pulumi|failed to load plugin|no Pulumi project/i.test(message)) {
    return {
      code: 'RUNNER_ERROR',
      category: 'pulumi-runtime',
      source: 'adapter-aws.deployer',
      message,
      originalError,
      retryable: false,
    };
  }

  return {
    code: 'UPSTREAM_UNAVAILABLE',
    category: 'unknown',
    source: 'adapter-aws.deployer',
    message,
    originalError,
    retryable: true,
    retriableReason: 'dependency_unavailable',
  };
}
