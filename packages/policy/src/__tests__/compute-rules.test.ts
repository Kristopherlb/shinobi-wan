import { describe, it, expect } from 'vitest';
import { BaselinePolicyEvaluator } from '../evaluators/baseline-policy-evaluator';
import type { PolicyEvaluationContext } from '@shinobi/kernel';
import { makeNode, makeSnapshot } from './test-helpers';

const evaluator = new BaselinePolicyEvaluator();

function makeComputeContext(
  nodes: Parameters<typeof makeSnapshot>[0],
  policyPack: string,
): PolicyEvaluationContext {
  return {
    snapshot: makeSnapshot(nodes, []),
    intents: [],
    policyPack,
    config: {},
  };
}

describe('sqs-dlq-missing', () => {
  it('fires when SQS queue lacks deadLetterQueue config', () => {
    const ctx = makeComputeContext(
      [makeNode({ id: 'platform:work-queue', type: 'platform', metadata: { properties: { platform: 'aws-sqs' } } })],
      'Baseline',
    );
    const violations = evaluator.evaluate(ctx);
    const dlqViolations = violations.filter((v) => v.ruleId === 'sqs-dlq-missing');
    expect(dlqViolations).toHaveLength(1);
    expect(dlqViolations[0].target.type).toBe('node');
    expect(dlqViolations[0].target.id).toBe('platform:work-queue');
  });

  it('does not fire when deadLetterQueue is true', () => {
    const ctx = makeComputeContext(
      [makeNode({ id: 'platform:q', type: 'platform', metadata: { properties: { platform: 'aws-sqs', deadLetterQueue: true } } })],
      'Baseline',
    );
    const violations = evaluator.evaluate(ctx);
    expect(violations.filter((v) => v.ruleId === 'sqs-dlq-missing')).toHaveLength(0);
  });

  it('severity escalates across packs', () => {
    const node = makeNode({ id: 'platform:q', type: 'platform', metadata: { properties: { platform: 'aws-sqs' } } });

    const baseline = evaluator.evaluate(makeComputeContext([node], 'Baseline'));
    const moderate = evaluator.evaluate(makeComputeContext([node], 'FedRAMP-Moderate'));
    const high = evaluator.evaluate(makeComputeContext([node], 'FedRAMP-High'));

    expect(baseline.find((v) => v.ruleId === 'sqs-dlq-missing')?.severity).toBe('info');
    expect(moderate.find((v) => v.ruleId === 'sqs-dlq-missing')?.severity).toBe('warning');
    expect(high.find((v) => v.ruleId === 'sqs-dlq-missing')?.severity).toBe('error');
  });
});

describe('lambda-timeout-excessive', () => {
  it('fires when Lambda timeout exceeds 900s', () => {
    const ctx = makeComputeContext(
      [makeNode({ id: 'component:slow', type: 'component', metadata: { properties: { platform: 'aws-lambda', timeout: 1200 } } })],
      'Baseline',
    );
    const violations = evaluator.evaluate(ctx);
    const timeoutViolations = violations.filter((v) => v.ruleId === 'lambda-timeout-excessive');
    expect(timeoutViolations).toHaveLength(1);
    expect(timeoutViolations[0].message).toContain('1200s');
  });

  it('does not fire when timeout is exactly 900s', () => {
    const ctx = makeComputeContext(
      [makeNode({ id: 'component:ok', type: 'component', metadata: { properties: { platform: 'aws-lambda', timeout: 900 } } })],
      'Baseline',
    );
    const violations = evaluator.evaluate(ctx);
    expect(violations.filter((v) => v.ruleId === 'lambda-timeout-excessive')).toHaveLength(0);
  });

  it('does not fire when timeout is not set', () => {
    const ctx = makeComputeContext(
      [makeNode({ id: 'component:handler', type: 'component', metadata: { properties: { platform: 'aws-lambda' } } })],
      'Baseline',
    );
    const violations = evaluator.evaluate(ctx);
    expect(violations.filter((v) => v.ruleId === 'lambda-timeout-excessive')).toHaveLength(0);
  });

  it('severity escalates across packs', () => {
    const node = makeNode({ id: 'component:slow', type: 'component', metadata: { properties: { platform: 'aws-lambda', timeout: 1200 } } });

    const baseline = evaluator.evaluate(makeComputeContext([node], 'Baseline'));
    const high = evaluator.evaluate(makeComputeContext([node], 'FedRAMP-High'));

    expect(baseline.find((v) => v.ruleId === 'lambda-timeout-excessive')?.severity).toBe('warning');
    expect(high.find((v) => v.ruleId === 'lambda-timeout-excessive')?.severity).toBe('error');
  });
});

describe('telemetry-tracing-disabled', () => {
  it('fires when Lambda lacks tracing config', () => {
    const ctx = makeComputeContext(
      [makeNode({ id: 'component:handler', type: 'component', metadata: { properties: { platform: 'aws-lambda' } } })],
      'Baseline',
    );
    const violations = evaluator.evaluate(ctx);
    const tracingViolations = violations.filter((v) => v.ruleId === 'telemetry-tracing-disabled');
    expect(tracingViolations).toHaveLength(1);
    expect(tracingViolations[0].target.id).toBe('component:handler');
  });

  it('does not fire when tracing is true', () => {
    const ctx = makeComputeContext(
      [makeNode({ id: 'component:handler', type: 'component', metadata: { properties: { platform: 'aws-lambda', tracing: true } } })],
      'Baseline',
    );
    const violations = evaluator.evaluate(ctx);
    expect(violations.filter((v) => v.ruleId === 'telemetry-tracing-disabled')).toHaveLength(0);
  });

  it('severity escalates across packs', () => {
    const node = makeNode({ id: 'component:handler', type: 'component', metadata: { properties: { platform: 'aws-lambda' } } });

    const baseline = evaluator.evaluate(makeComputeContext([node], 'Baseline'));
    const moderate = evaluator.evaluate(makeComputeContext([node], 'FedRAMP-Moderate'));
    const high = evaluator.evaluate(makeComputeContext([node], 'FedRAMP-High'));

    expect(baseline.find((v) => v.ruleId === 'telemetry-tracing-disabled')?.severity).toBe('info');
    expect(moderate.find((v) => v.ruleId === 'telemetry-tracing-disabled')?.severity).toBe('warning');
    expect(high.find((v) => v.ruleId === 'telemetry-tracing-disabled')?.severity).toBe('error');
  });

  it('does not fire for non-Lambda platforms', () => {
    const ctx = makeComputeContext(
      [makeNode({ id: 'platform:queue', type: 'platform', metadata: { properties: { platform: 'aws-sqs' } } })],
      'Baseline',
    );
    const violations = evaluator.evaluate(ctx);
    expect(violations.filter((v) => v.ruleId === 'telemetry-tracing-disabled')).toHaveLength(0);
  });
});

describe('cloudfront-ssl-protocol-weak', () => {
  it('fires when CloudFront uses weak SSL protocol', () => {
    const ctx = makeComputeContext(
      [makeNode({ id: 'platform:cdn', type: 'platform', metadata: { properties: { platform: 'aws-cloudfront', minimumProtocolVersion: 'TLSv1' } } })],
      'Baseline',
    );
    const violations = evaluator.evaluate(ctx);
    const sslViolations = violations.filter((v) => v.ruleId === 'cloudfront-ssl-protocol-weak');
    expect(sslViolations).toHaveLength(1);
    expect(sslViolations[0].target.type).toBe('node');
    expect(sslViolations[0].target.id).toBe('platform:cdn');
  });

  it('does not fire when using TLSv1.2_2021', () => {
    const ctx = makeComputeContext(
      [makeNode({ id: 'platform:cdn', type: 'platform', metadata: { properties: { platform: 'aws-cloudfront', minimumProtocolVersion: 'TLSv1.2_2021' } } })],
      'Baseline',
    );
    const violations = evaluator.evaluate(ctx);
    expect(violations.filter((v) => v.ruleId === 'cloudfront-ssl-protocol-weak')).toHaveLength(0);
  });

  it('does not fire when minimumProtocolVersion is not set', () => {
    const ctx = makeComputeContext(
      [makeNode({ id: 'platform:cdn', type: 'platform', metadata: { properties: { platform: 'aws-cloudfront' } } })],
      'Baseline',
    );
    const violations = evaluator.evaluate(ctx);
    expect(violations.filter((v) => v.ruleId === 'cloudfront-ssl-protocol-weak')).toHaveLength(0);
  });

  it('severity escalates across packs', () => {
    const node = makeNode({ id: 'platform:cdn', type: 'platform', metadata: { properties: { platform: 'aws-cloudfront', minimumProtocolVersion: 'SSLv3' } } });

    const baseline = evaluator.evaluate(makeComputeContext([node], 'Baseline'));
    const moderate = evaluator.evaluate(makeComputeContext([node], 'FedRAMP-Moderate'));
    const high = evaluator.evaluate(makeComputeContext([node], 'FedRAMP-High'));

    expect(baseline.find((v) => v.ruleId === 'cloudfront-ssl-protocol-weak')?.severity).toBe('warning');
    expect(moderate.find((v) => v.ruleId === 'cloudfront-ssl-protocol-weak')?.severity).toBe('error');
    expect(high.find((v) => v.ruleId === 'cloudfront-ssl-protocol-weak')?.severity).toBe('error');
  });
});

describe('waf-not-attached', () => {
  it('fires when CloudFront lacks wafAclArn', () => {
    const ctx = makeComputeContext(
      [makeNode({ id: 'platform:cdn', type: 'platform', metadata: { properties: { platform: 'aws-cloudfront' } } })],
      'Baseline',
    );
    const violations = evaluator.evaluate(ctx);
    const wafViolations = violations.filter((v) => v.ruleId === 'waf-not-attached');
    expect(wafViolations).toHaveLength(1);
    expect(wafViolations[0].target.id).toBe('platform:cdn');
  });

  it('does not fire when wafAclArn is set', () => {
    const ctx = makeComputeContext(
      [makeNode({ id: 'platform:cdn', type: 'platform', metadata: { properties: { platform: 'aws-cloudfront', wafAclArn: 'arn:aws:wafv2:...' } } })],
      'Baseline',
    );
    const violations = evaluator.evaluate(ctx);
    expect(violations.filter((v) => v.ruleId === 'waf-not-attached')).toHaveLength(0);
  });

  it('severity escalates across packs', () => {
    const node = makeNode({ id: 'platform:cdn', type: 'platform', metadata: { properties: { platform: 'aws-cloudfront' } } });

    const baseline = evaluator.evaluate(makeComputeContext([node], 'Baseline'));
    const moderate = evaluator.evaluate(makeComputeContext([node], 'FedRAMP-Moderate'));
    const high = evaluator.evaluate(makeComputeContext([node], 'FedRAMP-High'));

    expect(baseline.find((v) => v.ruleId === 'waf-not-attached')?.severity).toBe('info');
    expect(moderate.find((v) => v.ruleId === 'waf-not-attached')?.severity).toBe('warning');
    expect(high.find((v) => v.ruleId === 'waf-not-attached')?.severity).toBe('error');
  });
});

describe('s3-public-access-not-blocked', () => {
  it('fires when S3 bucket has publicAccess enabled', () => {
    const ctx = makeComputeContext(
      [makeNode({ id: 'platform:assets', type: 'platform', metadata: { properties: { platform: 'aws-s3', publicAccess: true } } })],
      'Baseline',
    );
    const violations = evaluator.evaluate(ctx);
    const publicViolations = violations.filter((v) => v.ruleId === 's3-public-access-not-blocked');
    expect(publicViolations).toHaveLength(1);
    expect(publicViolations[0].target.id).toBe('platform:assets');
  });

  it('does not fire when publicAccess is not set', () => {
    const ctx = makeComputeContext(
      [makeNode({ id: 'platform:assets', type: 'platform', metadata: { properties: { platform: 'aws-s3' } } })],
      'Baseline',
    );
    const violations = evaluator.evaluate(ctx);
    expect(violations.filter((v) => v.ruleId === 's3-public-access-not-blocked')).toHaveLength(0);
  });

  it('does not fire when publicAccess is false', () => {
    const ctx = makeComputeContext(
      [makeNode({ id: 'platform:assets', type: 'platform', metadata: { properties: { platform: 'aws-s3', publicAccess: false } } })],
      'Baseline',
    );
    const violations = evaluator.evaluate(ctx);
    expect(violations.filter((v) => v.ruleId === 's3-public-access-not-blocked')).toHaveLength(0);
  });

  it('severity escalates across packs', () => {
    const node = makeNode({ id: 'platform:assets', type: 'platform', metadata: { properties: { platform: 'aws-s3', publicAccess: true } } });

    const baseline = evaluator.evaluate(makeComputeContext([node], 'Baseline'));
    const moderate = evaluator.evaluate(makeComputeContext([node], 'FedRAMP-Moderate'));
    const high = evaluator.evaluate(makeComputeContext([node], 'FedRAMP-High'));

    expect(baseline.find((v) => v.ruleId === 's3-public-access-not-blocked')?.severity).toBe('warning');
    expect(moderate.find((v) => v.ruleId === 's3-public-access-not-blocked')?.severity).toBe('error');
    expect(high.find((v) => v.ruleId === 's3-public-access-not-blocked')?.severity).toBe('error');
  });
});

describe('stepfunctions-logging-disabled', () => {
  it('fires when Step Functions lacks logging config', () => {
    const ctx = makeComputeContext(
      [makeNode({ id: 'platform:workflow', type: 'platform', metadata: { properties: { platform: 'aws-stepfunctions' } } })],
      'Baseline',
    );
    const violations = evaluator.evaluate(ctx);
    const logViolations = violations.filter((v) => v.ruleId === 'stepfunctions-logging-disabled');
    expect(logViolations).toHaveLength(1);
    expect(logViolations[0].target.id).toBe('platform:workflow');
  });

  it('does not fire when logging is true', () => {
    const ctx = makeComputeContext(
      [makeNode({ id: 'platform:workflow', type: 'platform', metadata: { properties: { platform: 'aws-stepfunctions', logging: true } } })],
      'Baseline',
    );
    const violations = evaluator.evaluate(ctx);
    expect(violations.filter((v) => v.ruleId === 'stepfunctions-logging-disabled')).toHaveLength(0);
  });

  it('does not fire for non-Step Functions platforms', () => {
    const ctx = makeComputeContext(
      [makeNode({ id: 'platform:queue', type: 'platform', metadata: { properties: { platform: 'aws-sqs' } } })],
      'Baseline',
    );
    const violations = evaluator.evaluate(ctx);
    expect(violations.filter((v) => v.ruleId === 'stepfunctions-logging-disabled')).toHaveLength(0);
  });

  it('severity escalates across packs', () => {
    const node = makeNode({ id: 'platform:workflow', type: 'platform', metadata: { properties: { platform: 'aws-stepfunctions' } } });

    const baseline = evaluator.evaluate(makeComputeContext([node], 'Baseline'));
    const moderate = evaluator.evaluate(makeComputeContext([node], 'FedRAMP-Moderate'));
    const high = evaluator.evaluate(makeComputeContext([node], 'FedRAMP-High'));

    expect(baseline.find((v) => v.ruleId === 'stepfunctions-logging-disabled')?.severity).toBe('info');
    expect(moderate.find((v) => v.ruleId === 'stepfunctions-logging-disabled')?.severity).toBe('warning');
    expect(high.find((v) => v.ruleId === 'stepfunctions-logging-disabled')?.severity).toBe('error');
  });
});

describe('eventbridge-retry-missing', () => {
  it('fires when EventBridge schedule lacks retry policy', () => {
    const ctx = makeComputeContext(
      [makeNode({ id: 'platform:cron', type: 'platform', metadata: { properties: { platform: 'aws-eventbridge-scheduler' } } })],
      'Baseline',
    );
    const violations = evaluator.evaluate(ctx);
    const retryViolations = violations.filter((v) => v.ruleId === 'eventbridge-retry-missing');
    expect(retryViolations).toHaveLength(1);
    expect(retryViolations[0].target.id).toBe('platform:cron');
  });

  it('does not fire when retryPolicy is set', () => {
    const ctx = makeComputeContext(
      [makeNode({ id: 'platform:cron', type: 'platform', metadata: { properties: { platform: 'aws-eventbridge-scheduler', retryPolicy: { maximumRetryAttempts: 2 } } } })],
      'Baseline',
    );
    const violations = evaluator.evaluate(ctx);
    expect(violations.filter((v) => v.ruleId === 'eventbridge-retry-missing')).toHaveLength(0);
  });

  it('severity escalates across packs', () => {
    const node = makeNode({ id: 'platform:cron', type: 'platform', metadata: { properties: { platform: 'aws-eventbridge-scheduler' } } });

    const baseline = evaluator.evaluate(makeComputeContext([node], 'Baseline'));
    const moderate = evaluator.evaluate(makeComputeContext([node], 'FedRAMP-Moderate'));
    const high = evaluator.evaluate(makeComputeContext([node], 'FedRAMP-High'));

    expect(baseline.find((v) => v.ruleId === 'eventbridge-retry-missing')?.severity).toBe('info');
    expect(moderate.find((v) => v.ruleId === 'eventbridge-retry-missing')?.severity).toBe('info');
    expect(high.find((v) => v.ruleId === 'eventbridge-retry-missing')?.severity).toBe('warning');
  });
});

describe('ecs-task-public-ip', () => {
  it('fires when ECS service assigns public IP', () => {
    const ctx = makeComputeContext(
      [makeNode({ id: 'platform:web-svc', type: 'platform', metadata: { properties: { platform: 'aws-ecs-service', assignPublicIp: true } } })],
      'Baseline',
    );
    const violations = evaluator.evaluate(ctx);
    const ecsViolations = violations.filter((v) => v.ruleId === 'ecs-task-public-ip');
    expect(ecsViolations).toHaveLength(1);
    expect(ecsViolations[0].target.id).toBe('platform:web-svc');
  });

  it('does not fire when assignPublicIp is not set', () => {
    const ctx = makeComputeContext(
      [makeNode({ id: 'platform:web-svc', type: 'platform', metadata: { properties: { platform: 'aws-ecs-service' } } })],
      'Baseline',
    );
    const violations = evaluator.evaluate(ctx);
    expect(violations.filter((v) => v.ruleId === 'ecs-task-public-ip')).toHaveLength(0);
  });

  it('severity escalates across packs', () => {
    const node = makeNode({ id: 'platform:web-svc', type: 'platform', metadata: { properties: { platform: 'aws-ecs-service', assignPublicIp: true } } });

    const baseline = evaluator.evaluate(makeComputeContext([node], 'Baseline'));
    const moderate = evaluator.evaluate(makeComputeContext([node], 'FedRAMP-Moderate'));
    const high = evaluator.evaluate(makeComputeContext([node], 'FedRAMP-High'));

    expect(baseline.find((v) => v.ruleId === 'ecs-task-public-ip')?.severity).toBe('info');
    expect(moderate.find((v) => v.ruleId === 'ecs-task-public-ip')?.severity).toBe('warning');
    expect(high.find((v) => v.ruleId === 'ecs-task-public-ip')?.severity).toBe('error');
  });
});

describe('alb-access-logs-disabled', () => {
  it('fires when ALB lacks access logging', () => {
    const ctx = makeComputeContext(
      [makeNode({ id: 'platform:web-lb', type: 'platform', metadata: { properties: { platform: 'aws-alb' } } })],
      'Baseline',
    );
    const violations = evaluator.evaluate(ctx);
    const albViolations = violations.filter((v) => v.ruleId === 'alb-access-logs-disabled');
    expect(albViolations).toHaveLength(1);
    expect(albViolations[0].target.id).toBe('platform:web-lb');
  });

  it('does not fire when accessLogs is true', () => {
    const ctx = makeComputeContext(
      [makeNode({ id: 'platform:web-lb', type: 'platform', metadata: { properties: { platform: 'aws-alb', accessLogs: true } } })],
      'Baseline',
    );
    const violations = evaluator.evaluate(ctx);
    expect(violations.filter((v) => v.ruleId === 'alb-access-logs-disabled')).toHaveLength(0);
  });

  it('severity escalates across packs', () => {
    const node = makeNode({ id: 'platform:web-lb', type: 'platform', metadata: { properties: { platform: 'aws-alb' } } });

    const baseline = evaluator.evaluate(makeComputeContext([node], 'Baseline'));
    const moderate = evaluator.evaluate(makeComputeContext([node], 'FedRAMP-Moderate'));
    const high = evaluator.evaluate(makeComputeContext([node], 'FedRAMP-High'));

    expect(baseline.find((v) => v.ruleId === 'alb-access-logs-disabled')?.severity).toBe('info');
    expect(moderate.find((v) => v.ruleId === 'alb-access-logs-disabled')?.severity).toBe('warning');
    expect(high.find((v) => v.ruleId === 'alb-access-logs-disabled')?.severity).toBe('error');
  });
});

describe('ecr-image-scan-disabled', () => {
  it('fires when ECR repo has scanOnPush set to false', () => {
    const ctx = makeComputeContext(
      [makeNode({ id: 'platform:images', type: 'platform', metadata: { properties: { platform: 'aws-ecr', scanOnPush: false } } })],
      'Baseline',
    );
    const violations = evaluator.evaluate(ctx);
    const ecrViolations = violations.filter((v) => v.ruleId === 'ecr-image-scan-disabled');
    expect(ecrViolations).toHaveLength(1);
    expect(ecrViolations[0].target.id).toBe('platform:images');
  });

  it('does not fire when scanOnPush is not set (defaults to enabled)', () => {
    const ctx = makeComputeContext(
      [makeNode({ id: 'platform:images', type: 'platform', metadata: { properties: { platform: 'aws-ecr' } } })],
      'Baseline',
    );
    const violations = evaluator.evaluate(ctx);
    expect(violations.filter((v) => v.ruleId === 'ecr-image-scan-disabled')).toHaveLength(0);
  });

  it('does not fire when scanOnPush is true', () => {
    const ctx = makeComputeContext(
      [makeNode({ id: 'platform:images', type: 'platform', metadata: { properties: { platform: 'aws-ecr', scanOnPush: true } } })],
      'Baseline',
    );
    const violations = evaluator.evaluate(ctx);
    expect(violations.filter((v) => v.ruleId === 'ecr-image-scan-disabled')).toHaveLength(0);
  });

  it('severity escalates across packs', () => {
    const node = makeNode({ id: 'platform:images', type: 'platform', metadata: { properties: { platform: 'aws-ecr', scanOnPush: false } } });

    const baseline = evaluator.evaluate(makeComputeContext([node], 'Baseline'));
    const moderate = evaluator.evaluate(makeComputeContext([node], 'FedRAMP-Moderate'));
    const high = evaluator.evaluate(makeComputeContext([node], 'FedRAMP-High'));

    expect(baseline.find((v) => v.ruleId === 'ecr-image-scan-disabled')?.severity).toBe('info');
    expect(moderate.find((v) => v.ruleId === 'ecr-image-scan-disabled')?.severity).toBe('warning');
    expect(high.find((v) => v.ruleId === 'ecr-image-scan-disabled')?.severity).toBe('error');
  });
});

describe('eks-endpoint-public-access', () => {
  it('fires when EKS cluster has public endpoint enabled', () => {
    const ctx = makeComputeContext(
      [makeNode({ id: 'platform:my-cluster', type: 'platform', metadata: { properties: { platform: 'aws-eks-cluster', endpointPublicAccess: true, enabledClusterLogTypes: ['api'] } } })],
      'Baseline',
    );
    const violations = evaluator.evaluate(ctx);
    const eksViolations = violations.filter((v) => v.ruleId === 'eks-endpoint-public-access');
    expect(eksViolations).toHaveLength(1);
    expect(eksViolations[0].target.type).toBe('node');
    expect(eksViolations[0].target.id).toBe('platform:my-cluster');
  });

  it('does not fire when endpointPublicAccess is false', () => {
    const ctx = makeComputeContext(
      [makeNode({ id: 'platform:my-cluster', type: 'platform', metadata: { properties: { platform: 'aws-eks-cluster', endpointPublicAccess: false, enabledClusterLogTypes: ['api'] } } })],
      'Baseline',
    );
    const violations = evaluator.evaluate(ctx);
    expect(violations.filter((v) => v.ruleId === 'eks-endpoint-public-access')).toHaveLength(0);
  });

  it('does not fire when endpointPublicAccess is not set', () => {
    const ctx = makeComputeContext(
      [makeNode({ id: 'platform:my-cluster', type: 'platform', metadata: { properties: { platform: 'aws-eks-cluster', enabledClusterLogTypes: ['api'] } } })],
      'Baseline',
    );
    const violations = evaluator.evaluate(ctx);
    expect(violations.filter((v) => v.ruleId === 'eks-endpoint-public-access')).toHaveLength(0);
  });

  it('severity escalates across packs', () => {
    const node = makeNode({ id: 'platform:my-cluster', type: 'platform', metadata: { properties: { platform: 'aws-eks-cluster', endpointPublicAccess: true, enabledClusterLogTypes: ['api'] } } });

    const baseline = evaluator.evaluate(makeComputeContext([node], 'Baseline'));
    const moderate = evaluator.evaluate(makeComputeContext([node], 'FedRAMP-Moderate'));
    const high = evaluator.evaluate(makeComputeContext([node], 'FedRAMP-High'));

    expect(baseline.find((v) => v.ruleId === 'eks-endpoint-public-access')?.severity).toBe('warning');
    expect(moderate.find((v) => v.ruleId === 'eks-endpoint-public-access')?.severity).toBe('error');
    expect(high.find((v) => v.ruleId === 'eks-endpoint-public-access')?.severity).toBe('error');
  });
});

describe('sfn-max-recursion', () => {
  it('fires when maxRecursionDepth exceeds 50', () => {
    const ctx = makeComputeContext(
      [makeNode({ id: 'platform:agent-workflow', type: 'platform', metadata: { properties: { platform: 'aws-stepfunctions', logging: true, maxRecursionDepth: 75 } } })],
      'Baseline',
    );
    const violations = evaluator.evaluate(ctx);
    const recursionViolations = violations.filter((v) => v.ruleId === 'sfn-max-recursion');
    expect(recursionViolations).toHaveLength(1);
    expect(recursionViolations[0].target.type).toBe('node');
    expect(recursionViolations[0].target.id).toBe('platform:agent-workflow');
    expect(recursionViolations[0].message).toContain('75');
  });

  it('does not fire when maxRecursionDepth is within limits', () => {
    const ctx = makeComputeContext(
      [makeNode({ id: 'platform:workflow', type: 'platform', metadata: { properties: { platform: 'aws-stepfunctions', logging: true, maxRecursionDepth: 25 } } })],
      'Baseline',
    );
    const violations = evaluator.evaluate(ctx);
    expect(violations.filter((v) => v.ruleId === 'sfn-max-recursion')).toHaveLength(0);
  });

  it('does not fire when maxRecursionDepth is not set', () => {
    const ctx = makeComputeContext(
      [makeNode({ id: 'platform:workflow', type: 'platform', metadata: { properties: { platform: 'aws-stepfunctions', logging: true } } })],
      'Baseline',
    );
    const violations = evaluator.evaluate(ctx);
    expect(violations.filter((v) => v.ruleId === 'sfn-max-recursion')).toHaveLength(0);
  });

  it('severity escalates across packs', () => {
    const node = makeNode({ id: 'platform:workflow', type: 'platform', metadata: { properties: { platform: 'aws-stepfunctions', logging: true, maxRecursionDepth: 75 } } });

    const baseline = evaluator.evaluate(makeComputeContext([node], 'Baseline'));
    const moderate = evaluator.evaluate(makeComputeContext([node], 'FedRAMP-Moderate'));
    const high = evaluator.evaluate(makeComputeContext([node], 'FedRAMP-High'));

    expect(baseline.find((v) => v.ruleId === 'sfn-max-recursion')?.severity).toBe('warning');
    expect(moderate.find((v) => v.ruleId === 'sfn-max-recursion')?.severity).toBe('warning');
    expect(high.find((v) => v.ruleId === 'sfn-max-recursion')?.severity).toBe('error');
  });
});

describe('eks-logging-disabled', () => {
  it('fires when EKS cluster has no log types configured', () => {
    const ctx = makeComputeContext(
      [makeNode({ id: 'platform:my-cluster', type: 'platform', metadata: { properties: { platform: 'aws-eks-cluster' } } })],
      'Baseline',
    );
    const violations = evaluator.evaluate(ctx);
    const logViolations = violations.filter((v) => v.ruleId === 'eks-logging-disabled');
    expect(logViolations).toHaveLength(1);
    expect(logViolations[0].target.type).toBe('node');
    expect(logViolations[0].target.id).toBe('platform:my-cluster');
  });

  it('fires when enabledClusterLogTypes is empty array', () => {
    const ctx = makeComputeContext(
      [makeNode({ id: 'platform:my-cluster', type: 'platform', metadata: { properties: { platform: 'aws-eks-cluster', enabledClusterLogTypes: [] } } })],
      'Baseline',
    );
    const violations = evaluator.evaluate(ctx);
    expect(violations.filter((v) => v.ruleId === 'eks-logging-disabled')).toHaveLength(1);
  });

  it('does not fire when enabledClusterLogTypes has entries', () => {
    const ctx = makeComputeContext(
      [makeNode({ id: 'platform:my-cluster', type: 'platform', metadata: { properties: { platform: 'aws-eks-cluster', enabledClusterLogTypes: ['api', 'audit'] } } })],
      'Baseline',
    );
    const violations = evaluator.evaluate(ctx);
    expect(violations.filter((v) => v.ruleId === 'eks-logging-disabled')).toHaveLength(0);
  });

  it('severity escalates across packs', () => {
    const node = makeNode({ id: 'platform:my-cluster', type: 'platform', metadata: { properties: { platform: 'aws-eks-cluster' } } });

    const baseline = evaluator.evaluate(makeComputeContext([node], 'Baseline'));
    const moderate = evaluator.evaluate(makeComputeContext([node], 'FedRAMP-Moderate'));
    const high = evaluator.evaluate(makeComputeContext([node], 'FedRAMP-High'));

    expect(baseline.find((v) => v.ruleId === 'eks-logging-disabled')?.severity).toBe('info');
    expect(moderate.find((v) => v.ruleId === 'eks-logging-disabled')?.severity).toBe('warning');
    expect(high.find((v) => v.ruleId === 'eks-logging-disabled')?.severity).toBe('error');
  });
});

describe('secrets-rotation-disabled', () => {
  it('fires when SecretsManager secret lacks rotation', () => {
    const ctx = makeComputeContext(
      [makeNode({ id: 'platform:db-creds', type: 'platform', metadata: { properties: { platform: 'aws-secretsmanager' } } })],
      'Baseline',
    );
    const violations = evaluator.evaluate(ctx);
    const rotationViolations = violations.filter((v) => v.ruleId === 'secrets-rotation-disabled');
    expect(rotationViolations).toHaveLength(1);
    expect(rotationViolations[0].target.type).toBe('node');
    expect(rotationViolations[0].target.id).toBe('platform:db-creds');
  });

  it('does not fire when rotationEnabled is true', () => {
    const ctx = makeComputeContext(
      [makeNode({ id: 'platform:db-creds', type: 'platform', metadata: { properties: { platform: 'aws-secretsmanager', rotationEnabled: true } } })],
      'Baseline',
    );
    const violations = evaluator.evaluate(ctx);
    expect(violations.filter((v) => v.ruleId === 'secrets-rotation-disabled')).toHaveLength(0);
  });

  it('severity escalates across packs', () => {
    const node = makeNode({ id: 'platform:db-creds', type: 'platform', metadata: { properties: { platform: 'aws-secretsmanager' } } });

    const baseline = evaluator.evaluate(makeComputeContext([node], 'Baseline'));
    const moderate = evaluator.evaluate(makeComputeContext([node], 'FedRAMP-Moderate'));
    const high = evaluator.evaluate(makeComputeContext([node], 'FedRAMP-High'));

    expect(baseline.find((v) => v.ruleId === 'secrets-rotation-disabled')?.severity).toBe('info');
    expect(moderate.find((v) => v.ruleId === 'secrets-rotation-disabled')?.severity).toBe('warning');
    expect(high.find((v) => v.ruleId === 'secrets-rotation-disabled')?.severity).toBe('error');
  });
});

describe('kms-key-rotation-disabled', () => {
  it('fires when symmetric KMS key lacks rotation', () => {
    const ctx = makeComputeContext(
      [makeNode({ id: 'platform:my-key', type: 'platform', metadata: { properties: { platform: 'aws-kms', enableKeyRotation: false } } })],
      'Baseline',
    );
    const violations = evaluator.evaluate(ctx);
    const kmsViolations = violations.filter((v) => v.ruleId === 'kms-key-rotation-disabled');
    expect(kmsViolations).toHaveLength(1);
    expect(kmsViolations[0].target.type).toBe('node');
    expect(kmsViolations[0].target.id).toBe('platform:my-key');
  });

  it('does not fire when enableKeyRotation is true', () => {
    const ctx = makeComputeContext(
      [makeNode({ id: 'platform:my-key', type: 'platform', metadata: { properties: { platform: 'aws-kms', enableKeyRotation: true } } })],
      'Baseline',
    );
    const violations = evaluator.evaluate(ctx);
    expect(violations.filter((v) => v.ruleId === 'kms-key-rotation-disabled')).toHaveLength(0);
  });

  it('does not fire for asymmetric keys', () => {
    const ctx = makeComputeContext(
      [makeNode({ id: 'platform:my-key', type: 'platform', metadata: { properties: { platform: 'aws-kms', keySpec: 'RSA_2048', enableKeyRotation: false } } })],
      'Baseline',
    );
    const violations = evaluator.evaluate(ctx);
    expect(violations.filter((v) => v.ruleId === 'kms-key-rotation-disabled')).toHaveLength(0);
  });

  it('severity escalates across packs', () => {
    const node = makeNode({ id: 'platform:my-key', type: 'platform', metadata: { properties: { platform: 'aws-kms', enableKeyRotation: false } } });

    const baseline = evaluator.evaluate(makeComputeContext([node], 'Baseline'));
    const moderate = evaluator.evaluate(makeComputeContext([node], 'FedRAMP-Moderate'));
    const high = evaluator.evaluate(makeComputeContext([node], 'FedRAMP-High'));

    expect(baseline.find((v) => v.ruleId === 'kms-key-rotation-disabled')?.severity).toBe('warning');
    expect(moderate.find((v) => v.ruleId === 'kms-key-rotation-disabled')?.severity).toBe('error');
    expect(high.find((v) => v.ruleId === 'kms-key-rotation-disabled')?.severity).toBe('error');
  });
});

describe('elasticache-encryption-disabled', () => {
  it('fires when ElastiCache lacks encryption', () => {
    const ctx = makeComputeContext(
      [makeNode({ id: 'platform:redis', type: 'platform', metadata: { properties: { platform: 'aws-elasticache' } } })],
      'Baseline',
    );
    const violations = evaluator.evaluate(ctx);
    const encViolations = violations.filter((v) => v.ruleId === 'elasticache-encryption-disabled');
    expect(encViolations).toHaveLength(1);
    expect(encViolations[0].target.type).toBe('node');
    expect(encViolations[0].target.id).toBe('platform:redis');
  });

  it('does not fire when both encryption flags are true', () => {
    const ctx = makeComputeContext(
      [makeNode({ id: 'platform:redis', type: 'platform', metadata: { properties: { platform: 'aws-elasticache', atRestEncryptionEnabled: true, transitEncryptionEnabled: true, authToken: 'secret' } } })],
      'Baseline',
    );
    const violations = evaluator.evaluate(ctx);
    expect(violations.filter((v) => v.ruleId === 'elasticache-encryption-disabled')).toHaveLength(0);
  });

  it('fires when only transit encryption is missing', () => {
    const ctx = makeComputeContext(
      [makeNode({ id: 'platform:redis', type: 'platform', metadata: { properties: { platform: 'aws-elasticache', atRestEncryptionEnabled: true } } })],
      'Baseline',
    );
    const violations = evaluator.evaluate(ctx);
    expect(violations.filter((v) => v.ruleId === 'elasticache-encryption-disabled')).toHaveLength(1);
  });

  it('severity escalates across packs', () => {
    const node = makeNode({ id: 'platform:redis', type: 'platform', metadata: { properties: { platform: 'aws-elasticache' } } });

    const baseline = evaluator.evaluate(makeComputeContext([node], 'Baseline'));
    const moderate = evaluator.evaluate(makeComputeContext([node], 'FedRAMP-Moderate'));
    const high = evaluator.evaluate(makeComputeContext([node], 'FedRAMP-High'));

    expect(baseline.find((v) => v.ruleId === 'elasticache-encryption-disabled')?.severity).toBe('info');
    expect(moderate.find((v) => v.ruleId === 'elasticache-encryption-disabled')?.severity).toBe('warning');
    expect(high.find((v) => v.ruleId === 'elasticache-encryption-disabled')?.severity).toBe('error');
  });
});

describe('elasticache-auth-disabled', () => {
  it('fires when ElastiCache lacks AUTH token', () => {
    const ctx = makeComputeContext(
      [makeNode({ id: 'platform:redis', type: 'platform', metadata: { properties: { platform: 'aws-elasticache', atRestEncryptionEnabled: true } } })],
      'Baseline',
    );
    const violations = evaluator.evaluate(ctx);
    const authViolations = violations.filter((v) => v.ruleId === 'elasticache-auth-disabled');
    expect(authViolations).toHaveLength(1);
    expect(authViolations[0].target.id).toBe('platform:redis');
  });

  it('does not fire when transit encryption and authToken are set', () => {
    const ctx = makeComputeContext(
      [makeNode({ id: 'platform:redis', type: 'platform', metadata: { properties: { platform: 'aws-elasticache', transitEncryptionEnabled: true, atRestEncryptionEnabled: true, authToken: 'super-secret' } } })],
      'Baseline',
    );
    const violations = evaluator.evaluate(ctx);
    expect(violations.filter((v) => v.ruleId === 'elasticache-auth-disabled')).toHaveLength(0);
  });

  it('severity escalates across packs', () => {
    const node = makeNode({ id: 'platform:redis', type: 'platform', metadata: { properties: { platform: 'aws-elasticache' } } });

    const baseline = evaluator.evaluate(makeComputeContext([node], 'Baseline'));
    const moderate = evaluator.evaluate(makeComputeContext([node], 'FedRAMP-Moderate'));
    const high = evaluator.evaluate(makeComputeContext([node], 'FedRAMP-High'));

    expect(baseline.find((v) => v.ruleId === 'elasticache-auth-disabled')?.severity).toBe('info');
    expect(moderate.find((v) => v.ruleId === 'elasticache-auth-disabled')?.severity).toBe('warning');
    expect(high.find((v) => v.ruleId === 'elasticache-auth-disabled')?.severity).toBe('error');
  });
});

describe('budget-threshold-missing', () => {
  it('fires when budget has no threshold or notification topic', () => {
    const ctx = makeComputeContext(
      [makeNode({ id: 'platform:monthly-budget', type: 'platform', metadata: { properties: { platform: 'aws-budgets' } } })],
      'Baseline',
    );
    const violations = evaluator.evaluate(ctx);
    const budgetViolations = violations.filter((v) => v.ruleId === 'budget-threshold-missing');
    expect(budgetViolations).toHaveLength(1);
    expect(budgetViolations[0].target.id).toBe('platform:monthly-budget');
  });

  it('does not fire when thresholdPercentage is set', () => {
    const ctx = makeComputeContext(
      [makeNode({ id: 'platform:monthly-budget', type: 'platform', metadata: { properties: { platform: 'aws-budgets', thresholdPercentage: 80 } } })],
      'Baseline',
    );
    const violations = evaluator.evaluate(ctx);
    expect(violations.filter((v) => v.ruleId === 'budget-threshold-missing')).toHaveLength(0);
  });

  it('does not fire when notificationTopicArn is set', () => {
    const ctx = makeComputeContext(
      [makeNode({ id: 'platform:monthly-budget', type: 'platform', metadata: { properties: { platform: 'aws-budgets', notificationTopicArn: 'arn:aws:sns:...' } } })],
      'Baseline',
    );
    const violations = evaluator.evaluate(ctx);
    expect(violations.filter((v) => v.ruleId === 'budget-threshold-missing')).toHaveLength(0);
  });

  it('severity escalates across packs', () => {
    const node = makeNode({ id: 'platform:monthly-budget', type: 'platform', metadata: { properties: { platform: 'aws-budgets' } } });

    const baseline = evaluator.evaluate(makeComputeContext([node], 'Baseline'));
    const moderate = evaluator.evaluate(makeComputeContext([node], 'FedRAMP-Moderate'));
    const high = evaluator.evaluate(makeComputeContext([node], 'FedRAMP-High'));

    expect(baseline.find((v) => v.ruleId === 'budget-threshold-missing')?.severity).toBe('info');
    expect(moderate.find((v) => v.ruleId === 'budget-threshold-missing')?.severity).toBe('warning');
    expect(high.find((v) => v.ruleId === 'budget-threshold-missing')?.severity).toBe('error');
  });
});

describe('bedrock-guardrails-disabled', () => {
  it('fires when Bedrock lacks guardrails', () => {
    const ctx = makeComputeContext(
      [makeNode({ id: 'platform:llm', type: 'platform', metadata: { properties: { platform: 'aws-bedrock' } } })],
      'Baseline',
    );
    const violations = evaluator.evaluate(ctx);
    const bedrockViolations = violations.filter((v) => v.ruleId === 'bedrock-guardrails-disabled');
    expect(bedrockViolations).toHaveLength(1);
    expect(bedrockViolations[0].target.id).toBe('platform:llm');
  });

  it('does not fire when guardrailEnabled is true', () => {
    const ctx = makeComputeContext(
      [makeNode({ id: 'platform:llm', type: 'platform', metadata: { properties: { platform: 'aws-bedrock', guardrailEnabled: true } } })],
      'Baseline',
    );
    const violations = evaluator.evaluate(ctx);
    expect(violations.filter((v) => v.ruleId === 'bedrock-guardrails-disabled')).toHaveLength(0);
  });

  it('severity escalates across packs', () => {
    const node = makeNode({ id: 'platform:llm', type: 'platform', metadata: { properties: { platform: 'aws-bedrock' } } });

    const baseline = evaluator.evaluate(makeComputeContext([node], 'Baseline'));
    const moderate = evaluator.evaluate(makeComputeContext([node], 'FedRAMP-Moderate'));
    const high = evaluator.evaluate(makeComputeContext([node], 'FedRAMP-High'));

    expect(baseline.find((v) => v.ruleId === 'bedrock-guardrails-disabled')?.severity).toBe('info');
    expect(moderate.find((v) => v.ruleId === 'bedrock-guardrails-disabled')?.severity).toBe('warning');
    expect(high.find((v) => v.ruleId === 'bedrock-guardrails-disabled')?.severity).toBe('error');
  });
});

describe('sagemaker-vpc-disabled', () => {
  it('fires when SageMaker model has no VPC config', () => {
    const ctx = makeComputeContext(
      [makeNode({ id: 'platform:model', type: 'platform', metadata: { properties: { platform: 'aws-sagemaker-batch-transform' } } })],
      'Baseline',
    );
    const violations = evaluator.evaluate(ctx);
    const vpcViolations = violations.filter((v) => v.ruleId === 'sagemaker-vpc-disabled');
    expect(vpcViolations).toHaveLength(1);
    expect(vpcViolations[0].target.id).toBe('platform:model');
  });

  it('fires when vpcConfig has empty subnetIds', () => {
    const ctx = makeComputeContext(
      [makeNode({ id: 'platform:model', type: 'platform', metadata: { properties: { platform: 'aws-sagemaker-batch-transform', vpcConfig: { subnetIds: [], securityGroupIds: ['sg-1'] } } } })],
      'Baseline',
    );
    const violations = evaluator.evaluate(ctx);
    expect(violations.filter((v) => v.ruleId === 'sagemaker-vpc-disabled')).toHaveLength(1);
  });

  it('does not fire when vpcConfig has subnets', () => {
    const ctx = makeComputeContext(
      [makeNode({ id: 'platform:model', type: 'platform', metadata: { properties: { platform: 'aws-sagemaker-batch-transform', vpcConfig: { subnetIds: ['subnet-1'], securityGroupIds: ['sg-1'] } } } })],
      'Baseline',
    );
    const violations = evaluator.evaluate(ctx);
    expect(violations.filter((v) => v.ruleId === 'sagemaker-vpc-disabled')).toHaveLength(0);
  });

  it('severity escalates across packs', () => {
    const node = makeNode({ id: 'platform:model', type: 'platform', metadata: { properties: { platform: 'aws-sagemaker-batch-transform' } } });

    const baseline = evaluator.evaluate(makeComputeContext([node], 'Baseline'));
    const moderate = evaluator.evaluate(makeComputeContext([node], 'FedRAMP-Moderate'));
    const high = evaluator.evaluate(makeComputeContext([node], 'FedRAMP-High'));

    expect(baseline.find((v) => v.ruleId === 'sagemaker-vpc-disabled')?.severity).toBe('info');
    expect(moderate.find((v) => v.ruleId === 'sagemaker-vpc-disabled')?.severity).toBe('warning');
    expect(high.find((v) => v.ruleId === 'sagemaker-vpc-disabled')?.severity).toBe('error');
  });
});

describe('opensearch-encryption-disabled', () => {
  it('fires when OpenSearch domain lacks encryption', () => {
    const ctx = makeComputeContext(
      [makeNode({ id: 'platform:search', type: 'platform', metadata: { properties: { platform: 'aws-opensearch' } } })],
      'Baseline',
    );
    const violations = evaluator.evaluate(ctx);
    const encViolations = violations.filter((v) => v.ruleId === 'opensearch-encryption-disabled');
    expect(encViolations).toHaveLength(1);
    expect(encViolations[0].target.type).toBe('node');
    expect(encViolations[0].target.id).toBe('platform:search');
  });

  it('does not fire when both encryption flags are true', () => {
    const ctx = makeComputeContext(
      [makeNode({ id: 'platform:search', type: 'platform', metadata: { properties: { platform: 'aws-opensearch', encryptionAtRest: true, nodeToNodeEncryption: true } } })],
      'Baseline',
    );
    const violations = evaluator.evaluate(ctx);
    expect(violations.filter((v) => v.ruleId === 'opensearch-encryption-disabled')).toHaveLength(0);
  });

  it('fires when only encryptionAtRest is true', () => {
    const ctx = makeComputeContext(
      [makeNode({ id: 'platform:search', type: 'platform', metadata: { properties: { platform: 'aws-opensearch', encryptionAtRest: true } } })],
      'Baseline',
    );
    const violations = evaluator.evaluate(ctx);
    expect(violations.filter((v) => v.ruleId === 'opensearch-encryption-disabled')).toHaveLength(1);
  });

  it('severity escalates across packs', () => {
    const node = makeNode({ id: 'platform:search', type: 'platform', metadata: { properties: { platform: 'aws-opensearch' } } });

    const baseline = evaluator.evaluate(makeComputeContext([node], 'Baseline'));
    const moderate = evaluator.evaluate(makeComputeContext([node], 'FedRAMP-Moderate'));
    const high = evaluator.evaluate(makeComputeContext([node], 'FedRAMP-High'));

    expect(baseline.find((v) => v.ruleId === 'opensearch-encryption-disabled')?.severity).toBe('info');
    expect(moderate.find((v) => v.ruleId === 'opensearch-encryption-disabled')?.severity).toBe('warning');
    expect(high.find((v) => v.ruleId === 'opensearch-encryption-disabled')?.severity).toBe('error');
  });
});

describe('opensearch-public-access', () => {
  it('fires when OpenSearch domain has publicAccess=true', () => {
    const ctx = makeComputeContext(
      [makeNode({ id: 'platform:search', type: 'platform', metadata: { properties: { platform: 'aws-opensearch', publicAccess: true } } })],
      'Baseline',
    );
    const violations = evaluator.evaluate(ctx);
    const pubViolations = violations.filter((v) => v.ruleId === 'opensearch-public-access');
    expect(pubViolations).toHaveLength(1);
    expect(pubViolations[0].target.id).toBe('platform:search');
  });

  it('does not fire when publicAccess is false', () => {
    const ctx = makeComputeContext(
      [makeNode({ id: 'platform:search', type: 'platform', metadata: { properties: { platform: 'aws-opensearch', publicAccess: false } } })],
      'Baseline',
    );
    const violations = evaluator.evaluate(ctx);
    expect(violations.filter((v) => v.ruleId === 'opensearch-public-access')).toHaveLength(0);
  });

  it('fires for OpenSearch Serverless with publicAccess=true', () => {
    const ctx = makeComputeContext(
      [makeNode({ id: 'platform:vectors', type: 'platform', metadata: { properties: { platform: 'aws-opensearch-serverless', publicAccess: true } } })],
      'Baseline',
    );
    const violations = evaluator.evaluate(ctx);
    const pubViolations = violations.filter((v) => v.ruleId === 'opensearch-public-access');
    expect(pubViolations).toHaveLength(1);
    expect(pubViolations[0].target.id).toBe('platform:vectors');
  });

  it('severity escalates across packs', () => {
    const node = makeNode({ id: 'platform:search', type: 'platform', metadata: { properties: { platform: 'aws-opensearch', publicAccess: true } } });

    const baseline = evaluator.evaluate(makeComputeContext([node], 'Baseline'));
    const moderate = evaluator.evaluate(makeComputeContext([node], 'FedRAMP-Moderate'));
    const high = evaluator.evaluate(makeComputeContext([node], 'FedRAMP-High'));

    expect(baseline.find((v) => v.ruleId === 'opensearch-public-access')?.severity).toBe('warning');
    expect(moderate.find((v) => v.ruleId === 'opensearch-public-access')?.severity).toBe('error');
    expect(high.find((v) => v.ruleId === 'opensearch-public-access')?.severity).toBe('error');
  });
});

describe('firehose-encryption-disabled', () => {
  it('fires when Firehose lacks encryption', () => {
    const ctx = makeComputeContext(
      [makeNode({ id: 'platform:stream', type: 'platform', metadata: { properties: { platform: 'aws-kinesis-firehose' } } })],
      'Baseline',
    );
    const violations = evaluator.evaluate(ctx);
    const encViolations = violations.filter((v) => v.ruleId === 'firehose-encryption-disabled');
    expect(encViolations).toHaveLength(1);
    expect(encViolations[0].target.id).toBe('platform:stream');
  });

  it('does not fire when encryptionEnabled is true', () => {
    const ctx = makeComputeContext(
      [makeNode({ id: 'platform:stream', type: 'platform', metadata: { properties: { platform: 'aws-kinesis-firehose', encryptionEnabled: true } } })],
      'Baseline',
    );
    const violations = evaluator.evaluate(ctx);
    expect(violations.filter((v) => v.ruleId === 'firehose-encryption-disabled')).toHaveLength(0);
  });

  it('severity escalates across packs', () => {
    const node = makeNode({ id: 'platform:stream', type: 'platform', metadata: { properties: { platform: 'aws-kinesis-firehose' } } });

    const baseline = evaluator.evaluate(makeComputeContext([node], 'Baseline'));
    const moderate = evaluator.evaluate(makeComputeContext([node], 'FedRAMP-Moderate'));
    const high = evaluator.evaluate(makeComputeContext([node], 'FedRAMP-High'));

    expect(baseline.find((v) => v.ruleId === 'firehose-encryption-disabled')?.severity).toBe('info');
    expect(moderate.find((v) => v.ruleId === 'firehose-encryption-disabled')?.severity).toBe('warning');
    expect(high.find((v) => v.ruleId === 'firehose-encryption-disabled')?.severity).toBe('error');
  });
});

describe('rds-encryption-disabled', () => {
  it('fires when RDS cluster lacks storage encryption', () => {
    const ctx = makeComputeContext(
      [makeNode({ id: 'platform:db-cluster', type: 'platform', metadata: { properties: { platform: 'aws-rds-cluster' } } })],
      'Baseline',
    );
    const violations = evaluator.evaluate(ctx);
    const rdsViolations = violations.filter((v) => v.ruleId === 'rds-encryption-disabled');
    expect(rdsViolations).toHaveLength(1);
    expect(rdsViolations[0].target.type).toBe('node');
    expect(rdsViolations[0].target.id).toBe('platform:db-cluster');
  });

  it('does not fire when storageEncrypted is true', () => {
    const ctx = makeComputeContext(
      [makeNode({ id: 'platform:db-cluster', type: 'platform', metadata: { properties: { platform: 'aws-rds-cluster', storageEncrypted: true } } })],
      'Baseline',
    );
    const violations = evaluator.evaluate(ctx);
    expect(violations.filter((v) => v.ruleId === 'rds-encryption-disabled')).toHaveLength(0);
  });

  it('severity escalates across packs', () => {
    const node = makeNode({ id: 'platform:db-cluster', type: 'platform', metadata: { properties: { platform: 'aws-rds-cluster' } } });

    const baseline = evaluator.evaluate(makeComputeContext([node], 'Baseline'));
    const moderate = evaluator.evaluate(makeComputeContext([node], 'FedRAMP-Moderate'));
    const high = evaluator.evaluate(makeComputeContext([node], 'FedRAMP-High'));

    expect(baseline.find((v) => v.ruleId === 'rds-encryption-disabled')?.severity).toBe('info');
    expect(moderate.find((v) => v.ruleId === 'rds-encryption-disabled')?.severity).toBe('error');
    expect(high.find((v) => v.ruleId === 'rds-encryption-disabled')?.severity).toBe('error');
  });
});

describe('rds-public-access', () => {
  it('fires when RDS cluster has publicAccess=true', () => {
    const ctx = makeComputeContext(
      [makeNode({ id: 'platform:db-cluster', type: 'platform', metadata: { properties: { platform: 'aws-rds-cluster', publicAccess: true, storageEncrypted: true } } })],
      'Baseline',
    );
    const violations = evaluator.evaluate(ctx);
    const pubViolations = violations.filter((v) => v.ruleId === 'rds-public-access');
    expect(pubViolations).toHaveLength(1);
    expect(pubViolations[0].target.id).toBe('platform:db-cluster');
  });

  it('does not fire when publicAccess is false', () => {
    const ctx = makeComputeContext(
      [makeNode({ id: 'platform:db-cluster', type: 'platform', metadata: { properties: { platform: 'aws-rds-cluster', publicAccess: false, storageEncrypted: true } } })],
      'Baseline',
    );
    const violations = evaluator.evaluate(ctx);
    expect(violations.filter((v) => v.ruleId === 'rds-public-access')).toHaveLength(0);
  });

  it('does not fire when publicAccess is not set', () => {
    const ctx = makeComputeContext(
      [makeNode({ id: 'platform:db-cluster', type: 'platform', metadata: { properties: { platform: 'aws-rds-cluster', storageEncrypted: true } } })],
      'Baseline',
    );
    const violations = evaluator.evaluate(ctx);
    expect(violations.filter((v) => v.ruleId === 'rds-public-access')).toHaveLength(0);
  });

  it('severity escalates across packs', () => {
    const node = makeNode({ id: 'platform:db-cluster', type: 'platform', metadata: { properties: { platform: 'aws-rds-cluster', publicAccess: true, storageEncrypted: true } } });

    const baseline = evaluator.evaluate(makeComputeContext([node], 'Baseline'));
    const moderate = evaluator.evaluate(makeComputeContext([node], 'FedRAMP-Moderate'));
    const high = evaluator.evaluate(makeComputeContext([node], 'FedRAMP-High'));

    expect(baseline.find((v) => v.ruleId === 'rds-public-access')?.severity).toBe('warning');
    expect(moderate.find((v) => v.ruleId === 'rds-public-access')?.severity).toBe('error');
    expect(high.find((v) => v.ruleId === 'rds-public-access')?.severity).toBe('error');
  });
});

describe('cloudtrail-log-validation-disabled', () => {
  it('fires when CloudTrail lacks log file validation', () => {
    const ctx = makeComputeContext(
      [makeNode({ id: 'platform:trail', type: 'platform', metadata: { properties: { platform: 'aws-cloudtrail' } } })],
      'Baseline',
    );
    const violations = evaluator.evaluate(ctx);
    const trailViolations = violations.filter((v) => v.ruleId === 'cloudtrail-log-validation-disabled');
    expect(trailViolations).toHaveLength(1);
    expect(trailViolations[0].target.type).toBe('node');
    expect(trailViolations[0].target.id).toBe('platform:trail');
  });

  it('does not fire when enableLogFileValidation is true', () => {
    const ctx = makeComputeContext(
      [makeNode({ id: 'platform:trail', type: 'platform', metadata: { properties: { platform: 'aws-cloudtrail', enableLogFileValidation: true } } })],
      'Baseline',
    );
    const violations = evaluator.evaluate(ctx);
    expect(violations.filter((v) => v.ruleId === 'cloudtrail-log-validation-disabled')).toHaveLength(0);
  });

  it('severity escalates across packs', () => {
    const node = makeNode({ id: 'platform:trail', type: 'platform', metadata: { properties: { platform: 'aws-cloudtrail' } } });

    const baseline = evaluator.evaluate(makeComputeContext([node], 'Baseline'));
    const moderate = evaluator.evaluate(makeComputeContext([node], 'FedRAMP-Moderate'));
    const high = evaluator.evaluate(makeComputeContext([node], 'FedRAMP-High'));

    expect(baseline.find((v) => v.ruleId === 'cloudtrail-log-validation-disabled')?.severity).toBe('warning');
    expect(moderate.find((v) => v.ruleId === 'cloudtrail-log-validation-disabled')?.severity).toBe('error');
    expect(high.find((v) => v.ruleId === 'cloudtrail-log-validation-disabled')?.severity).toBe('error');
  });
});

describe('guardduty-not-enabled', () => {
  it('fires when GuardDuty is explicitly disabled', () => {
    const ctx = makeComputeContext(
      [makeNode({ id: 'platform:gd', type: 'platform', metadata: { properties: { platform: 'aws-guardduty', enabled: false } } })],
      'Baseline',
    );
    const violations = evaluator.evaluate(ctx);
    const gdViolations = violations.filter((v) => v.ruleId === 'guardduty-not-enabled');
    expect(gdViolations).toHaveLength(1);
    expect(gdViolations[0].target.type).toBe('node');
    expect(gdViolations[0].target.id).toBe('platform:gd');
  });

  it('does not fire when enabled is true', () => {
    const ctx = makeComputeContext(
      [makeNode({ id: 'platform:gd', type: 'platform', metadata: { properties: { platform: 'aws-guardduty', enabled: true } } })],
      'Baseline',
    );
    const violations = evaluator.evaluate(ctx);
    expect(violations.filter((v) => v.ruleId === 'guardduty-not-enabled')).toHaveLength(0);
  });

  it('does not fire when enabled is not set (defaults to true)', () => {
    const ctx = makeComputeContext(
      [makeNode({ id: 'platform:gd', type: 'platform', metadata: { properties: { platform: 'aws-guardduty' } } })],
      'Baseline',
    );
    const violations = evaluator.evaluate(ctx);
    expect(violations.filter((v) => v.ruleId === 'guardduty-not-enabled')).toHaveLength(0);
  });

  it('severity escalates across packs', () => {
    const node = makeNode({ id: 'platform:gd', type: 'platform', metadata: { properties: { platform: 'aws-guardduty', enabled: false } } });

    const baseline = evaluator.evaluate(makeComputeContext([node], 'Baseline'));
    const moderate = evaluator.evaluate(makeComputeContext([node], 'FedRAMP-Moderate'));
    const high = evaluator.evaluate(makeComputeContext([node], 'FedRAMP-High'));

    expect(baseline.find((v) => v.ruleId === 'guardduty-not-enabled')?.severity).toBe('info');
    expect(moderate.find((v) => v.ruleId === 'guardduty-not-enabled')?.severity).toBe('warning');
    expect(high.find((v) => v.ruleId === 'guardduty-not-enabled')?.severity).toBe('error');
  });
});

describe('glue-job-security-config-missing', () => {
  it('fires when Glue job lacks security configuration', () => {
    const ctx = makeComputeContext(
      [makeNode({ id: 'platform:etl-job', type: 'platform', metadata: { properties: { platform: 'aws-glue-job' } } })],
      'Baseline',
    );
    const violations = evaluator.evaluate(ctx);
    const glueViolations = violations.filter((v) => v.ruleId === 'glue-job-security-config-missing');
    expect(glueViolations).toHaveLength(1);
    expect(glueViolations[0].target.id).toBe('platform:etl-job');
  });

  it('does not fire when securityConfiguration is set', () => {
    const ctx = makeComputeContext(
      [makeNode({ id: 'platform:etl-job', type: 'platform', metadata: { properties: { platform: 'aws-glue-job', securityConfiguration: 'my-sec-config' } } })],
      'Baseline',
    );
    const violations = evaluator.evaluate(ctx);
    expect(violations.filter((v) => v.ruleId === 'glue-job-security-config-missing')).toHaveLength(0);
  });

  it('severity escalates across packs', () => {
    const node = makeNode({ id: 'platform:etl-job', type: 'platform', metadata: { properties: { platform: 'aws-glue-job' } } });

    const baseline = evaluator.evaluate(makeComputeContext([node], 'Baseline'));
    const moderate = evaluator.evaluate(makeComputeContext([node], 'FedRAMP-Moderate'));
    const high = evaluator.evaluate(makeComputeContext([node], 'FedRAMP-High'));

    expect(baseline.find((v) => v.ruleId === 'glue-job-security-config-missing')?.severity).toBe('info');
    expect(moderate.find((v) => v.ruleId === 'glue-job-security-config-missing')?.severity).toBe('warning');
    expect(high.find((v) => v.ruleId === 'glue-job-security-config-missing')?.severity).toBe('error');
  });
});

describe('athena-workgroup-encryption-disabled', () => {
  it('fires when Athena workgroup has no encryption option', () => {
    const ctx = makeComputeContext(
      [makeNode({ id: 'platform:workgroup', type: 'platform', metadata: { properties: { platform: 'aws-athena-workgroup' } } })],
      'Baseline',
    );
    const violations = evaluator.evaluate(ctx);
    const athenaViolations = violations.filter((v) => v.ruleId === 'athena-workgroup-encryption-disabled');
    expect(athenaViolations).toHaveLength(1);
  });

  it('fires when encryption option is NONE', () => {
    const ctx = makeComputeContext(
      [makeNode({ id: 'platform:workgroup', type: 'platform', metadata: { properties: { platform: 'aws-athena-workgroup', encryptionOption: 'NONE' } } })],
      'Baseline',
    );
    const violations = evaluator.evaluate(ctx);
    expect(violations.filter((v) => v.ruleId === 'athena-workgroup-encryption-disabled')).toHaveLength(1);
  });

  it('does not fire when encryption option is SSE_S3', () => {
    const ctx = makeComputeContext(
      [makeNode({ id: 'platform:workgroup', type: 'platform', metadata: { properties: { platform: 'aws-athena-workgroup', encryptionOption: 'SSE_S3' } } })],
      'Baseline',
    );
    const violations = evaluator.evaluate(ctx);
    expect(violations.filter((v) => v.ruleId === 'athena-workgroup-encryption-disabled')).toHaveLength(0);
  });

  it('severity escalates across packs', () => {
    const node = makeNode({ id: 'platform:workgroup', type: 'platform', metadata: { properties: { platform: 'aws-athena-workgroup' } } });

    const baseline = evaluator.evaluate(makeComputeContext([node], 'Baseline'));
    const moderate = evaluator.evaluate(makeComputeContext([node], 'FedRAMP-Moderate'));
    const high = evaluator.evaluate(makeComputeContext([node], 'FedRAMP-High'));

    expect(baseline.find((v) => v.ruleId === 'athena-workgroup-encryption-disabled')?.severity).toBe('info');
    expect(moderate.find((v) => v.ruleId === 'athena-workgroup-encryption-disabled')?.severity).toBe('warning');
    expect(high.find((v) => v.ruleId === 'athena-workgroup-encryption-disabled')?.severity).toBe('error');
  });
});

describe('athena-workgroup-bytes-limit-missing', () => {
  it('fires when Athena workgroup lacks bytes cutoff', () => {
    const ctx = makeComputeContext(
      [makeNode({ id: 'platform:workgroup', type: 'platform', metadata: { properties: { platform: 'aws-athena-workgroup' } } })],
      'Baseline',
    );
    const violations = evaluator.evaluate(ctx);
    expect(violations.filter((v) => v.ruleId === 'athena-workgroup-bytes-limit-missing')).toHaveLength(1);
  });

  it('does not fire when bytesScannedCutoffPerQuery is set', () => {
    const ctx = makeComputeContext(
      [makeNode({ id: 'platform:workgroup', type: 'platform', metadata: { properties: { platform: 'aws-athena-workgroup', bytesScannedCutoffPerQuery: 1073741824 } } })],
      'Baseline',
    );
    const violations = evaluator.evaluate(ctx);
    expect(violations.filter((v) => v.ruleId === 'athena-workgroup-bytes-limit-missing')).toHaveLength(0);
  });

  it('severity escalates across packs', () => {
    const node = makeNode({ id: 'platform:workgroup', type: 'platform', metadata: { properties: { platform: 'aws-athena-workgroup' } } });

    const baseline = evaluator.evaluate(makeComputeContext([node], 'Baseline'));
    const moderate = evaluator.evaluate(makeComputeContext([node], 'FedRAMP-Moderate'));
    const high = evaluator.evaluate(makeComputeContext([node], 'FedRAMP-High'));

    expect(baseline.find((v) => v.ruleId === 'athena-workgroup-bytes-limit-missing')?.severity).toBe('info');
    expect(moderate.find((v) => v.ruleId === 'athena-workgroup-bytes-limit-missing')?.severity).toBe('info');
    expect(high.find((v) => v.ruleId === 'athena-workgroup-bytes-limit-missing')?.severity).toBe('warning');
  });
});

describe('sagemaker-pipeline-parallelism-missing', () => {
  it('fires when SageMaker pipeline lacks parallelism config', () => {
    const ctx = makeComputeContext(
      [makeNode({ id: 'platform:training-pipeline', type: 'platform', metadata: { properties: { platform: 'aws-sagemaker-pipeline' } } })],
      'Baseline',
    );
    const violations = evaluator.evaluate(ctx);
    expect(violations.filter((v) => v.ruleId === 'sagemaker-pipeline-parallelism-missing')).toHaveLength(1);
  });

  it('does not fire when parallelismConfiguration is set', () => {
    const ctx = makeComputeContext(
      [makeNode({ id: 'platform:training-pipeline', type: 'platform', metadata: { properties: { platform: 'aws-sagemaker-pipeline', parallelismConfiguration: { maxParallelExecutionSteps: 5 } } } })],
      'Baseline',
    );
    const violations = evaluator.evaluate(ctx);
    expect(violations.filter((v) => v.ruleId === 'sagemaker-pipeline-parallelism-missing')).toHaveLength(0);
  });

  it('severity escalates across packs', () => {
    const node = makeNode({ id: 'platform:pipeline', type: 'platform', metadata: { properties: { platform: 'aws-sagemaker-pipeline' } } });

    const baseline = evaluator.evaluate(makeComputeContext([node], 'Baseline'));
    const moderate = evaluator.evaluate(makeComputeContext([node], 'FedRAMP-Moderate'));
    const high = evaluator.evaluate(makeComputeContext([node], 'FedRAMP-High'));

    expect(baseline.find((v) => v.ruleId === 'sagemaker-pipeline-parallelism-missing')?.severity).toBe('info');
    expect(moderate.find((v) => v.ruleId === 'sagemaker-pipeline-parallelism-missing')?.severity).toBe('info');
    expect(high.find((v) => v.ruleId === 'sagemaker-pipeline-parallelism-missing')?.severity).toBe('warning');
  });
});

describe('msk-encryption-in-transit-disabled', () => {
  it('fires when MSK encryption in transit is not TLS', () => {
    const ctx = makeComputeContext(
      [makeNode({ id: 'platform:msk', type: 'platform', metadata: { properties: { platform: 'aws-msk-cluster', encryptionInTransit: 'TLS_PLAINTEXT' } } })],
      'Baseline',
    );
    const violations = evaluator.evaluate(ctx);
    expect(violations.filter((v) => v.ruleId === 'msk-encryption-in-transit-disabled')).toHaveLength(1);
  });

  it('does not fire when encryption is TLS', () => {
    const ctx = makeComputeContext(
      [makeNode({ id: 'platform:msk', type: 'platform', metadata: { properties: { platform: 'aws-msk-cluster', encryptionInTransit: 'TLS' } } })],
      'Baseline',
    );
    const violations = evaluator.evaluate(ctx);
    expect(violations.filter((v) => v.ruleId === 'msk-encryption-in-transit-disabled')).toHaveLength(0);
  });

  it('does not fire when encryption is not set (defaults to TLS)', () => {
    const ctx = makeComputeContext(
      [makeNode({ id: 'platform:msk', type: 'platform', metadata: { properties: { platform: 'aws-msk-cluster' } } })],
      'Baseline',
    );
    const violations = evaluator.evaluate(ctx);
    expect(violations.filter((v) => v.ruleId === 'msk-encryption-in-transit-disabled')).toHaveLength(0);
  });

  it('severity escalates across packs', () => {
    const node = makeNode({ id: 'platform:msk', type: 'platform', metadata: { properties: { platform: 'aws-msk-cluster', encryptionInTransit: 'PLAINTEXT' } } });
    const baseline = evaluator.evaluate(makeComputeContext([node], 'Baseline'));
    const high = evaluator.evaluate(makeComputeContext([node], 'FedRAMP-High'));
    expect(baseline.find((v) => v.ruleId === 'msk-encryption-in-transit-disabled')?.severity).toBe('warning');
    expect(high.find((v) => v.ruleId === 'msk-encryption-in-transit-disabled')?.severity).toBe('error');
  });
});

describe('msk-authentication-disabled', () => {
  it('fires when MSK has no client authentication', () => {
    const ctx = makeComputeContext(
      [makeNode({ id: 'platform:msk', type: 'platform', metadata: { properties: { platform: 'aws-msk-cluster' } } })],
      'Baseline',
    );
    const violations = evaluator.evaluate(ctx);
    expect(violations.filter((v) => v.ruleId === 'msk-authentication-disabled')).toHaveLength(1);
  });

  it('does not fire when SASL-IAM is enabled', () => {
    const ctx = makeComputeContext(
      [makeNode({ id: 'platform:msk', type: 'platform', metadata: { properties: { platform: 'aws-msk-cluster', clientAuthentication: { sasl: { iam: true } } } } })],
      'Baseline',
    );
    const violations = evaluator.evaluate(ctx);
    expect(violations.filter((v) => v.ruleId === 'msk-authentication-disabled')).toHaveLength(0);
  });

  it('severity escalates across packs', () => {
    const node = makeNode({ id: 'platform:msk', type: 'platform', metadata: { properties: { platform: 'aws-msk-cluster' } } });
    const baseline = evaluator.evaluate(makeComputeContext([node], 'Baseline'));
    const high = evaluator.evaluate(makeComputeContext([node], 'FedRAMP-High'));
    expect(baseline.find((v) => v.ruleId === 'msk-authentication-disabled')?.severity).toBe('info');
    expect(high.find((v) => v.ruleId === 'msk-authentication-disabled')?.severity).toBe('error');
  });
});

describe('transit-gateway-auto-accept-enabled', () => {
  it('fires when auto-accept is enable', () => {
    const ctx = makeComputeContext(
      [makeNode({ id: 'platform:tgw', type: 'platform', metadata: { properties: { platform: 'aws-transit-gateway', autoAcceptSharedAttachments: 'enable' } } })],
      'Baseline',
    );
    const violations = evaluator.evaluate(ctx);
    expect(violations.filter((v) => v.ruleId === 'transit-gateway-auto-accept-enabled')).toHaveLength(1);
  });

  it('does not fire when auto-accept is disable', () => {
    const ctx = makeComputeContext(
      [makeNode({ id: 'platform:tgw', type: 'platform', metadata: { properties: { platform: 'aws-transit-gateway', autoAcceptSharedAttachments: 'disable' } } })],
      'Baseline',
    );
    const violations = evaluator.evaluate(ctx);
    expect(violations.filter((v) => v.ruleId === 'transit-gateway-auto-accept-enabled')).toHaveLength(0);
  });

  it('severity escalates across packs', () => {
    const node = makeNode({ id: 'platform:tgw', type: 'platform', metadata: { properties: { platform: 'aws-transit-gateway', autoAcceptSharedAttachments: 'enable' } } });
    const baseline = evaluator.evaluate(makeComputeContext([node], 'Baseline'));
    const high = evaluator.evaluate(makeComputeContext([node], 'FedRAMP-High'));
    expect(baseline.find((v) => v.ruleId === 'transit-gateway-auto-accept-enabled')?.severity).toBe('info');
    expect(high.find((v) => v.ruleId === 'transit-gateway-auto-accept-enabled')?.severity).toBe('error');
  });
});

describe('network-firewall-logging-disabled', () => {
  it('fires when logging is false', () => {
    const ctx = makeComputeContext(
      [makeNode({ id: 'platform:fw', type: 'platform', metadata: { properties: { platform: 'aws-network-firewall', loggingEnabled: false } } })],
      'Baseline',
    );
    const violations = evaluator.evaluate(ctx);
    expect(violations.filter((v) => v.ruleId === 'network-firewall-logging-disabled')).toHaveLength(1);
  });

  it('does not fire when logging is true or unset', () => {
    const ctx = makeComputeContext(
      [makeNode({ id: 'platform:fw', type: 'platform', metadata: { properties: { platform: 'aws-network-firewall' } } })],
      'Baseline',
    );
    const violations = evaluator.evaluate(ctx);
    expect(violations.filter((v) => v.ruleId === 'network-firewall-logging-disabled')).toHaveLength(0);
  });

  it('severity escalates across packs', () => {
    const node = makeNode({ id: 'platform:fw', type: 'platform', metadata: { properties: { platform: 'aws-network-firewall', loggingEnabled: false } } });
    const baseline = evaluator.evaluate(makeComputeContext([node], 'Baseline'));
    const high = evaluator.evaluate(makeComputeContext([node], 'FedRAMP-High'));
    expect(baseline.find((v) => v.ruleId === 'network-firewall-logging-disabled')?.severity).toBe('warning');
    expect(high.find((v) => v.ruleId === 'network-firewall-logging-disabled')?.severity).toBe('error');
  });
});

describe('route53-health-check-missing', () => {
  it('fires when public zone lacks health check', () => {
    const ctx = makeComputeContext(
      [makeNode({ id: 'platform:zone', type: 'platform', metadata: { properties: { platform: 'aws-route53-zone', zoneName: 'example.com' } } })],
      'Baseline',
    );
    const violations = evaluator.evaluate(ctx);
    expect(violations.filter((v) => v.ruleId === 'route53-health-check-missing')).toHaveLength(1);
  });

  it('does not fire when health check is configured', () => {
    const ctx = makeComputeContext(
      [makeNode({ id: 'platform:zone', type: 'platform', metadata: { properties: { platform: 'aws-route53-zone', zoneName: 'example.com', healthCheck: { fqdn: 'example.com', type: 'HTTPS' } } } })],
      'Baseline',
    );
    const violations = evaluator.evaluate(ctx);
    expect(violations.filter((v) => v.ruleId === 'route53-health-check-missing')).toHaveLength(0);
  });

  it('does not fire for private zones', () => {
    const ctx = makeComputeContext(
      [makeNode({ id: 'platform:zone', type: 'platform', metadata: { properties: { platform: 'aws-route53-zone', zoneName: 'internal.example.com', isPrivate: true } } })],
      'Baseline',
    );
    const violations = evaluator.evaluate(ctx);
    expect(violations.filter((v) => v.ruleId === 'route53-health-check-missing')).toHaveLength(0);
  });

  it('severity escalates across packs', () => {
    const node = makeNode({ id: 'platform:zone', type: 'platform', metadata: { properties: { platform: 'aws-route53-zone', zoneName: 'example.com' } } });
    const baseline = evaluator.evaluate(makeComputeContext([node], 'Baseline'));
    const high = evaluator.evaluate(makeComputeContext([node], 'FedRAMP-High'));
    expect(baseline.find((v) => v.ruleId === 'route53-health-check-missing')?.severity).toBe('info');
    expect(high.find((v) => v.ruleId === 'route53-health-check-missing')?.severity).toBe('warning');
  });
});

describe('eks-gpu-spot-capacity', () => {
  it('fires when GPU node group uses SPOT capacity', () => {
    const ctx = makeComputeContext(
      [makeNode({ id: 'platform:gpu-nodes', type: 'platform', metadata: { properties: { platform: 'aws-eks-gpu-node-group', capacityType: 'SPOT' } } })],
      'Baseline',
    );
    const violations = evaluator.evaluate(ctx);
    const gpuViolations = violations.filter((v) => v.ruleId === 'eks-gpu-spot-capacity');
    expect(gpuViolations).toHaveLength(1);
    expect(gpuViolations[0].target.id).toBe('platform:gpu-nodes');
  });

  it('does not fire when capacity is ON_DEMAND', () => {
    const ctx = makeComputeContext(
      [makeNode({ id: 'platform:gpu-nodes', type: 'platform', metadata: { properties: { platform: 'aws-eks-gpu-node-group', capacityType: 'ON_DEMAND' } } })],
      'Baseline',
    );
    const violations = evaluator.evaluate(ctx);
    expect(violations.filter((v) => v.ruleId === 'eks-gpu-spot-capacity')).toHaveLength(0);
  });

  it('does not fire when capacityType is not set (defaults to ON_DEMAND)', () => {
    const ctx = makeComputeContext(
      [makeNode({ id: 'platform:gpu-nodes', type: 'platform', metadata: { properties: { platform: 'aws-eks-gpu-node-group' } } })],
      'Baseline',
    );
    const violations = evaluator.evaluate(ctx);
    expect(violations.filter((v) => v.ruleId === 'eks-gpu-spot-capacity')).toHaveLength(0);
  });

  it('severity escalates across packs', () => {
    const node = makeNode({ id: 'platform:gpu-nodes', type: 'platform', metadata: { properties: { platform: 'aws-eks-gpu-node-group', capacityType: 'SPOT' } } });
    const baseline = evaluator.evaluate(makeComputeContext([node], 'Baseline'));
    const moderate = evaluator.evaluate(makeComputeContext([node], 'FedRAMP-Moderate'));
    const high = evaluator.evaluate(makeComputeContext([node], 'FedRAMP-High'));
    expect(baseline.find((v) => v.ruleId === 'eks-gpu-spot-capacity')?.severity).toBe('info');
    expect(moderate.find((v) => v.ruleId === 'eks-gpu-spot-capacity')?.severity).toBe('warning');
    expect(high.find((v) => v.ruleId === 'eks-gpu-spot-capacity')?.severity).toBe('warning');
  });
});

describe('eks-addon-version-unset', () => {
  it('fires when addon has no version pinned', () => {
    const ctx = makeComputeContext(
      [makeNode({ id: 'platform:vpc-cni', type: 'platform', metadata: { properties: { platform: 'aws-eks-addon', addonName: 'vpc-cni' } } })],
      'Baseline',
    );
    const violations = evaluator.evaluate(ctx);
    const addonViolations = violations.filter((v) => v.ruleId === 'eks-addon-version-unset');
    expect(addonViolations).toHaveLength(1);
    expect(addonViolations[0].target.id).toBe('platform:vpc-cni');
  });

  it('does not fire when addonVersion is set', () => {
    const ctx = makeComputeContext(
      [makeNode({ id: 'platform:vpc-cni', type: 'platform', metadata: { properties: { platform: 'aws-eks-addon', addonName: 'vpc-cni', addonVersion: 'v1.14.1-eksbuild.1' } } })],
      'Baseline',
    );
    const violations = evaluator.evaluate(ctx);
    expect(violations.filter((v) => v.ruleId === 'eks-addon-version-unset')).toHaveLength(0);
  });

  it('severity escalates across packs', () => {
    const node = makeNode({ id: 'platform:vpc-cni', type: 'platform', metadata: { properties: { platform: 'aws-eks-addon', addonName: 'vpc-cni' } } });
    const baseline = evaluator.evaluate(makeComputeContext([node], 'Baseline'));
    const moderate = evaluator.evaluate(makeComputeContext([node], 'FedRAMP-Moderate'));
    const high = evaluator.evaluate(makeComputeContext([node], 'FedRAMP-High'));
    expect(baseline.find((v) => v.ruleId === 'eks-addon-version-unset')?.severity).toBe('info');
    expect(moderate.find((v) => v.ruleId === 'eks-addon-version-unset')?.severity).toBe('warning');
    expect(high.find((v) => v.ruleId === 'eks-addon-version-unset')?.severity).toBe('error');
  });
});
