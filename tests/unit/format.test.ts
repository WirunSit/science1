import { describe, expect, it } from 'vitest';
import { formatMass, formatNumber, roundSig, withUnit } from '@shared/format';

describe('formatNumber', () => {
  it('adds thousands separators', () => {
    expect(formatNumber(125_580)).toBe('125,600');
    expect(formatNumber(125_580, { sig: 6 })).toBe('125,580');
  });

  it('uses × 10ⁿ for very large and very small values', () => {
    expect(formatNumber(2_260_000)).toBe('2.26 × 10⁶');
    expect(formatNumber(334_000, { sciAbove: 1e5 })).toBe('3.34 × 10⁵');
    expect(formatNumber(0.000023)).toBe('2.3 × 10⁻⁵');
  });

  it('uses the true minus sign', () => {
    expect(formatNumber(-18)).toBe('−18');
  });

  it('supports fixed decimals', () => {
    expect(formatNumber(24.0678, { decimals: 1 })).toBe('24.1');
  });
});

describe('helpers', () => {
  it('roundSig', () => {
    expect(roundSig(24.0678, 3)).toBe(24.1);
  });

  it('withUnit and formatMass', () => {
    expect(withUnit(126_000, 'J', { sig: 6 })).toBe('126,000 J');
    expect(formatMass(0.25)).toBe('0.25 kg (250 g)');
  });
});
