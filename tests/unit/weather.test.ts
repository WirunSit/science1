// Weather models against the acceptance criteria in PLAN §10.
import { describe, expect, it } from 'vitest';
import { weather } from '@shared/constants';
import { ANGLES, BOX, FOUND, REF_OBJECTS, coastAnswers, dewShown, energyPercent, layerTrend, rhShown, scenarioPressure } from '../../apps/weather-station/answers';
import { SCENARIOS, isobars, pressureAt, windAt } from '../../apps/weather-station/weather-map';
import {
  LAYERS, atmosphereAt, cloudBase, dayCurve, dewPoint, hygrometerRH, layerAt, mountainCloud, relativeHumidity, saturationDensity,
  sunEnergyFraction, warmingInSun,
} from '@shared/physics/weather';

describe('Atmosphere Elevator (PLAN §10.1)', () => {
  it('matches the standard atmosphere table at its own heights (±0.5 °C, ±1%)', () => {
    for (const p of weather.standardAtmosphere.points) {
      const a = atmosphereAt(p.altitudeKm);
      expect(Math.abs(a.t - p.temperatureC)).toBeLessThanOrEqual(0.5);
      expect(Math.abs(a.p - p.pressureHpa) / p.pressureHpa).toBeLessThanOrEqual(0.01);
    }
  });
  it('layers follow the constants', () => {
    expect(layerAt(5)).toBe('troposphere');
    expect(layerAt(30)).toBe('stratosphere');
    expect(layerAt(70)).toBe('mesosphere');
    expect(layerAt(400)).toBe('thermosphere');
  });
  it('pressure falls with height', () => {
    expect(atmosphereAt(8.8).p).toBeLessThan(atmosphereAt(0).p / 2);
  });
});

describe('Humidity Box (PLAN §10.4)', () => {
  it('saturation values match the checkpoints ±2%', () => {
    for (const c of weather.humidity.saturationCheckpoints.points) {
      expect(Math.abs(saturationDensity(c.temperatureC) - c.value) / c.value).toBeLessThanOrEqual(0.02);
    }
  });
  it('30 °C with 15.2 g/m³ is about 50%', () => {
    expect(relativeHumidity(15.2, 30)).toBeCloseTo(50, 0);
  });
  it('17.3 g/m³ saturates at about 20 °C', () => {
    expect(dewPoint(17.3)).toBeCloseTo(20, 0);
  });
  it('hygrometer: equal bulbs is 100%, a bigger gap is drier', () => {
    expect(hygrometerRH(30, 30)).toBeCloseTo(100, 5);
    expect(hygrometerRH(30, 24)).toBeLessThan(hygrometerRH(30, 27));
  });
});

describe('Sun Angle (PLAN §10.2)', () => {
  it('30° gives half the energy of 90°', () => {
    expect(sunEnergyFraction(30) / sunEnergyFraction(90)).toBeCloseTo(0.5, 6);
  });
  it('in one sunny hour: sand > soil > grass > water', () => {
    const w = (['sand', 'soil', 'grass', 'water'] as const).map((s) => warmingInSun(s));
    expect(w[0] > w[1] && w[1] > w[2] && w[2] > w[3]).toBe(true);
  });
  it('the day is warmest in the afternoon and coolest near dawn; clouds narrow the range', () => {
    const clear = dayCurve('soil');
    const max = clear.indexOf(Math.max(...clear));
    const min = clear.indexOf(Math.min(...clear));
    expect(max).toBeGreaterThanOrEqual(13);
    expect(max).toBeLessThanOrEqual(15);
    expect(min).toBeGreaterThanOrEqual(5);
    expect(min).toBeLessThanOrEqual(7);
    const cloudy = dayCurve('soil', true);
    expect(Math.max(...cloudy) - Math.min(...cloudy)).toBeLessThan(Math.max(...clear) - Math.min(...clear));
  });
  it('coast: land is warmer than the sea by day and cooler by night', () => {
    const land = dayCurve('soil');
    const sea = dayCurve('water');
    expect(land[14]).toBeGreaterThan(sea[14]);
    expect(land[4]).toBeLessThan(sea[4]);
  });
});

describe('Station answers (PLAN §10)', () => {
  it('Atmosphere Elevator: trends and found objects agree with the constants', () => {
    expect(LAYERS.map((_, i) => layerTrend(i))).toEqual(['ลดลง', 'คงที่แล้วเพิ่มขึ้น', 'ลดลง', 'เพิ่มขึ้น']);
    for (const l of LAYERS) for (const id of FOUND[l.id].objects) expect(layerAt(REF_OBJECTS.find((o) => o.id === id)!.km)).toBe(l.id);
  });
  it('Sun Angle: 90°, 60°, 30° → 100, 87, 50 %', () => {
    expect(ANGLES.map(energyPercent)).toEqual(['100', '87', '50']);
  });
  it('Wind Maker: sea breeze by day, land breeze by night', () => {
    expect(coastAnswers('day').name).toBe('ลมทะเล');
    expect(coastAnswers('night').name).toBe('ลมบก');
  });
  it('Humidity Box: 50, 66, 88 % and dew point 18 °C', () => {
    expect(BOX.temps.map(rhShown)).toEqual([50, 66, 88]);
    expect(dewShown()).toBe(18);
  });
});

describe('Forecast Room maps (PLAN §10.6)', () => {
  it('H and L letters match the pressure where they are drawn', () => {
    for (const s of SCENARIOS) for (const sys of s.systems) {
      const at = sys.labelAt ?? sys;
      const p = pressureAt(s, at.lon, at.lat);
      expect(sys.kind === 'H' ? p > s.base : p < s.base).toBe(true);
    }
  });
  it('every map has isobars and the four answers differ', () => {
    for (const s of SCENARIOS) expect(isobars(s).length).toBeGreaterThan(1);
    expect(new Set(SCENARIOS.map((s) => s.forecast)).size).toBe(4);
    expect(SCENARIOS.map((_, i) => scenarioPressure(i))).toEqual(['ความกดอากาศสูง (H)', 'ความกดอากาศต่ำ (L)', 'ความกดอากาศต่ำ (L)', 'ความกดอากาศต่ำ (L)']);
  });
  it('wind blows from high towards low pressure', () => {
    const s = SCENARIOS[2];
    const [u] = windAt(s, 103, 15); // west of the storm centre: wind points east, into the low
    expect(u).toBeGreaterThan(0);
  });
});

describe('Cloud Lift (PLAN §10.5)', () => {
  it('30 °C, dew point 22 °C → cloud base about 1,000 m', () => {
    expect(cloudBase(30, 22)).toBe(1000);
  });
  it('saturated air makes cloud (fog) at the ground', () => {
    expect(cloudBase(25, 25)).toBe(0);
  });
  it('moister air: lower base, thicker cloud, rain', () => {
    const dry = mountainCloud(30, 18);
    const wet = mountainCloud(30, 26);
    expect(wet.base).toBeLessThan(dry.base);
    expect(wet.rain).toBe(true);
    expect(dry.rain).toBe(false);
  });
});
