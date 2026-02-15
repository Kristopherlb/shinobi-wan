import { describe, it, expect } from 'vitest';
import * as path from 'path';
import { validate } from '../validate';

const MANIFEST_PATH = path.resolve(__dirname, '../../../../../examples/lambda-sqs.yaml');

describe('validate command', () => {
  it('succeeds with the example Lambda+SQS manifest', () => {
    const result = validate({ manifestPath: MANIFEST_PATH });

    expect(result.success).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it('reports manifest metadata', () => {
    const result = validate({ manifestPath: MANIFEST_PATH });

    expect(result.manifest?.service).toBe('my-lambda-sqs');
    expect(result.manifest?.components).toBe(2);
    expect(result.manifest?.bindings).toBe(1);
  });

  it('reports validation results', () => {
    const result = validate({ manifestPath: MANIFEST_PATH });

    expect(result.validation?.valid).toBe(true);
    expect(result.validation?.errorCount).toBe(0);
  });

  it('reports policy results', () => {
    const result = validate({ manifestPath: MANIFEST_PATH });

    expect(result.policy?.policyPack).toBe('Baseline');
    expect(result.policy?.compliant).toBe(true);
  });

  it('produces compilation result with intents', () => {
    const result = validate({ manifestPath: MANIFEST_PATH });

    expect(result.compilation).toBeDefined();
    expect(result.compilation?.intents.length).toBeGreaterThan(0);

    const intentTypes = new Set(result.compilation?.intents.map((i) => i.type));
    expect(intentTypes.has('iam')).toBe(true);
    expect(intentTypes.has('network')).toBe(true);
    expect(intentTypes.has('config')).toBe(true);
  });

  it('fails for non-existent manifest file', () => {
    const result = validate({ manifestPath: '/nonexistent/file.yaml' });

    expect(result.success).toBe(false);
    expect(result.errors.length).toBeGreaterThan(0);
    expect(result.errors[0].message).toContain('Cannot read file');
  });

  it('fails for invalid YAML content', () => {
    // We need a temp file with invalid content
    const fs = require('fs');
    const tmpPath = path.resolve(__dirname, '../../../../../examples/__test-invalid.yaml');
    fs.writeFileSync(tmpPath, 'service: \n  invalid: {[}');
    try {
      const result = validate({ manifestPath: tmpPath });
      expect(result.success).toBe(false);
    } finally {
      fs.unlinkSync(tmpPath);
    }
  });

  it('--policy-pack overrides manifest value', () => {
    const result = validate({ manifestPath: MANIFEST_PATH, policyPack: 'FedRAMP-High' });

    expect(result.policy?.policyPack).toBe('FedRAMP-High');
  });

  it('FedRAMP-High flags iam-missing-conditions as error', () => {
    const result = validate({ manifestPath: MANIFEST_PATH, policyPack: 'FedRAMP-High' });

    expect(result.policy?.compliant).toBe(false);
  });

  it('determinism: same manifest produces identical results', () => {
    const r1 = validate({ manifestPath: MANIFEST_PATH });
    const r2 = validate({ manifestPath: MANIFEST_PATH });

    // Compare without compilation (which has frozen objects)
    const { compilation: c1, ...rest1 } = r1;
    const { compilation: c2, ...rest2 } = r2;
    expect(JSON.stringify(rest1)).toBe(JSON.stringify(rest2));

    // Compare intents
    expect(JSON.stringify(c1?.intents)).toBe(JSON.stringify(c2?.intents));
  });
});
