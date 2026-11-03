// Dropdown choices for recording a reading (PLAN §4.2 step 1, §8.2 acceptance).
import { describe, expect, it } from 'vitest';
import { readingOptions, thermometerReading } from '@shared/reading';
import { temperatureAfterHeating } from '@shared/physics/heat';
import { specificHeat } from '@shared/constants';

describe('thermometerReading', () => {
  it('reads to the nearest 1 °C tick', () => {
    expect(thermometerReading(46.32)).toBe(46);
    expect(thermometerReading(67.64)).toBe(68);
    expect(thermometerReading(25)).toBe(25);
  });
});

describe('readingOptions', () => {
  const cases: [number, number | undefined][] = [[25, undefined], [35, 25], [46, 25], [30, 25], [110, 89], [1, undefined]];
  it.each(cases)('right reading %d (previous %s): 4 distinct ascending choices, one right', (right, prev) => {
    const opts = readingOptions(right, prev);
    expect(opts).toHaveLength(4);
    expect(new Set(opts).size).toBe(4);
    expect(opts.filter((v) => v === right)).toHaveLength(1);
    expect([...opts].sort((a, b) => a - b)).toEqual(opts);
    expect(opts.every((v) => v >= 0)).toBe(true);
    if (prev !== undefined) expect(opts).toContain(prev);
  });
});

describe('Heater Bench preset (PLAN §8.2)', () => {
  const T = (sub: 'water' | 'vegetableOil', kg: number, t: number) => temperatureAfterHeating(25, 140, t, kg, specificHeat(sub));
  it('water rows are round numbers', () => {
    expect([0, 30, 60, 90, 120].map((t) => T('water', 0.1, t))).toEqual([25, 35, 45, 55, 65]);
    expect([0, 30, 60, 90, 120].map((t) => T('water', 0.2, t))).toEqual([25, 30, 35, 40, 45]);
  });
  it('vegetable oil 100 g reads 25, 46, 68, 89, 110 with c = 1970 (verified:false)', () => {
    expect([0, 30, 60, 90, 120].map((t) => thermometerReading(T('vegetableOil', 0.1, t)))).toEqual([25, 46, 68, 89, 110]);
  });
  it('every run stays below the safety ceilings', () => {
    expect(T('water', 0.1, 120)).toBeLessThan(100);
    expect(T('vegetableOil', 0.1, 120)).toBeLessThan(150);
  });
});
