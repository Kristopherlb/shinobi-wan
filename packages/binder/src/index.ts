/**
 * @shinobi/binder - Edge Compiler for Shinobi V3
 *
 * Binders are deterministic "edge compilers" that map
 * (edge + context) → backend-neutral intents.
 */

// Binders
export { ComponentPlatformBinder, TriggersBinder } from './binders';

// Registry
export { BinderRegistry } from './registry';

// Intent factories
export {
  createIamIntent,
  createNetworkIntent,
  createConfigIntent,
  createTelemetryIntent,
} from './intent-factories';
