import { describe, it, expect } from 'vitest';
import { SEVERITY_MAP, SUPPORTED_PACKS, getSeverity } from '../severity-map';
import { RULE_CATALOG } from '../rules';

describe('SEVERITY_MAP', () => {
  it('has entries for all supported packs', () => {
    for (const pack of SUPPORTED_PACKS) {
      expect(SEVERITY_MAP[pack]).toBeDefined();
    }
  });

  it('each pack maps every rule in the catalog', () => {
    for (const pack of SUPPORTED_PACKS) {
      for (const rule of RULE_CATALOG) {
        expect(SEVERITY_MAP[pack][rule.ruleId]).toBeDefined();
      }
    }
  });

  it('severity escalates from Baseline → Moderate → High', () => {
    const order: Record<string, number> = { info: 0, warning: 1, error: 2 };

    for (const rule of RULE_CATALOG) {
      const baseline = order[SEVERITY_MAP['Baseline'][rule.ruleId]];
      const moderate = order[SEVERITY_MAP['FedRAMP-Moderate'][rule.ruleId]];
      const high = order[SEVERITY_MAP['FedRAMP-High'][rule.ruleId]];

      expect(moderate).toBeGreaterThanOrEqual(baseline);
      expect(high).toBeGreaterThanOrEqual(moderate);
    }
  });
});

describe('getSeverity', () => {
  it('returns correct severity for known pack and rule', () => {
    expect(getSeverity('Baseline', 'iam-no-wildcard-resource')).toBe('warning');
    expect(getSeverity('FedRAMP-High', 'iam-no-wildcard-resource')).toBe('error');
  });

  it('throws for unknown policy pack', () => {
    expect(() => getSeverity('NonExistent', 'iam-no-wildcard-resource')).toThrow(
      'Unknown policy pack'
    );
  });

  it('throws for unknown rule ID', () => {
    expect(() => getSeverity('Baseline', 'nonexistent-rule')).toThrow(
      'not found in severity map'
    );
  });
});
