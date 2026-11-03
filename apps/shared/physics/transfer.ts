// Heat transfer models for Heat Transfer Studio (PLAN §9). Values come from content/constants only.
import { heat } from '../constants';

export type RodMaterial = 'copper' | 'aluminium' | 'iron' | 'stainlessSteel' | 'glass' | 'wood';
const NAMES: Record<RodMaterial, string> = { copper: 'ทองแดง', aluminium: 'อะลูมิเนียม', iron: 'เหล็ก', stainlessSteel: 'เหล็กกล้าไร้สนิม', glass: 'แก้ว', wood: 'ไม้' };

export function rodName(m: RodMaterial): string {
  return NAMES[m];
}

/** Thermal diffusivity α = k / (ρc) in m²/s. */
export function diffusivity(m: RodMaterial): number {
  return heat.thermalConductivity[m].value / (heat.density[m].value * heat.specificHeat[m].value);
}

/** A rod in the conduction model: temperatures at evenly spaced points from the hot end. */
export interface Rod {
  material: RodMaterial;
  t: Float64Array;
  /** Side-loss rate (1/s) = h·(perimeter/area)/(ρc) for a 1 cm round rod in still air, h ≈ 10 W/(m²·K). */
  loss: number;
  alpha: number;
  dx: number;
}

export const ROD = { length: 0.15, points: 31, diameter: 0.01, airH: 10 };

export function makeRod(material: RodMaterial, tStart: number): Rod {
  const rc = heat.density[material].value * heat.specificHeat[material].value;
  return {
    material,
    t: new Float64Array(ROD.points).fill(tStart),
    loss: (ROD.airH * (4 / ROD.diameter)) / rc,
    alpha: diffusivity(material),
    dx: ROD.length / (ROD.points - 1),
  };
}

/**
 * Advance the rod by `seconds` (explicit finite differences, sub-stepped for stability). The hot end is
 * held at tHot; the far end loses heat like the sides.
 */
export function stepRod(rod: Rod, seconds: number, tHot: number, tAir: number): void {
  const maxDt = (0.4 * rod.dx * rod.dx) / rod.alpha;
  const n = Math.max(1, Math.ceil(seconds / maxDt));
  const dt = seconds / n;
  const k = (rod.alpha * dt) / (rod.dx * rod.dx);
  const t = rod.t;
  const next = new Float64Array(t.length);
  for (let s = 0; s < n; s++) {
    t[0] = tHot;
    for (let i = 1; i < t.length - 1; i++) next[i] = t[i] + k * (t[i - 1] - 2 * t[i] + t[i + 1]) - rod.loss * dt * (t[i] - tAir);
    const end = t.length - 1;
    next[end] = t[end] + 2 * k * (t[end - 1] - t[end]) - rod.loss * dt * (t[end] - tAir);
    for (let i = 1; i < t.length; i++) t[i] = next[i];
  }
  t[0] = tHot;
}

/** Temperature at distance x (m) from the hot end, interpolated. */
export function rodTempAt(rod: Rod, x: number): number {
  const f = Math.min(rod.t.length - 1, Math.max(0, x / rod.dx));
  const i = Math.floor(f);
  const j = Math.min(rod.t.length - 1, i + 1);
  return rod.t[i] + (rod.t[j] - rod.t[i]) * (f - i);
}

/**
 * Radiation can (PLAN §9.2): dT/dt = [a·I·A − h·A·(T − T_env) − ε·σ·A·(T⁴ − T_env⁴)] / (m·c),
 * temperatures in kelvin inside the T⁴ term. I is the lamp's irradiance on the can (W/m², 0 when off).
 * a is how well the surface absorbs the lamp's light; ε is how well it gives off infrared. They differ for
 * white paint (reflects light, yet gives off infrared about as well as black), so both come from constants.
 */
export const CAN = { area: 0.02, mass: 0.2, h: 8 };
const SIGMA = 5.67e-8;
export function canRate(tC: number, absorptivity: number, emissivity: number, irradiance: number, tEnv: number): number {
  const k = (x: number) => x + heat.temperatureConversion.kelvinOffset.value;
  const gain = absorptivity * irradiance * CAN.area;
  const conv = CAN.h * CAN.area * (tC - tEnv);
  const rad = emissivity * SIGMA * CAN.area * (k(tC) ** 4 - k(tEnv) ** 4);
  return (gain - conv - rad) / (CAN.mass * heat.specificHeat.water.value);
}

/** Cool box (PLAN §9.4): wall layers in series, R = Σ d/k + surface resistance, in m²·K/W. */
export type BoxLayer = 'cardboard' | 'eps' | 'cotton' | 'stillAir';
export const BOX = { area: 0.3, topArea: 0.06, surfaceR: 0.13, sun: 800, ice: 0.5 };
export function wallResistance(layers: { material: BoxLayer; thickness: number }[]): number {
  return BOX.surfaceR + layers.reduce((s, l) => s + l.thickness / heat.thermalConductivity[l.material].value, 0);
}

/** Heat flowing into the box (W): through the walls, plus sunlight absorbed on the outside that gets in. */
export function boxHeatIn(r: number, tOut: number, tIn: number, outsideAbsorptivity: number, inSun: boolean): number {
  const walls = (BOX.area * (tOut - tIn)) / r;
  const sun = inSun ? outsideAbsorptivity * BOX.sun * BOX.topArea * (BOX.surfaceR / r) : 0;
  return walls + sun;
}

/** Minutes until all the ice (at 0 °C) has melted at a steady heat input. */
export function meltMinutes(heatInW: number): number {
  return (BOX.ice * heat.latentHeat.fusionWater.value) / heatInW / 60;
}
