#!/usr/bin/env node
import { createCli } from './cli';
import { invokeHarmonyTool } from './mcp';
import type { HarmonyToolCallRequest } from './mcp';

async function main(): Promise<void> {
  const harmonyCallIndex = process.argv.indexOf('--harmony-call');
  if (harmonyCallIndex >= 0) {
    const rawPayload = process.argv[harmonyCallIndex + 1];
    if (!rawPayload) {
      process.stderr.write('Missing JSON payload for --harmony-call\n');
      process.exitCode = 1;
      return;
    }

    let parsed: HarmonyToolCallRequest;
    try {
      parsed = JSON.parse(rawPayload) as HarmonyToolCallRequest;
    } catch (err) {
      process.stderr.write(`Invalid JSON payload for --harmony-call: ${(err as Error).message}\n`);
      process.exitCode = 1;
      return;
    }

    const result = await invokeHarmonyTool(parsed);
    process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
    process.exitCode = result.envelope.success ? 0 : 1;
    return;
  }

  await createCli().parseAsync(process.argv);
}

void main();
