import { describe, it, expect } from 'vitest';
import { NetworkIntentLowerer } from '../lowerers/network-lowerer';
import { makeNetworkIntent, makeContext } from './test-helpers';

const lowerer = new NetworkIntentLowerer();

describe('NetworkIntentLowerer', () => {
  it('does not emit pseudo network resources', () => {
    const intent = makeNetworkIntent();
    const resources = lowerer.lower(intent, makeContext());

    expect(resources).toEqual([]);
  });

  it('determinism: identical input produces identical output', () => {
    const intent = makeNetworkIntent();
    const ctx = makeContext();
    const r1 = lowerer.lower(intent, ctx);
    const r2 = lowerer.lower(intent, ctx);
    expect(JSON.stringify(r1)).toBe(JSON.stringify(r2));
  });
});
