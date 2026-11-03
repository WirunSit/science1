// Storm & Climate models against the acceptance criteria in PLAN §11.
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { climate, weather } from '@shared/constants';
import {
  CATEGORIES, applianceWeekKg, canFormCyclone, equilibriumTemp, parseCo2, parseGistemp, stormCategory, travelWeekKg,
} from '@shared/physics/climate';

const data = (p: string) => readFileSync(resolve(__dirname, '../../content/data', p), 'utf8');

describe('Storm Builder (PLAN §11.1)', () => {
  it('no cyclone below the sea temperature limit, nor too near the equator', () => {
    const t = weather.storms.minSeaSurfaceTempC.value;
    expect(canFormCyclone(t - 0.1, 15).forms).toBe(false);
    expect(canFormCyclone(t, 15).forms).toBe(true);
    expect(canFormCyclone(29, 2).forms).toBe(false);
  });
  it('category labels change exactly at the bounds in the constants', () => {
    for (const c of CATEGORIES) {
      expect(stormCategory(c.minKmh).id).toBe(c.id);
      if (c.maxKmhExclusive !== null) expect(stormCategory(c.maxKmhExclusive - 0.01).id).toBe(c.id);
    }
    expect(stormCategory(62.9).id).toBe('depression');
    expect(stormCategory(63).id).toBe('tropicalStorm');
    expect(stormCategory(117.9).id).toBe('tropicalStorm');
    expect(stormCategory(118).id).toBe('typhoon');
  });
});

describe('Greenhouse Earth (PLAN §11.2)', () => {
  it('280 ppm gives the baseline; 560 ppm is about 2.97 °C warmer', () => {
    expect(equilibriumTemp(280)).toBeCloseTo(climate.baselineTempC.value, 10);
    expect(equilibriumTemp(560) - equilibriumTemp(280)).toBeCloseTo(0.8 * 5.35 * Math.log(2), 6);
    expect(equilibriumTemp(560) - equilibriumTemp(280)).toBeCloseTo(2.97, 2);
  });
  it('the real data match the downloaded files', () => {
    const co2 = parseCo2(data('noaa-co2/co2_annmean_mlo.csv'));
    expect(co2[0][0]).toBe(1959);
    const last = co2[co2.length - 1];
    expect(last[1]).toBe(climate.co2Current.value);
    const temp = parseGistemp(data('nasa-gistemp/GLB.Ts+dSST.csv'));
    expect(temp[0]).toEqual([1880, -0.17]);
    expect(temp.find(([y]) => y === 2025)![1]).toBe(climate.tempAnomalyLatest.value);
    expect(temp.every(([, v]) => Number.isFinite(v))).toBe(true);
  });
});

describe('My Footprint (PLAN §11.2)', () => {
  it('each total is the activity times its factor', () => {
    const ef = climate.emissionFactors;
    expect(applianceWeekKg(1, 2)).toBeCloseTo(1 * 2 * 7 * ef.electricity.value!, 10);
    expect(travelWeekKg('motorcycle', 8)).toBeCloseTo((8 * 5 / climate.vehicles.motorcycle.value) * ef.gasohol.value!, 10);
    expect(travelWeekKg('walk', 8)).toBe(0);
  });
});
