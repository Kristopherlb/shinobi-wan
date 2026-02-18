import { describe, it, expect } from 'vitest';
import * as path from 'path';
import { up } from '../up';

const MANIFEST_PATH = path.resolve(__dirname, '../../../../../examples/lambda-sqs.yaml');

function hasAwsCredentials(): boolean {
  return Boolean(
    process.env['AWS_ACCESS_KEY_ID'] &&
      process.env['AWS_SECRET_ACCESS_KEY'] &&
      process.env['AWS_REGION'],
  );
}

const shouldRunSmoke =
  process.env['SHINOBI_RUN_PULUMI_SMOKE'] === 'true' && hasAwsCredentials();

const maybeIt = shouldRunSmoke ? it : it.skip;

describe('up command smoke (non-mocked boundary)', () => {
  maybeIt(
    'runs dry-run preview through real adapter/deployer path',
    { timeout: 120_000 },
    async () => {
      const result = await up({
        manifestPath: MANIFEST_PATH,
        dryRun: true,
        region: process.env['AWS_REGION'],
      });

      expect(result.previewResult).toBeDefined();
      expect(result.success).toBe(true);
      expect(result.deployed).toBe(false);
    },
  );
});
