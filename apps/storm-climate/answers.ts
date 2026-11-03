// What each Storm & Climate station accepts as right answers, computed from the models and the real data
// files (no DOM), so the labs and the quiz unit test agree (PLAN §11).
import { climate, weather } from '@shared/constants';
import {
  CATEGORIES, applianceWeekKg, canFormCyclone, equilibriumTemp, noGreenhouseTemp, parseCo2, parseGistemp, stormCategory, travelWeekKg,
} from '@shared/physics/climate';
import co2Text from '@content/data/noaa-co2/co2_annmean_mlo.csv?raw';
import tempText from '@content/data/nasa-gistemp/GLB.Ts+dSST.csv?raw';

// ── Storm Builder ──────────────────────────────────────────
export const STAGES = weather.storms.thunderstormStages.items;
export const AIR_CHOICES = ['อากาศยกตัวขึ้นเป็นส่วนใหญ่', 'มีทั้งอากาศยกตัวและจมตัว', 'อากาศจมตัวลงเป็นส่วนใหญ่'];
export const RAIN_CHOICES = ['ยังไม่มีฝน', 'ฝนตกหนัก ฟ้าแลบ ลมกระโชกแรง', 'ฝนเบาลง'];
/** Each stage in order: developing, mature, dissipating (PLAN §7.2). */
export const STAGE_ANSWERS = STAGES.map((_, i) => ({ air: AIR_CHOICES[i], rain: RAIN_CHOICES[i] }));
export const SEA_TRIALS = [{ id: 'sst25', name: 'ผิวน้ำทะเล 25 °C', sst: 25 }, { id: 'sst29', name: 'ผิวน้ำทะเล 29 °C', sst: 29 }];
/** The storm forms at this latitude (°N) in the scene. */
export const STORM_LAT = 14;
export const FORM_CHOICES = ['เกิดพายุ', 'ไม่เกิดพายุ'];
export const formAnswer = (sst: number) => (canFormCyclone(sst, STORM_LAT).forms ? FORM_CHOICES[0] : FORM_CHOICES[1]);
/** Strongest wind when the run pauses (km/h): one value inside each category. */
export const WIND_STOPS = [50, 90, 140];
export const CATEGORY_CHOICES = CATEGORIES.map((c) => c.name);
export const categoryAnswer = (kmh: number) => stormCategory(kmh).name;
export const FACT_ROWS = [
  { id: 'land', name: 'เมื่อพายุขึ้นฝั่ง', choices: ['อ่อนกำลังลง', 'แรงขึ้น', 'เท่าเดิม'], answer: 'อ่อนกำลังลง' },
  { id: 'spin', name: 'ลมพัดเวียนเข้าหาศูนย์กลาง (ซีกโลกเหนือ)', choices: ['ทวนเข็มนาฬิกา', 'ตามเข็มนาฬิกา'], answer: 'ทวนเข็มนาฬิกา' },
  { id: 'eye', name: 'ตาพายุ', choices: ['ลมสงบ ท้องฟ้าค่อนข้างโปร่ง', 'ลมแรงที่สุด'], answer: 'ลมสงบ ท้องฟ้าค่อนข้างโปร่ง' },
];

// ── Greenhouse Earth ───────────────────────────────────────
export const PRESETS = [
  { id: 'none', name: 'ไม่มีแก๊สเรือนกระจก', co2: 0 },
  { id: 'ice', name: `ยุคน้ำแข็ง (CO₂ ${climate.co2IceAge.value} ppm)`, co2: climate.co2IceAge.value },
  { id: 'pre', name: `ก่อนยุคอุตสาหกรรม (${climate.co2PreIndustrial.value} ppm)`, co2: climate.co2PreIndustrial.value },
  { id: 'now', name: `ปัจจุบัน (${climate.co2Current.value} ppm)`, co2: climate.co2Current.value! },
  { id: 'double', name: `2 เท่าของก่อนยุคอุตสาหกรรม (${climate.co2PreIndustrial.value * 2} ppm)`, co2: climate.co2PreIndustrial.value * 2 },
];
export const presetTemp = (i: number) => (PRESETS[i].co2 === 0 ? noGreenhouseTemp() : equilibriumTemp(PRESETS[i].co2));
export const presetAnswer = (i: number) => String(Math.round(presetTemp(i)));
export const TEMP_CHOICES = () => [...new Set([...PRESETS.map((_, i) => Math.round(presetTemp(i))), 0, 25])].sort((a, b) => a - b).map(String);

export const CO2 = parseCo2(co2Text);
export const TEMP = parseGistemp(tempText);
export const LAST_YEAR = Math.min(CO2[CO2.length - 1][0], TEMP[TEMP.length - 1][0]);
const at = (rows: [number, number][], y: number) => rows.find(([yr]) => yr === y)![1];
export const TREND_CHOICES = ['เพิ่มขึ้น', 'ลดลง', 'ค่อนข้างคงที่'];
function trend(rows: [number, number][]): string {
  const n = 10;
  const mean = (r: [number, number][]) => r.reduce((a, [, v]) => a + v, 0) / r.length;
  const d = mean(rows.slice(-n)) - mean(rows.slice(0, n));
  return Math.abs(d) < 0.05 * Math.abs(mean(rows.slice(0, n)) || 1) ? TREND_CHOICES[2] : d > 0 ? TREND_CHOICES[0] : TREND_CHOICES[1];
}
const CO2_YEARS = [1960, 1990, 2010, LAST_YEAR];
const ANOMALY_OFFSETS = [-1, -0.6, 0, 1];
export const DATA_ROWS = [
  { id: 'co2last', name: `CO₂ ปี ${LAST_YEAR} (ppm)`, choices: () => CO2_YEARS.map((y) => String(Math.round(at(CO2, y)))), answer: () => String(Math.round(at(CO2, LAST_YEAR))) },
  { id: 'co2trend', name: 'แนวโน้ม CO₂ ตั้งแต่ปี 1959', choices: () => TREND_CHOICES, answer: () => trend(CO2) },
  { id: 'templast', name: `อุณหภูมิโลกปี ${LAST_YEAR} สูงกว่าค่าเฉลี่ยปี 1951–1980 (°C)`, choices: () => ANOMALY_OFFSETS.map((o) => (at(TEMP, LAST_YEAR) + o).toFixed(2)), answer: () => at(TEMP, LAST_YEAR).toFixed(2) },
  { id: 'temptrend', name: 'แนวโน้มอุณหภูมิโลกตั้งแต่ปี 1880', choices: () => TREND_CHOICES, answer: () => trend(TEMP) },
];
export const SOURCES = 'ที่มา: CO₂ — NOAA Global Monitoring Laboratory, Mauna Loa (ค่าเฉลี่ยรายปี) · อุณหภูมิ — NASA GISS GISTEMP v4 (ค่าเฉลี่ยรายปี เทียบกับค่าเฉลี่ยปี 1951–1980) · ดาวน์โหลด 3 พ.ย. 2569';

// ── My Footprint ───────────────────────────────────────────
/** A made-up student's week for the recorded part; students then try their own. */
export const EXAMPLE = { acHours: 3, fanHours: 6, mode: 'motorcycle' as const, km: 8 };
const AP = climate.appliances;
const round1 = (x: number) => Math.round(x * 10) / 10;
export function exampleKg(): { ac: number; fan: number; travel: number; total: number; pledge: number } {
  const ac = applianceWeekKg(AP.airConditioner.value, EXAMPLE.acHours)!;
  const fan = applianceWeekKg(AP.fan.value, EXAMPLE.fanHours)!;
  const travel = travelWeekKg(EXAMPLE.mode, EXAMPLE.km)!;
  return { ac: round1(ac), fan: round1(fan), travel: round1(travel), total: round1(ac + fan + travel), pledge: round1(applianceWeekKg(AP.airConditioner.value, 1)!) };
}
export const FOOT_ROWS = [
  { id: 'ac', name: `เครื่องปรับอากาศ วันละ ${EXAMPLE.acHours} ชม.` },
  { id: 'fan', name: `พัดลม วันละ ${EXAMPLE.fanHours} ชม.` },
  { id: 'travel', name: `ซ้อนรถจักรยานยนต์ไปกลับโรงเรียน ${EXAMPLE.km} km` },
  { id: 'total', name: 'รวมทั้งสัปดาห์' },
  { id: 'pledge', name: 'ถ้าลดเครื่องปรับอากาศวันละ 1 ชม. ลดได้' },
] as const;
export const KG_CHOICES = () => {
  const e = exampleKg();
  return [...new Set([e.ac, e.fan, e.travel, e.total, e.pledge, round1(e.ac * 2), round1(e.total * 2)])].sort((a, b) => a - b).map((v) => v.toFixed(1));
};

/** Every answer cell a quiz item may quote: "<table>/<row>/<column>" → the right value. */
export function answerCells(station: string): Record<string, string> {
  const out: Record<string, string> = {};
  if (station === 'storm-builder') {
    STAGES.forEach((s, i) => { out[`thunder/${s.id}/air`] = STAGE_ANSWERS[i].air; out[`thunder/${s.id}/rain`] = STAGE_ANSWERS[i].rain; });
    for (const t of SEA_TRIALS) out[`cyclone/${t.id}/forms`] = formAnswer(t.sst);
    for (const w of WIND_STOPS) out[`growth/w${w}/cat`] = categoryAnswer(w);
    for (const f of FACT_ROWS) out[`facts/${f.id}/value`] = f.answer;
  } else if (station === 'greenhouse-earth') {
    PRESETS.forEach((p, i) => { out[`co2/${p.id}/temp`] = presetAnswer(i); });
    for (const r of DATA_ROWS) out[`data/${r.id}/value`] = r.answer();
  } else if (station === 'my-footprint') {
    const e = exampleKg();
    for (const r of FOOT_ROWS) out[`foot/${r.id}/kg`] = e[r.id].toFixed(1);
  }
  return out;
}
