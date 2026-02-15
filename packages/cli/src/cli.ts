import { Command } from 'commander';
import { validate } from './commands/validate';
import { plan } from './commands/plan';
import type { PlanResult } from './commands/plan';
import { up } from './commands/up';
import type { UpResult } from './commands/up';
import { preview } from '@shinobi/adapter-aws';
import type { AdapterConfig } from '@shinobi/adapter-aws';

export function createCli(): Command {
  const program = new Command();

  program
    .name('shinobi')
    .description('Shinobi V3 — Infrastructure-as-code graph kernel')
    .version('0.0.1');

  program
    .command('validate')
    .description('Parse and validate a service manifest')
    .argument('<manifest>', 'Path to the YAML service manifest')
    .option('--json', 'Output results as JSON')
    .action((manifestPath: string, opts: { json?: boolean }) => {
      const result = validate({ manifestPath, json: opts.json });

      if (opts.json) {
        const { compilation: _, ...output } = result;
        process.stdout.write(JSON.stringify(output, null, 2) + '\n');
      } else {
        printValidateResult(result);
      }

      process.exitCode = result.success ? 0 : 1;
    });

  program
    .command('plan')
    .description('Generate a deployment plan from a service manifest')
    .argument('<manifest>', 'Path to the YAML service manifest')
    .option('--region <region>', 'AWS region', 'us-east-1')
    .option('--code-path <path>', 'Path to Lambda code artifact')
    .option('--preview', 'Run a Pulumi preview (requires AWS credentials)')
    .option('--json', 'Output results as JSON')
    .action(async (manifestPath: string, opts: { region?: string; codePath?: string; preview?: boolean; json?: boolean }) => {
      const result = plan({ manifestPath, region: opts.region, codePath: opts.codePath, json: opts.json, preview: opts.preview });

      // If --preview is set and plan succeeded, run Pulumi preview
      if (opts.preview && result.success && result.plan) {
        const adapterConfig: AdapterConfig = {
          region: opts.region ?? 'us-east-1',
          serviceName: result.validation.manifest?.service ?? 'shinobi-service',
          ...(opts.codePath ? { codePath: opts.codePath } : {}),
        };

        const previewResult = await preview(result.plan, adapterConfig);
        // Attach preview result — cast to mutable to set the field
        (result as { previewResult?: typeof previewResult }).previewResult = previewResult;

        if (!previewResult.success) {
          process.stdout.write(`Preview failed: ${previewResult.error}\n`);
          process.exitCode = 1;
          return;
        }
      }

      if (opts.json) {
        const { validation: { compilation: _, ...validation }, ...rest } = result;
        process.stdout.write(JSON.stringify({ ...rest, validation }, null, 2) + '\n');
      } else {
        printPlanResult(result);
      }

      process.exitCode = result.success ? 0 : 1;
    });

  program
    .command('up')
    .description('Deploy resources from a service manifest')
    .argument('<manifest>', 'Path to the YAML service manifest')
    .option('--region <region>', 'AWS region', 'us-east-1')
    .option('--code-path <path>', 'Path to Lambda code artifact')
    .option('--no-dry-run', 'Actually deploy (default is dry run)')
    .option('--json', 'Output results as JSON')
    .action(async (manifestPath: string, opts: { region?: string; codePath?: string; dryRun?: boolean; json?: boolean }) => {
      const result = await up({
        manifestPath,
        region: opts.region,
        codePath: opts.codePath,
        dryRun: opts.dryRun,
        json: opts.json,
      });

      if (opts.json) {
        process.stdout.write(JSON.stringify({
          success: result.success,
          deployed: result.deployed,
          message: result.message,
          resourceCount: result.plan.plan?.resources.length ?? 0,
        }, null, 2) + '\n');
      } else {
        printUpResult(result);
      }

      process.exitCode = result.success ? 0 : 1;
    });

  return program;
}

function printValidateResult(result: ReturnType<typeof validate>): void {
  if (result.manifest) {
    process.stdout.write(`Service: ${result.manifest.service}\n`);
    process.stdout.write(`Components: ${result.manifest.components}\n`);
    process.stdout.write(`Bindings: ${result.manifest.bindings}\n`);
  }

  if (result.validation) {
    const icon = result.validation.valid ? 'PASS' : 'FAIL';
    process.stdout.write(`Validation: ${icon} (${result.validation.errorCount} errors, ${result.validation.warningCount} warnings)\n`);
  }

  if (result.policy) {
    const icon = result.policy.compliant ? 'COMPLIANT' : 'NON-COMPLIANT';
    process.stdout.write(`Policy (${result.policy.policyPack}): ${icon} (${result.policy.violationCount} violations)\n`);
  }

  if (result.errors.length > 0) {
    process.stdout.write('\nErrors:\n');
    for (const e of result.errors) {
      process.stdout.write(`  ${e.path}: ${e.message}\n`);
    }
  }

  process.stdout.write(`\nResult: ${result.success ? 'SUCCESS' : 'FAILURE'}\n`);
}

function printPlanResult(result: ReturnType<typeof plan>): void {
  printValidateResult(result.validation);

  if (result.plan) {
    process.stdout.write(`\nResources (${result.plan.resources.length}):\n`);
    for (const r of result.plan.resources) {
      const deps = r.dependsOn.length > 0 ? ` (depends on: ${r.dependsOn.join(', ')})` : '';
      process.stdout.write(`  + ${r.resourceType} "${r.name}"${deps}\n`);
    }

    if (Object.keys(result.plan.outputs).length > 0) {
      process.stdout.write(`\nOutputs:\n`);
      for (const [key, value] of Object.entries(result.plan.outputs)) {
        process.stdout.write(`  ${key}: ${value}\n`);
      }
    }
  }
}

function printUpResult(result: UpResult): void {
  process.stdout.write(`${result.message}\n`);

  if (result.plan.plan) {
    process.stdout.write(`\nResources (${result.plan.plan.resources.length}):\n`);
    for (const r of result.plan.plan.resources) {
      process.stdout.write(`  + ${r.resourceType} "${r.name}"\n`);
    }
  }

  if (result.deployResult?.outputs && Object.keys(result.deployResult.outputs).length > 0) {
    process.stdout.write(`\nOutputs:\n`);
    for (const [key, value] of Object.entries(result.deployResult.outputs)) {
      process.stdout.write(`  ${key}: ${String(value)}\n`);
    }
  }
}
