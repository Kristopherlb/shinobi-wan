import type { NetworkIntent } from '@shinobi/contracts';
import type { LoweredResource, LoweringContext, IntentLowerer } from '../types';

/**
 * Network intent lowering is currently unsupported in this adapter.
 *
 * The adapter orchestrator emits diagnostics for network intents and does not
 * emit pseudo-resources that might imply deployable enforcement.
 */
export class NetworkIntentLowerer implements IntentLowerer<NetworkIntent> {
  readonly intentType = 'network' as const;

  lower(_intent: NetworkIntent, _context: LoweringContext): ReadonlyArray<LoweredResource> {
    return [];
  }
}
