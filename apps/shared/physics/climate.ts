// Storms and climate for Storm & Climate (PLAN §11), all values from content/constants (weather.json storms,
// climate.json). Pure functions, no DOM, so unit tests check the answers the labs accept.
import { climate, weather } from '../constants';

// ── Storms (§11.1) ─────────────────────────────────────────
const STORMS = weather.storms;
export type StormCategory = 'depression' | 'tropicalStorm' | 'typhoon';
export const CATEGORIES = STORMS.tropicalCycloneCategories.items as { id: StormCategory; name: string; minKmh: number; maxKmhExclusive: number | null }[];

/** Tropical cyclone category for the strongest wind near the centre (km/h), by the bounds in the constants. */
export function stormCategory(kmh: number): (typeof CATEGORIES)[number] {
  return CATEGORIES.find((c) => kmh >= c.minKmh && (c.maxKmhExclusive === null || kmh < c.maxKmhExclusive)) ?? CATEGORIES[0];
}

/** Can a tropical cyclone form here? Warm enough sea and far enough from the equator to spin. */
export function canFormCyclone(seaTempC: number, latitudeDeg: number): { forms: boolean; why: string } {
  if (seaTempC < STORMS.minSeaSurfaceTempC.value) return { forms: false, why: `ผิวน้ำทะเลอุ่นไม่ถึง ${STORMS.minSeaSurfaceTempC.value} °C` };
  if (Math.abs(latitudeDeg) < STORMS.minLatitudeDeg.value) return { forms: false, why: `อยู่ใกล้เส้นศูนย์สูตรเกินไป (ต่ำกว่า ${STORMS.minLatitudeDeg.value}°)` };
  return { forms: true, why: 'ผิวน้ำอุ่น อากาศร้อนชื้นยกตัวได้มาก และอยู่ห่างเส้นศูนย์สูตรพอจะหมุน' };
}

// ── Greenhouse (§11.2) ─────────────────────────────────────
/** Equilibrium global mean temperature (°C) for a CO₂ level (ppm): baseline + λ·5.35·ln(C/C₀). */
export function equilibriumTemp(co2: number): number {
  const forcing = climate.co2ForcingCoefficient.value * Math.log(co2 / climate.co2PreIndustrial.value);
  return climate.baselineTempC.value + climate.climateSensitivity.value * forcing;
}
export const noGreenhouseTemp = () => climate.noGreenhouseTempC.value;

// ── Footprint (§11.2 My Footprint) ─────────────────────────
const EF = climate.emissionFactors;
/** kgCO₂e in one week from an appliance used `hoursPerDay` every day. Null when the factor is not in yet. */
export function applianceWeekKg(kw: number, hoursPerDay: number): number | null {
  if (EF.electricity.value === null) return null;
  return kw * hoursPerDay * 7 * EF.electricity.value;
}
export type TravelMode = 'walk' | 'bicycle' | 'motorcycle' | 'car';
/** kgCO₂e in one school week (5 days) for a round trip of `kmRoundTrip`. Walking and cycling burn no fuel. */
export function travelWeekKg(mode: TravelMode, kmRoundTrip: number): number | null {
  if (mode === 'walk' || mode === 'bicycle') return 0;
  if (EF.gasohol.value === null) return null;
  const kmPerLitre = climate.vehicles[mode].value;
  return (kmRoundTrip * 5 / kmPerLitre) * EF.gasohol.value;
}

// ── Real data files (content/data, downloaded 3 Nov 2026) ──
/** NOAA GML co2_annmean_mlo.csv: "year,mean,unc" rows after # comments. */
export function parseCo2(text: string): [number, number][] {
  return text.split(/\r?\n/).filter((l) => /^\d{4},/.test(l)).map((l) => {
    const [y, v] = l.split(',');
    return [Number(y), Number(v)] as [number, number];
  });
}
/** NASA GISTEMP GLB.Ts+dSST.csv: annual mean (J-D column) in °C against 1951–1980; incomplete years ("***") left out. */
export function parseGistemp(text: string): [number, number][] {
  const lines = text.split(/\r?\n/);
  const head = lines.find((l) => l.startsWith('Year,'))!.split(',');
  const col = head.indexOf('J-D');
  return lines.filter((l) => /^\d{4},/.test(l)).map((l) => l.split(',')).filter((c) => c[col] !== '***')
    .map((c) => [Number(c[0]), Number(c[col])] as [number, number]);
}
