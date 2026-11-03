// What each Heat Transfer Studio station accepts as right answers, computed from the physics models
// (no DOM), so the labs and the quiz unit test agree (PLAN §9, D-045).
import { heat } from '@shared/constants';
import { mixtureTemperature } from '@shared/physics/heat';
import { thermometerReading } from '@shared/reading';
import {
  BOX, boxHeatIn, canRate, makeRod, meltMinutes, rodName, rodTempAt, stepRod, wallResistance,
  type BoxLayer, type RodMaterial,
} from '@shared/physics/transfer';

// ── Conduction Rod ─────────────────────────────────────────
export const RODS: RodMaterial[] = ['copper', 'aluminium', 'iron', 'wood'];
export const WAX_AT = [0.03, 0.06, 0.09, 0.12, 0.15];
export const ROD_RUN = { seconds: 600, tAir: 30, tHot: heat.phasePoints.waterBoiling.value, wax: heat.phasePoints.waxDrop.value };
export const ORDER_CHOICES = ['1', '2', '3', 'ไม่หลุด'];
export const KIND_CHOICES = ['ตัวนำความร้อน', 'ฉนวนความร้อน'];

/** Seconds until each wax bead drops (Infinity: not within the run), from the same model the lab draws. */
export function waxDropTimes(m: RodMaterial): number[] {
  const rod = makeRod(m, ROD_RUN.tAir);
  const out = WAX_AT.map(() => Infinity);
  for (let s = 1; s <= ROD_RUN.seconds; s++) {
    stepRod(rod, 1, ROD_RUN.tHot, ROD_RUN.tAir);
    WAX_AT.forEach((x, i) => { if (out[i] === Infinity && rodTempAt(rod, x) >= ROD_RUN.wax) out[i] = s; });
  }
  return out;
}

export function rodAnswers(): Record<RodMaterial, { order: string; kind: string }> {
  const first = RODS.map((m) => ({ m, t: waxDropTimes(m)[0] }));
  const ranked = first.filter((x) => Number.isFinite(x.t)).sort((a, b) => a.t - b.t);
  const out = {} as Record<RodMaterial, { order: string; kind: string }>;
  for (const { m, t } of first) {
    out[m] = Number.isFinite(t)
      ? { order: String(ranked.findIndex((x) => x.m === m) + 1), kind: 'ตัวนำความร้อน' }
      : { order: 'ไม่หลุด', kind: 'ฉนวนความร้อน' };
  }
  return out;
}
export { rodName };

// ── Convection Pot ─────────────────────────────────────────
export const POT_ROWS = [
  { id: 'bottom', name: 'ให้ความร้อนที่ก้นภาชนะ' },
  { id: 'top', name: 'ให้ความร้อนที่ผิวน้ำด้านบน' },
] as const;
export const HOT_CHOICES = ['ลอยขึ้น', 'อยู่ด้านบน ไม่จมลง', 'จมลงก้นภาชนะ'];
export const FLOW_CHOICES = ['หมุนวนทั่วภาชนะ', 'แทบไม่หมุนวน'];
export const POT_ANSWERS = {
  bottom: { hot: 'ลอยขึ้น', flow: 'หมุนวนทั่วภาชนะ' },
  top: { hot: 'อยู่ด้านบน ไม่จมลง', flow: 'แทบไม่หมุนวน' },
};

// ── Radiation Cans ─────────────────────────────────────────
export const CANS = [
  { id: 'black', name: 'ดำด้าน', abs: heat.absorptivity.matteBlack.value, emit: heat.emissivity.matteBlack.value, fill: '#2a2f31' },
  { id: 'red', name: 'แดง', abs: heat.absorptivity.red.value, emit: heat.emissivity.red.value, fill: '#b03a2e' },
  { id: 'white', name: 'ขาว', abs: heat.absorptivity.white.value, emit: heat.emissivity.white.value, fill: '#f4f2ec' },
  { id: 'silver', name: 'เงินขัดเงา', abs: heat.absorptivity.polishedSilver.value, emit: heat.emissivity.polishedSilver.value, fill: '#c9cfd2' },
] as const;
export const CAN_RUN = { seconds: 600, tAir: 30, lamp: 600, hot: 80 };
export const RANK_CHOICES = ['1', '2', '3', '4'];
/** Lamp off: painted cans of any colour cool about equally fast, so students sort fast/slow, not rank. */
export const COOL_CHOICES = ['เย็นลงเร็ว', 'เย็นลงช้า'];

export function canTemps(mode: 'absorb' | 'emit', seconds = CAN_RUN.seconds): number[] {
  return CANS.map((c) => {
    let t = mode === 'absorb' ? CAN_RUN.tAir : CAN_RUN.hot;
    for (let s = 0; s < seconds; s++) t += canRate(t, c.abs, c.emit, mode === 'absorb' ? CAN_RUN.lamp : 0, CAN_RUN.tAir);
    return t;
  });
}

/** Under the lamp: rank 1 = hottest. */
export function canRanks(): string[] {
  const t = canTemps('absorb');
  const order = [...t.keys()].sort((a, b) => t[b] - t[a]);
  return CANS.map((_, i) => String(order.indexOf(i) + 1));
}

/** Lamp off: each can cooled fast or slow, split halfway between the biggest and the smallest drop. */
export function canCooling(): string[] {
  const drop = canTemps('emit').map((t) => CAN_RUN.hot - t);
  const mid = (Math.max(...drop) + Math.min(...drop)) / 2;
  return drop.map((d) => (d > mid ? COOL_CHOICES[0] : COOL_CHOICES[1]));
}

// ── Thermal Mixer ──────────────────────────────────────────
export const MIXES = [
  { id: 'mix1', name: 'น้ำ 200 g 80 °C + น้ำ 300 g 20 °C', a: { sub: 'water', m: 0.2, t: 80 }, b: { sub: 'water', m: 0.3, t: 20 } },
  { id: 'mix2', name: 'น้ำ 100 g 70 °C + น้ำ 100 g 30 °C', a: { sub: 'water', m: 0.1, t: 70 }, b: { sub: 'water', m: 0.1, t: 30 } },
  { id: 'mix3', name: 'เหล็ก 100 g 100 °C + น้ำ 200 g 20 °C', a: { sub: 'iron', m: 0.1, t: 100 }, b: { sub: 'water', m: 0.2, t: 20 } },
] as const;
export const Q_CHOICES = ['เท่ากัน', 'Q สูญเสียมากกว่า', 'Q ได้รับมากกว่า'];
const c = (sub: string) => heat.specificHeat[sub as 'water'].value;

export function mixFinal(i: number): number {
  const x = MIXES[i];
  return mixtureTemperature([{ m: x.a.m, c: c(x.a.sub), t: x.a.t }, { m: x.b.m, c: c(x.b.sub), t: x.b.t }]);
}
export function mixReading(i: number): number {
  return thermometerReading(mixFinal(i));
}
export function mixHeat(i: number): { lost: number; gained: number } {
  const x = MIXES[i];
  const t = mixFinal(i);
  return { lost: x.a.m * c(x.a.sub) * (x.a.t - t), gained: x.b.m * c(x.b.sub) * (t - x.b.t) };
}

// ── Cool Box Designer ──────────────────────────────────────
export interface Design { layers: { material: BoxLayer; thickness: number }[]; outside: 'dark' | 'white' | 'foil'; sun: boolean }
export const OUTSIDE = {
  dark: { name: 'สีเข้ม', abs: heat.absorptivity.red.value },
  white: { name: 'สีขาว', abs: heat.absorptivity.white.value },
  foil: { name: 'ฟอยล์อะลูมิเนียม', abs: heat.absorptivity.polishedSilver.value },
};
export const LAYER_OPTIONS: { id: string; name: string; material: BoxLayer; thickness: number; coins: number }[] = [
  { id: 'card', name: 'กระดาษลัง 5 mm', material: 'cardboard', thickness: 0.005, coins: 1 },
  { id: 'foam1', name: 'โฟม 1 cm', material: 'eps', thickness: 0.01, coins: 2 },
  { id: 'foam2', name: 'โฟม 2 cm', material: 'eps', thickness: 0.02, coins: 4 },
  { id: 'cloth', name: 'ผ้า 5 mm', material: 'cotton', thickness: 0.005, coins: 1 },
  { id: 'air', name: 'ช่องอากาศปิด 1 cm', material: 'stillAir', thickness: 0.01, coins: 1 },
];
export const BUDGET = 8;
export const FIXED_DESIGNS: Design[] = [
  { layers: [{ material: 'cardboard', thickness: 0.005 }], outside: 'dark', sun: true },
  { layers: [{ material: 'cardboard', thickness: 0.005 }, { material: 'eps', thickness: 0.02 }], outside: 'dark', sun: true },
];
export const T_OUTSIDE = 32;

/** Minutes until the ice melts, rounded to 5 minutes as read off the clock. */
export function designMinutes(d: Design): number {
  const r = wallResistance(d.layers);
  return Math.round(meltMinutes(boxHeatIn(r, T_OUTSIDE, 0, OUTSIDE[d.outside].abs, d.sun)) / 5) * 5;
}
export function minuteChoices(right: number): number[] {
  return [...new Set([right, right - 20, right + 20, right + 40].filter((v) => v > 0))].sort((a, b) => a - b).slice(0, 4);
}
export function compare(d: Design): string {
  const base = designMinutes(FIXED_DESIGNS[0]);
  const m = designMinutes(d);
  return m > base ? 'นานกว่า' : m < base ? 'เร็วกว่า' : 'เท่ากัน';
}
export const COMPARE_CHOICES = ['นานกว่า', 'เร็วกว่า', 'เท่ากัน'];
export { BOX };

/** Answer cells by station ("<table>/<row>/<col>" → value), for tests/unit/quiz.test.ts. */
export function answerCells(station: string): Record<string, string> {
  const out: Record<string, string> = {};
  if (station === 'conduction-rod') {
    const a = rodAnswers();
    for (const m of RODS) { out[`rods/${m}/order`] = a[m].order; out[`rods/${m}/kind`] = a[m].kind; }
  } else if (station === 'convection-pot') {
    for (const r of POT_ROWS) { out[`pot/${r.id}/hot`] = POT_ANSWERS[r.id].hot; out[`pot/${r.id}/flow`] = POT_ANSWERS[r.id].flow; }
  } else if (station === 'radiation-cans') {
    const ab = canRanks();
    const em = canCooling();
    CANS.forEach((can, i) => { out[`cans/${can.id}/absorb`] = ab[i]; out[`cans/${can.id}/emit`] = em[i]; });
  } else if (station === 'thermal-mixer') {
    MIXES.forEach((m, i) => { out[`mix/${m.id}/final`] = String(mixReading(i)); out[`mix/${m.id}/q`] = 'เท่ากัน'; });
  } else if (station === 'cool-box') {
    out['box/d1/time'] = String(designMinutes(FIXED_DESIGNS[0]));
    out['box/d2/time'] = String(designMinutes(FIXED_DESIGNS[1]));
    out['box/d2/compare'] = compare(FIXED_DESIGNS[1]);
  }
  return out;
}
