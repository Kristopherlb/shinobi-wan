import { Command } from 'commander';
import { validate } from './commands/validate';
import type { ValidateOptions } from './commands/validate';
import { plan } from './commands/plan';
import type { PlanResult } from './commands/plan';
import { up } from './commands/up';
import type { UpResult } from './commands/up';
import { destroy } from './commands/destroy';
import type { DestroyCommandResult } from './commands/destroy';
import { preview } from '@shinobi/adapter-aws';
import type { AdapterConfig } from '@shinobi/adapter-aws';
import {
  envelopePlanResult,
  envelopeUpResult,
  envelopeValidateResult,
  getIntegrationFeatureFlags,
} from './integration';

/**
 * Extension points for embedding platforms (MCA-3): register custom binders
 * and policy evaluators without forking the CLI. Wrap createCli() in your own
 * binary and pass your extensions here.
 */
export interface CliExtensions {
  readonly binders?: ValidateOptions['binders'];
  readonly evaluators?: ValidateOptions['evaluators'];
}

export function createCli(extensions?: CliExtensions): Command {
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
    .option('--harmony-envelope', 'Emit Harmony-compatible envelope output')
    .option('--trace-id <traceId>', 'Correlation trace identifier')
    .option('--environment <env>', 'Named environment (dev, staging, prod)')
    .option('--explain', 'Include a why-report tracing outputs to their causes')
    .option(
      '--policy-pack <pack>',
      'Policy pack (Baseline, FedRAMP-Moderate, FedRAMP-High)',
    )
    .action(
      (
        manifestPath: string,
        opts: {
          json?: boolean;
          harmonyEnvelope?: boolean;
          traceId?: string;
          environment?: string;
          explain?: boolean;
          policyPack?: string;
        },
      ) => {
        const result = validate({
          manifestPath,
          json: opts.json,
          policyPack: opts.policyPack,
          environment: opts.environment,
          explain: opts.explain,
          binders: extensions?.binders,
          evaluators: extensions?.evaluators,
        });
        const featureFlags = getIntegrationFeatureFlags();
        const traceId = opts.traceId ?? 'trace-local';

        if (opts.harmonyEnvelope) {
          const output = envelopeValidateResult(result, {
            toolId: 'golden.shinobi.validate_plan',
            operationClass: 'plan',
            traceId,
            toolVersion: featureFlags.toolVersion,
            contractVersion: featureFlags.contractVersion,
          });
          process.stdout.write(JSON.stringify(output, null, 2) + '\n');
        } else if (opts.json) {
          const { compilation: _, ...output } = result;
          process.stdout.write(JSON.stringify(output, null, 2) + '\n');
        } else {
          printValidateResult(result);
        }

        process.exitCode = result.success ? 0 : 1;
      },
    );

  program
    .command('plan')
    .description('Generate a deployment plan from a service manifest')
    .argument('<manifest>', 'Path to the YAML service manifest')
    .option('--region <region>', 'AWS region', 'us-east-1')
    .option('--environment <env>', 'Named environment (dev, staging, prod)')
    .option('--backend-url <url>', 'Pulumi state backend URL')
    .option('--secrets-provider <provider>', 'Pulumi secrets provider')
    .option('--code-path <path>', 'Path to Lambda code artifact')
    .option('--preview', 'Run a Pulumi preview (requires AWS credentials)')
    .option('--json', 'Output results as JSON')
    .option('--harmony-envelope', 'Emit Harmony-compatible envelope output')
    .option('--trace-id <traceId>', 'Correlation trace identifier')
    .option(
      '--policy-pack <pack>',
      'Policy pack (Baseline, FedRAMP-Moderate, FedRAMP-High)',
    )
    .action(
      async (
        manifestPath: string,
        opts: {
          region?: string;
          environment?: string;
          backendUrl?: string;
          secretsProvider?: string;
          codePath?: string;
          preview?: boolean;
          json?: boolean;
          harmonyEnvelope?: boolean;
          traceId?: string;
          policyPack?: string;
        },
      ) => {
        const result = plan({
          manifestPath,
          region: opts.region,
          environment: opts.environment,
          backendUrl: opts.backendUrl,
          secretsProvider: opts.secretsProvider,
          codePath: opts.codePath,
          json: opts.json,
          policyPack: opts.policyPack,
          binders: extensions?.binders,
          evaluators: extensions?.evaluators,
        });

        // If --preview is set and plan succeeded, run Pulumi preview
        if (opts.preview && result.success && result.plan) {
          const adapterConfig: AdapterConfig = {
            region: opts.region ?? 'us-east-1',
            serviceName:
              result.validation.manifest?.service ?? 'shinobi-service',
            ...(opts.environment ? { environment: opts.environment } : {}),
            ...(opts.backendUrl ? { backendUrl: opts.backendUrl } : {}),
            ...(opts.secretsProvider
              ? { secretsProvider: opts.secretsProvider }
              : {}),
            ...(opts.codePath ? { codePath: opts.codePath } : {}),
          };

          const previewResult = await preview(result.plan, adapterConfig);
          // Attach preview result — cast to mutable to set the field
          (result as { previewResult?: typeof previewResult }).previewResult =
            previewResult;

          if (!previewResult.success) {
            process.stdout.write(`Preview failed: ${previewResult.error}\n`);
            process.exitCode = 1;
            return;
          }
        }

        if (opts.harmonyEnvelope) {
          const featureFlags = getIntegrationFeatureFlags();
          const output = envelopePlanResult(result, {
            toolId: 'golden.shinobi.plan_change',
            operationClass: 'plan',
            traceId: opts.traceId ?? 'trace-local',
            toolVersion: featureFlags.toolVersion,
            contractVersion: featureFlags.contractVersion,
          });
          process.stdout.write(JSON.stringify(output, null, 2) + '\n');
        } else if (opts.json) {
          const {
            validation: { compilation: _, ...validation },
            ...rest
          } = result;
          process.stdout.write(
            JSON.stringify({ ...rest, validation }, null, 2) + '\n',
          );
        } else {
          printPlanResult(result);
        }

        process.exitCode = result.success ? 0 : 1;
      },
    );

  program
    .command('up')
    .description('Deploy resources from a service manifest')
    .argument('<manifest>', 'Path to the YAML service manifest')
    .option('--region <region>', 'AWS region', 'us-east-1')
    .option('--environment <env>', 'Named environment (dev, staging, prod)')
    .option('--backend-url <url>', 'Pulumi state backend URL')
    .option('--secrets-provider <provider>', 'Pulumi secrets provider')
    .option('--code-path <path>', 'Path to Lambda code artifact')
    .option('--no-dry-run', 'Actually deploy (default is dry run)')
    .option('--json', 'Output results as JSON')
    .option('--harmony-envelope', 'Emit Harmony-compatible envelope output')
    .option('--trace-id <traceId>', 'Correlation trace identifier')
    .option(
      '--policy-pack <pack>',
      'Policy pack (Baseline, FedRAMP-Moderate, FedRAMP-High)',
    )
    .action(
      async (
        manifestPath: string,
        opts: {
          region?: string;
          environment?: string;
          backendUrl?: string;
          secretsProvider?: string;
          codePath?: string;
          dryRun?: boolean;
          json?: boolean;
          harmonyEnvelope?: boolean;
          traceId?: string;
          policyPack?: string;
        },
      ) => {
        const result = await up({
          manifestPath,
          region: opts.region,
          environment: opts.environment,
          backendUrl: opts.backendUrl,
          secretsProvider: opts.secretsProvider,
          codePath: opts.codePath,
          dryRun: opts.dryRun,
          json: opts.json,
          policyPack: opts.policyPack,
          binders: extensions?.binders,
          evaluators: extensions?.evaluators,
        });

        if (opts.harmonyEnvelope) {
          const featureFlags = getIntegrationFeatureFlags();
          const output = envelopeUpResult(result, {
            toolId: 'golden.shinobi.apply_change',
            operationClass: 'apply',
            traceId: opts.traceId ?? 'trace-local',
            toolVersion: featureFlags.toolVersion,
            contractVersion: featureFlags.contractVersion,
          });
          process.stdout.write(JSON.stringify(output, null, 2) + '\n');
        } else if (opts.json) {
          process.stdout.write(
            JSON.stringify(
              {
                success: result.success,
                deployed: result.deployed,
                message: result.message,
                resourceCount: result.plan.plan?.resources.length ?? 0,
              },
              null,
              2,
            ) + '\n',
          );
        } else {
          printUpResult(result);
        }

        process.exitCode = result.success ? 0 : 1;
      },
    );

  program
    .command('destroy')
    .description('Tear down the stack deployed from a service manifest')
    .argument('<manifest>', 'Path to the YAML service manifest')
    .option('--region <region>', 'AWS region', 'us-east-1')
    .option('--environment <env>', 'Named environment (dev, staging, prod)')
    .option('--backend-url <url>', 'Pulumi state backend URL')
    .option('--secrets-provider <provider>', 'Pulumi secrets provider')
    .option('--no-dry-run', 'Actually destroy (default is dry run)')
    .option('--json', 'Output results as JSON')
    .action(
      async (
        manifestPath: string,
        opts: {
          region?: string;
          environment?: string;
          backendUrl?: string;
          secretsProvider?: string;
          dryRun?: boolean;
          json?: boolean;
        },
      ) => {
        const result = await destroy({
          manifestPath,
          region: opts.region,
          environment: opts.environment,
          backendUrl: opts.backendUrl,
          secretsProvider: opts.secretsProvider,
          dryRun: opts.dryRun,
          json: opts.json,
        });

        if (opts.json) {
          process.stdout.write(
            JSON.stringify(
              {
                success: result.success,
                stackName: result.stackName,
                destroyed: result.destroyed,
                message: result.message,
              },
              null,
              2,
            ) + '\n',
          );
        } else {
          printDestroyResult(result);
        }

        process.exitCode = result.success ? 0 : 1;
      },
    );

  return program;
}

function printDestroyResult(result: DestroyCommandResult): void {
  process.stdout.write(`${result.message}\n`);
  if (result.destroyResult?.summary.resourceChanges) {
    process.stdout.write('\nResource changes:\n');
    for (const [op, count] of Object.entries(
      result.destroyResult.summary.resourceChanges,
    )) {
      process.stdout.write(`  ${op}: ${count}\n`);
    }
  }
}

function printValidateResult(result: ReturnType<typeof validate>): void {
  if (result.manifest) {
    process.stdout.write(`Service: ${result.manifest.service}\n`);
    process.stdout.write(`Components: ${result.manifest.components}\n`);
    process.stdout.write(`Bindings: ${result.manifest.bindings}\n`);
  }

  if (result.validation) {
    const icon = result.validation.valid ? 'PASS' : 'FAIL';
    process.stdout.write(
      `Validation: ${icon} (${result.validation.errorCount} errors, ${result.validation.warningCount} warnings)\n`,
    );
  }

  if (result.policy) {
    const icon = result.policy.compliant ? 'COMPLIANT' : 'NON-COMPLIANT';
    process.stdout.write(
      `Policy (${result.policy.policyPack}): ${icon} (${result.policy.blockingViolationCount} blocking, ${result.policy.advisoryViolationCount} advisory)\n`,
    );
  }

  if (result.bindingDiagnostics && result.bindingDiagnostics.length > 0) {
    process.stdout.write('\nBinding diagnostics:\n');
    for (const d of result.bindingDiagnostics) {
      process.stdout.write(
        `  [${d.severity}] ${d.rule} ${d.path}: ${d.message}\n`,
      );
    }
  }

  if (result.why && result.why.entries.length > 0) {
    process.stdout.write('\nWhy:\n');
    for (const w of result.why.entries) {
      process.stdout.write(`  [${w.kind}] ${w.subject}\n    ${w.because}\n`);
      if (w.remediation) {
        process.stdout.write(`    Remediation: ${w.remediation}\n`);
      }
    }
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
      const deps =
        r.dependsOn.length > 0
          ? ` (depends on: ${r.dependsOn.join(', ')})`
          : '';
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
    process.stdout.write(
      `\nResources (${result.plan.plan.resources.length}):\n`,
    );
    for (const r of result.plan.plan.resources) {
      process.stdout.write(`  + ${r.resourceType} "${r.name}"\n`);
    }
  }

  if (
    result.deployResult?.outputs &&
    Object.keys(result.deployResult.outputs).length > 0
  ) {
    process.stdout.write(`\nOutputs:\n`);
    for (const [key, value] of Object.entries(result.deployResult.outputs)) {
      process.stdout.write(`  ${key}: ${String(value)}\n`);
    }
  }
}
