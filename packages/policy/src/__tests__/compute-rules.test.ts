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
