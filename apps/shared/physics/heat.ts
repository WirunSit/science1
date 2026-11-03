// Pure heat equations used by labs, worksheets and quiz answer checks.
// All inputs are SI as in the textbook: m (kg), c (J/(kg·°C)), t (°C), Q (J), L (J/kg).
import { heat } from '../constants';

/** Q = mcΔt */
export function heatForTempChange(m: number, c: number, deltaT: number): number {
  return m * c * deltaT;
}

/** Δt = Q / (mc) */
export function tempChangeFromHeat(q: number, m: number, c: number): number {
  return q / (m * c);
}

/** m = Q / (cΔt) */
export function massFromHeat(q: number, c: number, deltaT: number): number {
  return q / (c * deltaT);
}

/** c = Q / (mΔt) */
export function specificHeatFromHeat(q: number, m: number, deltaT: number): number {
  return q / (m * deltaT);
}

/** Q = mL */
export function heatForPhaseChange(m: number, latentHeat: number): number {
  return m * latentHeat;
}

export interface Body {
  m: number;
  c: number;
  t: number;
}

/** Equilibrium temperature with no loss to surroundings: Σ m·c·t / Σ m·c */
export function mixtureTemperature(bodies: Body[]): number {
  const mc = bodies.reduce((s, b) => s + b.m * b.c, 0);
  return bodies.reduce((s, b) => s + b.m * b.c * b.t, 0) / mc;
}

/** Temperature after heating at constant power with no loss: T = T₀ + P·t / (m·c) */
export function temperatureAfterHeating(t0: number, powerW: number, seconds: number, m: number, c: number): number {
  return t0 + (powerW * seconds) / (m * c);
}

export function celsiusToKelvin(t: number): number {
  return t + heat.temperatureConversion.kelvinOffset.value;
}

export function celsiusToFahrenheit(t: number): number {
  return t * heat.temperatureConversion.fahrenheitScale.value + heat.temperatureConversion.fahrenheitOffset.value;
}

/** One stage of heating ice to steam (PLAN §8.4): what is in the container and the heat this stage takes. */
export interface CurveStage {
  id: 'ice' | 'melting' | 'water' | 'boiling' | 'steam';
  /** Temperature at the start and end of the stage (equal for a change of state). */
  from: number;
  to: number;
  q: number;
}

/**
 * Heating curve of water from ice at t0 (< 0 °C) up to steam at tSteam (≥ 100 °C), from the constants:
 * Q₁ = m·c_ice·(0 − t0), Q₂ = m·L_f, Q₃ = m·c_water·100, Q₄ = m·L_v, Q₅ = m·c_steam·(tSteam − 100).
 */
export function heatingCurve(m: number, t0: number, tSteam: number): CurveStage[] {
  const melt = heat.phasePoints.waterMelting.value;
  const boil = heat.phasePoints.waterBoiling.value;
  const c = heat.specificHeat;
  return [
    { id: 'ice', from: t0, to: melt, q: heatForTempChange(m, c.ice.value, melt - t0) },
    { id: 'melting', from: melt, to: melt, q: heatForPhaseChange(m, heat.latentHeat.fusionWater.value) },
    { id: 'water', from: melt, to: boil, q: heatForTempChange(m, c.water.value, boil - melt) },
    { id: 'boiling', from: boil, to: boil, q: heatForPhaseChange(m, heat.latentHeat.vaporizationWater.value) },
    { id: 'steam', from: boil, to: tSteam, q: heatForTempChange(m, c.steam.value, tSteam - boil) },
  ];
}

/** Where heat `q` (J, from the start) has got to on the curve: stage index, temperature, and how far through the stage (0–1). */
export function curvePoint(stages: CurveStage[], q: number): { stage: number; t: number; f: number } {
  let left = Math.max(0, q);
  for (let i = 0; i < stages.length; i++) {
    const s = stages[i];
    if (left <= s.q || i === stages.length - 1) {
      const f = s.q > 0 ? Math.min(1, left / s.q) : 1;
      return { stage: i, t: s.from + (s.to - s.from) * f, f };
    }
    left -= s.q;
  }
  return { stage: stages.length - 1, t: stages[stages.length - 1].to, f: 1 };
}

/** Equilibrium temperature of two bodies (m₁, c₁, t₁) and (m₂, c₂, t₂) — Q lost = Q gained, no loss. */
export function mixTwo(m1: number, c1: number, t1: number, m2: number, c2: number, t2: number): number {
  return mixtureTemperature([{ m: m1, c: c1, t: t1 }, { m: m2, c: c2, t: t2 }]);
}
