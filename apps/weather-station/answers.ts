// What each Weather Station station accepts as right answers, computed from the weather models (no DOM),
// so the labs and the quiz unit test agree (PLAN §10).
import { weather } from '@shared/constants';
import { thermometerReading } from '@shared/reading';
import {
  LAYERS, atmosphereAt, dayCurve, dewPoint, mountainCloud, saturationDensity, sunEnergyFraction, surface, warmingInSun,
  type LayerId, type SurfaceId,
} from '@shared/physics/weather';
import { SCENARIOS, pressureAt } from './weather-map';

// ── Atmosphere Elevator ────────────────────────────────────
export const TREND_CHOICES = ['ลดลง', 'เพิ่มขึ้น', 'คงที่แล้วเพิ่มขึ้น'];
/** Where the elevator stops: the top of each layer; the thermosphere ride ends at the space station. */
export const STOPS_KM = LAYERS.map((l) => l.topKm ?? 400);
const bottomKm = (i: number) => (i === 0 ? 0 : STOPS_KM[i - 1]);

/** How temperature changes going up through a layer, read off the standard atmosphere. */
export function layerTrend(i: number): string {
  const lo = bottomKm(i);
  const hi = STOPS_KM[i];
  const t = (f: number) => atmosphereAt(lo + (hi - lo) * f).t;
  if (Math.abs(t(0.2) - t(0)) < 2 && t(1) > t(0.2) + 2) return TREND_CHOICES[2];
  return t(1) < t(0) ? TREND_CHOICES[0] : TREND_CHOICES[1];
}

/** What students find in each layer: reference objects from the constants, placed by height. */
export const FOUND: Record<LayerId, { text: string; objects: string[] }> = {
  troposphere: { text: 'เมฆ ฝน และเครื่องบินพาณิชย์', objects: ['everest', 'airliner'] },
  stratosphere: { text: 'ชั้นโอโซน', objects: ['ozoneLayer', 'weatherBalloon'] },
  mesosphere: { text: 'ดาวตกลุกไหม้', objects: ['meteors'] },
  thermosphere: { text: 'แสงออโรราและสถานีอวกาศ', objects: ['aurora', 'iss'] },
};
export const FOUND_CHOICES = LAYERS.map((l) => FOUND[l.id].text);
export const REF_OBJECTS = weather.referenceObjects.items.map((o) => ({
  id: o.id, name: o.name, km: Array.isArray(o.altitudeKm) ? (o.altitudeKm[0] + o.altitudeKm[1]) / 2 : o.altitudeKm,
}));

// ── Sun Angle ──────────────────────────────────────────────
export const ANGLES = [90, 60, 30];
export const ENERGY_CHOICES = ['100', '87', '71', '50', '25'];
export const energyPercent = (deg: number) => String(Math.round(sunEnergyFraction(deg) * 100));
export const SURFACE_ROWS: SurfaceId[] = ['sand', 'soil', 'grass', 'water'];
export const RANK_CHOICES = ['1', '2', '3', '4'];
export function surfaceRanks(): string[] {
  const w = SURFACE_ROWS.map((s) => warmingInSun(s));
  const order = [...w.keys()].sort((a, b) => w[b] - w[a]);
  return SURFACE_ROWS.map((_, i) => String(order.indexOf(i) + 1));
}
export const surfaceName = (id: SurfaceId) => surface(id).name;
export const HOUR_CHOICES = ['ประมาณ 06:00 (รุ่งเช้า)', 'ประมาณ 12:00 (เที่ยงวัน)', 'ประมาณ 14:00 (บ่าย)', 'ประมาณ 18:00 (พลบค่ำ)'];
const HOURS = [6, 12, 14, 18];
/** The listed hour nearest to when the clear-day curve is highest / lowest. */
export function dayAnswer(kind: 'max' | 'min'): string {
  const c = dayCurve('soil');
  const at = c.indexOf(kind === 'max' ? Math.max(...c) : Math.min(...c));
  const near = HOURS.reduce((best, h, i) => (Math.abs(h - at) < Math.abs(HOURS[best] - at) ? i : best), 0);
  return HOUR_CHOICES[near];
}
export const RANGE_CHOICES = ['แคบกว่าวันฟ้าโปร่ง', 'กว้างกว่าวันฟ้าโปร่ง', 'เท่ากัน'];
export function cloudyRange(): string {
  const span = (c: number[]) => Math.max(...c) - Math.min(...c);
  const a = span(dayCurve('soil'));
  const b = span(dayCurve('soil', true));
  return b < a ? RANGE_CHOICES[0] : b > a ? RANGE_CHOICES[1] : RANGE_CHOICES[2];
}

// ── Wind Maker ─────────────────────────────────────────────
export const COAST_HOURS = { day: 14, night: 4 } as const;
export type Time = keyof typeof COAST_HOURS;
export const WHERE_CHOICES = ['พื้นดิน', 'พื้นน้ำ'];
export const WIND_CHOICES = ['จากทะเลเข้าฝั่ง', 'จากฝั่งออกทะเล'];
export const NAME_CHOICES = ['ลมทะเล', 'ลมบก'];
export function coastTemps(time: Time): { land: number; sea: number } {
  return { land: dayCurve('soil')[COAST_HOURS[time]], sea: dayCurve('water')[COAST_HOURS[time]] };
}
/** The warmer surface heats the air above it, which rises: low pressure there; surface wind blows towards it. */
export function coastAnswers(time: Time): { warmer: string; low: string; wind: string; name: string } {
  const t = coastTemps(time);
  const landWarmer = t.land > t.sea;
  return {
    warmer: landWarmer ? WHERE_CHOICES[0] : WHERE_CHOICES[1],
    low: landWarmer ? WHERE_CHOICES[0] : WHERE_CHOICES[1],
    wind: landWarmer ? WIND_CHOICES[0] : WIND_CHOICES[1],
    name: landWarmer ? NAME_CHOICES[0] : NAME_CHOICES[1],
  };
}
export const MAP_ROWS = [
  { id: 'flow', name: 'ลมผิวพื้นพัดจาก', choices: ['H ไป L', 'L ไป H'], answer: 'H ไป L' },
  { id: 'isobar', name: 'ตรงที่ไอโซบาร์ชิดกัน ลม', choices: ['แรงกว่า', 'อ่อนกว่า'], answer: 'แรงกว่า' },
  { id: 'vane', name: 'หัวลูกศรของศรลมชี้ไปทาง', choices: ['ทิศที่ลมพัดมา', 'ทิศที่ลมพัดไป'], answer: 'ทิศที่ลมพัดมา' },
];

// ── Humidity Box ───────────────────────────────────────────
export const BOX = { vapor: 15.2, temps: [30, 25, 20] };
/** Saturation as the bench shows it (one decimal place). */
export const satShown = (t: number) => Math.round(saturationDensity(t) * 10) / 10;
export const rhShown = (t: number) => Math.round((BOX.vapor / satShown(t)) * 100);
export const SAT_CHOICES = () => [...new Set([...BOX.temps.map(satShown), BOX.vapor, 40])].sort((a, b) => a - b).map((v) => v.toFixed(1));
export const RH_CHOICES = () => [...new Set([15, ...BOX.temps.map(rhShown), 100])].sort((a, b) => a - b).map(String);
export const dewShown = () => thermometerReading(dewPoint(BOX.vapor));
export const DEW_CHOICES = () => [...new Set([10, 15, dewShown(), 20, 25])].sort((a, b) => a - b).map(String);
export const WHAT_CHOICES = ['ไอน้ำควบแน่นเป็นหยดน้ำเกาะผนัง', 'ไอน้ำหายไป', 'อากาศทั้งหมดกลายเป็นน้ำ'];

// ── Cloud Lift ─────────────────────────────────────────────
export const RUNS = [
  { id: 'dry', name: 'อากาศชื้นน้อย (30 °C จุดน้ำค้าง 18 °C)', t: 30, td: 18 },
  { id: 'wet', name: 'อากาศชื้นมาก (30 °C จุดน้ำค้าง 26 °C)', t: 30, td: 26 },
] as const;
export const BASE_CHOICES = ['0', '500', '1000', '1500', '2000', '3000'];
export const BASE_TEMP_CHOICES = ['15', '20', '25', '30'];
export const RAIN_CHOICES = ['ฝนตก', 'ฝนไม่ตก'];
export function runAnswers(i: number): { base: string; baseTemp: string; rain: string } {
  const c = mountainCloud(RUNS[i].t, RUNS[i].td);
  return { base: String(Math.round(c.base)), baseTemp: String(Math.round(c.baseTemp)), rain: c.rain ? RAIN_CHOICES[0] : RAIN_CHOICES[1] };
}

// ── Forecast Room ──────────────────────────────────────────
export const PRESSURE_CHOICES = ['ความกดอากาศสูง (H)', 'ความกดอากาศต่ำ (L)'];
export const FORECAST_CHOICES = SCENARIOS.map((s) => s.forecast);
export function scenarioPressure(i: number): string {
  const s = SCENARIOS[i];
  return pressureAt(s, s.pin.lon, s.pin.lat) >= s.base ? PRESSURE_CHOICES[0] : PRESSURE_CHOICES[1];
}

/** Every answer cell a quiz item may quote: "<table>/<row>/<column>" → the right value. */
export function answerCells(station: string): Record<string, string> {
  const out: Record<string, string> = {};
  if (station === 'atmosphere-elevator') {
    LAYERS.forEach((l, i) => { out[`layers/${l.id}/trend`] = layerTrend(i); out[`layers/${l.id}/found`] = FOUND[l.id].text; });
  } else if (station === 'sun-angle') {
    for (const a of ANGLES) out[`angle/a${a}/energy`] = energyPercent(a);
    const r = surfaceRanks();
    SURFACE_ROWS.forEach((s, i) => { out[`surface/${s}/rank`] = r[i]; });
    out['day/max/value'] = dayAnswer('max');
    out['day/min/value'] = dayAnswer('min');
    out['day/cloudy/value'] = cloudyRange();
  } else if (station === 'wind-maker') {
    for (const time of ['day', 'night'] as Time[]) for (const [k, v] of Object.entries(coastAnswers(time))) out[`coast/${time}/${k}`] = v;
    for (const r of MAP_ROWS) out[`map/${r.id}/value`] = r.answer;
  } else if (station === 'humidity-box') {
    for (const t of BOX.temps) { out[`box/t${t}/sat`] = satShown(t).toFixed(1); out[`box/t${t}/rh`] = String(rhShown(t)); }
    out['dew/temp/value'] = String(dewShown());
    out['dew/what/value'] = WHAT_CHOICES[0];
  } else if (station === 'cloud-lift') {
    RUNS.forEach((r, i) => { for (const [k, v] of Object.entries(runAnswers(i))) out[`runs/${r.id}/${k}`] = v; });
  } else if (station === 'forecast-room') {
    SCENARIOS.forEach((s, i) => { out[`maps/${s.id}/pressure`] = scenarioPressure(i); out[`maps/${s.id}/weather`] = s.forecast; });
  }
  return out;
}
