import { describe, it, expect } from 'vitest';
import * as path from 'path';
import { up } from '../up';

const MANIFEST_PATH = path.resolve(__dirname, '../../../../../examples/lambda-sqs.yaml');

describe('up command', () => {
  it('succeeds in dry run mode by default', () => {
    const result = up({ manifestPath: MANIFEST_PATH });

    expect(result.success).toBe(true);
    expect(result.deployed).toBe(false);
    expect(result.message).toContain('Dry run complete');
  });

  it('reports resource count in dry run message', () => {
    const result = up({ manifestPath: MANIFEST_PATH });

    expect(result.message).toMatch(/\d+ resources would be created/);
  });

  it('plan is populated in dry run', () => {
    const result = up({ manifestPath: MANIFEST_PATH });

    expect(result.plan.plan).toBeDefined();
    expect(result.plan.plan?.resources.length).toBeGreaterThan(0);
  });

  it('reports not-deployed when dryRun is explicitly false (MVP)', () => {
    const result = up({ manifestPath: MANIFEST_PATH, dryRun: false });

    // MVP: actual deployment not wired yet
    expect(result.success).toBe(true);
    expect(result.deployed).toBe(false);
    expect(result.message).toContain('Plan ready');
  });

  it('fails for non-existent manifest', () => {
    const result = up({ manifestPath: '/nonexistent/file.yaml' });

    expect(result.success).toBe(false);
    expect(result.deployed).toBe(false);
    expect(result.message).toContain('Plan failed');
  });
});
