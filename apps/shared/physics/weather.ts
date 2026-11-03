// Weather physics for the Weather Station (PLAN §10), all values from content/constants/weather.json.
// Pure functions, no DOM, so unit tests check the answers the labs accept.
import { weather } from '../constants';

// ── Atmosphere (§10.1) ─────────────────────────────────────
const POINTS = weather.standardAtmosphere.points;
export type LayerId = 'troposphere' | 'stratosphere' | 'mesosphere' | 'thermosphere';
export const LAYERS = weather.atmosphereLayers.layers as { id: LayerId; name: string; topKm: number | null; trend: string }[];

/** Standard atmosphere at a height: temperature linear between table points, pressure log-linear. */
export function atmosphereAt(km: number): { t: number; p: number; layer: LayerId } {
  const z = Math.min(Math.max(km, 0), POINTS[POINTS.length - 1].altitudeKm);
  let i = 0;
  while (i < POINTS.length - 2 && POINTS[i + 1].altitudeKm < z) i++;
  const a = POINTS[i];
  const b = POINTS[i + 1];
  const f = (z - a.altitudeKm) / (b.altitudeKm - a.altitudeKm);
  return {
    t: a.temperatureC + (b.temperatureC - a.temperatureC) * f,
    p: Math.exp(Math.log(a.pressureHpa) + (Math.log(b.pressureHpa) - Math.log(a.pressureHpa)) * f),
    layer: layerAt(z),
  };
}

/** Standard-atmosphere temperature (°C) and pressure (hPa) alone, for {calc:...} in worksheets. */
export const atmosphereTemp = (km: number) => atmosphereAt(km).t;
export const atmospherePressure = (km: number) => atmosphereAt(km).p;

export function layerAt(km: number): LayerId {
  return (LAYERS.find((l) => l.topKm === null || km <= l.topKm) ?? LAYERS[LAYERS.length - 1]).id;
}

// ── Humidity (§10.4) ───────────────────────────────────────
const M = weather.humidity.magnus;
/** Saturation vapour pressure (Magnus), hPa. */
export function saturationPressure(tC: number): number {
  return M.a * Math.exp((M.b * tC) / (M.c + tC));
}
/** Water vapour (g/m³) for a vapour pressure e (hPa) at tC. */
export function vaporDensity(e: number, tC: number): number {
  return (weather.humidity.vaporDensityFactor.value * e) / (tC + 273.15);
}
/** Most water vapour air at tC can hold, g/m³. */
export function saturationDensity(tC: number): number {
  return vaporDensity(saturationPressure(tC), tC);
}
/** Relative humidity, % — vapour present ÷ vapour at saturation × 100. */
export function relativeHumidity(vapor: number, tC: number): number {
  return (vapor / saturationDensity(tC)) * 100;
}
/** Temperature at which this much vapour saturates the air (dew point), °C. */
export function dewPoint(vapor: number): number {
  let lo = -40;
  let hi = 60;
  for (let k = 0; k < 60; k++) {
    const mid = (lo + hi) / 2;
    if (saturationDensity(mid) < vapor) lo = mid;
    else hi = mid;
  }
  return (lo + hi) / 2;
}
/** Wet and dry bulb hygrometer: relative humidity (%) from the formula (until the book's table is entered). */
export function hygrometerRH(dry: number, wet: number): number {
  const e = saturationPressure(wet) - weather.humidity.psychrometerCoefficient.value * weather.humidity.psychrometerPressure.value * (dry - wet);
  return (e / saturationPressure(dry)) * 100;
}

/**
 * One cell of the "find relative humidity" table (%, whole number): dry-bulb temperature and how much lower
 * the wet bulb reads. The book's table goes in weather.json → hygrometerTable; until then this formula is used.
 */
export function hygrometerTableValue(dry: number, difference: number): number {
  return Math.max(0, Math.round(hygrometerRH(dry, dry - difference)));
}

// ── Sunlight and surfaces (§10.2, §10.3) ───────────────────
const SUN = weather.sunlight;
export type SurfaceId = 'sand' | 'soil' | 'grass' | 'water';
export const SURFACES = weather.surfaces.items as { id: SurfaceId; name: string; absorptivity: number; density: number; specificHeat: number; depthM: number; evaporation: number }[];
export const surface = (id: SurfaceId) => SURFACES.find((s) => s.id === id)!;

/** Energy on each square metre of ground compared with overhead sun: sin(angle). */
export function sunEnergyFraction(angleDeg: number): number {
  return Math.sin((angleDeg * Math.PI) / 180);
}

/** Sunlight on flat ground at clock hour h (sunrise 6:00, noon 12:00, sunset 18:00), W/m². */
export function sunAt(hour: number, cloudy = false): number {
  const h = ((hour % 24) + 24) % 24;
  const up = h > 6 && h < 18 ? Math.sin((Math.PI * (h - 6)) / 12) : 0;
  return SUN.noonIrradiance.value * up * (cloudy ? SUN.cloudyLightFactor.value : 1);
}

/** Ground temperature rate (°C/s): absorbed sun not used for evaporation, minus heat to the air and to the sky. */
function surfaceRate(id: SurfaceId, t: number, hour: number, cloudy: boolean): number {
  const s = surface(id);
  const heatCap = s.density * s.specificHeat * s.depthM;
  const gain = s.absorptivity * sunAt(hour, cloudy) * (1 - s.evaporation);
  const toAir = SUN.airExchange.value * (t - SUN.airTemperatureC.value);
  const toSky = SUN.netLongwaveLoss.value * (cloudy ? SUN.cloudyLongwaveFactor.value : 1);
  return (gain - toAir - toSky) / heatCap;
}

/** One sunny hour from the same start temperature: how much each surface warms (°C). */
export function warmingInSun(id: SurfaceId, minutes = 60, startHour = 11): number {
  let t = SUN.airTemperatureC.value;
  for (let s = 0; s < minutes * 60; s += 10) t += surfaceRate(id, t, startHour + s / 3600, false) * 10;
  return t - SUN.airTemperatureC.value;
}

/**
 * Surface temperature through a day, hour by hour (index 0 = 0:00 … 24 = 24:00). Runs a few days first so
 * the day repeats itself (the result no longer depends on the start).
 */
export function dayCurve(id: SurfaceId, cloudy = false): number[] {
  let t = SUN.airTemperatureC.value;
  const out: number[] = [];
  const step = 60;
  for (let s = 0; s <= 5 * 86400; s += step) {
    const hour = s / 3600;
    if (s >= 4 * 86400 && (s - 4 * 86400) % 3600 === 0) out.push(t);
    t += surfaceRate(id, t, hour, cloudy) * step;
  }
  return out;
}

// ── Clouds (§10.5) ─────────────────────────────────────────
const CLOUD = weather.cloudModel;
/** Cloud base height (m) for surface temperature t and dew point td. */
export function cloudBase(t: number, td: number): number {
  return CLOUD.cloudBaseFactor.value * Math.max(0, t - td);
}
/** Air pushed up a mountain: where the cloud starts, how thick it is, and whether it rains. */
export function mountainCloud(t: number, td: number): { base: number; thickness: number; baseTemp: number; rain: boolean } {
  const base = Math.min(cloudBase(t, td), CLOUD.mountainTopM.value);
  const thickness = CLOUD.mountainTopM.value - base;
  return { base, thickness, baseTemp: t - (CLOUD.dryLapseRate.value * base) / 1000, rain: thickness >= CLOUD.rainThicknessM.value };
}
/** Temperature of a rising parcel at height z (m): dry rate below the cloud base, slower inside the cloud. */
export function parcelTemp(t: number, td: number, z: number): number {
  const base = cloudBase(t, td);
  if (z <= base) return t - (CLOUD.dryLapseRate.value * z) / 1000;
  return t - (CLOUD.dryLapseRate.value * base) / 1000 - (CLOUD.moistLapseRate.value * (z - base)) / 1000;
}
