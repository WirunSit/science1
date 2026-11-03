import { describe, expect, it } from 'vitest';
import { heat, specificHeat } from '@shared/constants';
import {
  celsiusToFahrenheit,
  celsiusToKelvin,
  heatForPhaseChange,
  heatForTempChange,
  mixtureTemperature,
  temperatureAfterHeating,
  tempChangeFromHeat,
  massFromHeat,
  specificHeatFromHeat,
  heatingCurve,
  curvePoint,
} from '@shared/physics/heat';

// Expected values follow the teacher-confirmed textbook constants (c_water = 4200, K = °C + 273).
// PLAN §8–9 examples were written with 4186; see docs/decisions.md D-004.
describe('Q = mcΔt', () => {
  it('water 0.5 kg warmed by 60 °C needs 126,000 J', () => {
    expect(heatForTempChange(0.5, specificHeat('water'), 60)).toBe(126_000);
  });

  it('aluminium 0.5 kg given 27,000 J warms by 60 °C', () => {
    expect(tempChangeFromHeat(27_000, 0.5, specificHeat('aluminium'))).toBeCloseTo(60, 10);
  });

  it('same heat and mass: Δt copper > aluminium > water', () => {
    const dt = (id: Parameters<typeof specificHeat>[0]) => tempChangeFromHeat(10_000, 0.5, specificHeat(id));
    expect(dt('copper')).toBeGreaterThan(dt('aluminium'));
    expect(dt('aluminium')).toBeGreaterThan(dt('water'));
  });

  it('heating at constant power without loss is linear in time', () => {
    const c = specificHeat('water');
    const t1 = temperatureAfterHeating(25, 1000, 60, 1, c);
    const t2 = temperatureAfterHeating(25, 1000, 120, 1, c);
    expect(t2 - 25).toBeCloseTo(2 * (t1 - 25), 10);
  });
});

describe('Q = mL', () => {
  it('ice 0.1 kg at −10 °C to steam at 100 °C totals 303,500 J', () => {
    const m = 0.1;
    const q1 = heatForTempChange(m, specificHeat('ice'), 10);
    const q2 = heatForPhaseChange(m, heat.latentHeat.fusionWater.value);
    const q3 = heatForTempChange(m, specificHeat('water'), 100);
    const q4 = heatForPhaseChange(m, heat.latentHeat.vaporizationWater.value);
    expect([q1, q2, q3, q4]).toEqual([2_100, 33_400, 42_000, 226_000]);
    expect(q1 + q2 + q3 + q4).toBe(303_500);
  });
});

describe('thermal equilibrium', () => {
  const water = specificHeat('water');

  it('water 0.2 kg @80 °C + water 0.3 kg @20 °C → 44 °C', () => {
    expect(mixtureTemperature([{ m: 0.2, c: water, t: 80 }, { m: 0.3, c: water, t: 20 }])).toBeCloseTo(44, 10);
  });

  it('iron 0.1 kg @100 °C + water 0.2 kg @20 °C → ≈ 24.1 °C', () => {
    const t = mixtureTemperature([{ m: 0.1, c: specificHeat('iron'), t: 100 }, { m: 0.2, c: water, t: 20 }]);
    expect(t).toBeCloseTo(21_300 / 885, 10);
    expect(Math.round(t * 10) / 10).toBe(24.1);
  });

  it('heat lost equals heat gained', () => {
    const a = { m: 0.1, c: specificHeat('copper'), t: 90 };
    const b = { m: 0.25, c: water, t: 25 };
    const t = mixtureTemperature([a, b]);
    const lost = heatForTempChange(a.m, a.c, a.t - t);
    const gained = heatForTempChange(b.m, b.c, t - b.t);
    expect(Math.abs(lost - gained) / gained).toBeLessThan(1e-4);
  });
});

describe('temperature scales', () => {
  it('uses the textbook Kelvin offset 273', () => {
    expect(celsiusToKelvin(0)).toBe(273);
    expect(celsiusToKelvin(100)).toBe(373);
  });

  it('converts to Fahrenheit', () => {
    expect(celsiusToFahrenheit(0)).toBe(32);
    expect(celsiusToFahrenheit(100)).toBe(212);
  });
});

describe('rearranged Q = mcΔt (worksheet level 3, PLAN §8.2)', () => {
  it('finds m and c back from the Heater Bench table', () => {
    // water 100 g, 25 → 65 °C in 120 s: 16,800 J
    expect(massFromHeat(16_800, specificHeat('water'), 40)).toBeCloseTo(0.1, 12);
    expect(specificHeatFromHeat(16_800, 0.1, 40)).toBeCloseTo(specificHeat('water'), 9);
  });
});

describe('heating curve of water (PLAN §8.4 acceptance)', () => {
  const stages = heatingCurve(0.1, -10, 110);
  it('0.1 kg ice at −10 °C to all steam at 100 °C takes 303,500 J (L_f, L_v still to be confirmed)', () => {
    expect(stages.map((s) => s.q).slice(0, 4)).toEqual([2_100, 33_400, 42_000, 226_000]);
    expect(stages.slice(0, 4).reduce((a, s) => a + s.q, 0)).toBe(303_500);
  });
  it('the boiling plateau is L_v / L_f ≈ 6.8 times the melting plateau at constant power', () => {
    expect(stages[3].q / stages[1].q).toBeCloseTo(6.77, 2);
  });
  it('temperature stays put during a change of state and rises in between', () => {
    const q12 = stages[0].q + stages[1].q / 2;
    expect(curvePoint(stages, q12)).toMatchObject({ stage: 1, t: 0 });
    expect(curvePoint(stages, stages[0].q + stages[1].q + stages[2].q / 2).t).toBeCloseTo(50, 9);
    expect(curvePoint(stages, 1e9)).toMatchObject({ stage: 4, t: 110 });
  });
});
