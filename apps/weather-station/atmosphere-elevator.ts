// Weather Station station 1 — Atmosphere Elevator (PLAN §10.1): an elevator rides up through the four
// layers, stopping at the top of each. The temperature curve draws itself beside the elevator on the same
// height scale; students record how temperature changes in each layer and what is found there.
import { createLineChart, formatNumber, h, mountStation, s, type QuizItem, type StationAsk } from '@shared/index';
import { LAYERS, atmosphereAt, layerAt } from '@shared/physics/weather';
import quiz from '@content/quiz/U6C1-L1.json';
import { FOUND, FOUND_CHOICES, REF_OBJECTS, STOPS_KM, TREND_CHOICES, layerTrend } from './answers';

export const ATMOSPHERE_ELEVATOR = { id: 'atmosphere-elevator', title: 'ชั้นบรรยากาศ', lesson: 'U6C1-L1' };
const SPEED = Number(new URLSearchParams(location.search).get('speed')) || 1;
/** Seconds each ride between stops takes on screen. */
const RIDE = 4;
const CHART_TOP = 120;

/**
 * Height scale of the picture: each layer gets its own stretch of screen (the thin troposphere is drawn
 * taller than its share), linear inside a layer so the curve keeps its shape there. Marked on screen.
 */
const SCALE: [number, number][] = [[0, 292], [12, 228], [50, 150], [85, 82], [100, 66], [500, 14]];
function yOf(km: number): number {
  for (let i = 1; i < SCALE.length; i++) {
    const [z0, y0] = SCALE[i - 1];
    const [z1, y1] = SCALE[i];
    if (km <= z1 || i === SCALE.length - 1) return y0 + ((Math.min(km, z1) - z0) / (z1 - z0)) * (y1 - y0);
  }
  return SCALE[SCALE.length - 1][1];
}
/** Temperature axis of the curve: −100 to 100 °C across x 150–268 (hotter values run off the right edge). */
const X0 = 150;
const X1 = 268;
const xOf = (t: number) => X0 + ((Math.max(-100, Math.min(100, t)) + 100) / 200) * (X1 - X0);
const LAYER_FILL: Record<string, string> = { troposphere: '#cfe6ee', stratosphere: '#dcdff2', mesosphere: '#e8def0', thermosphere: '#f3e3d8' };
const shortName = (n: string) => n.replace(/\s*\(.*\)$/, '');

export function mountAtmosphereElevator(root: HTMLElement, lab: string, home: string): void {
  mountStation<{ km: number; stop: number }>({
    ...ATMOSPHERE_ELEVATOR,
    storeKey: 'ws:atmosphere-elevator:v1',
    quiz: quiz.items as unknown as QuizItem[],
    modelNote: 'อุณหภูมิและความกดอากาศมาจากบรรยากาศมาตรฐาน (ค่าเฉลี่ย) ใน constants ของจริงต่างไปตามสถานที่และเวลา ค่าเหนือ 86 km เป็นค่าประมาณ ในภาพ แต่ละชั้นใช้มาตราส่วนความสูงต่างกัน (โทรโพสเฟียร์บางมากจึงวาดให้สูงกว่าจริง และส่วนเหนือ 100 km ถูกย่อ) ขอบเขตชั้นเป็นค่าโดยประมาณ (โทรโพสเฟียร์เหนือเส้นศูนย์สูตรหนากว่าที่ขั้วโลก) อุณหภูมิในเทอร์โมสเฟียร์สูงมาก แต่อากาศเบาบางมากจนแทบไม่ถ่ายโอนความร้อนให้สิ่งที่อยู่ในชั้นนั้น',
    tables: [{
      key: 'layers', caption: 'ตารางบันทึกผล', rowHead: 'ชั้นบรรยากาศ',
      rows: LAYERS.map((l) => ({ id: l.id, name: l.name })),
      columns: [{ key: 'trend', label: 'อุณหภูมิเมื่อสูงขึ้น' }, { key: 'found', label: 'สิ่งที่พบในชั้นนี้' }],
    }],
    initial: () => ({ km: 0, stop: 0 }),
    build(ctx) {
      let riding = false;
      const svg = s('svg', { viewBox: '0 0 340 304', class: 'scene-svg', role: 'img' });
      const upBtn = h('button', { type: 'button', className: 'btn warn small', onclick: () => { riding = true; ctx.refresh(); } }, '⬆ ขึ้นต่อ');
      const clock = h('p', { className: 'clock' });
      const bench = h('section', { className: 'bench xbench', 'aria-label': 'โต๊ะทดลอง' },
        h('p', { className: 'scene-title' }, 'ลิฟต์บรรยากาศ: เส้นสีแดงคืออุณหภูมิตามความสูง'),
        h('div', { className: 'scene-stage' }, svg),
        h('div', { className: 'bench-controls' }, upBtn, clock));
      // The quiz figure keeps the ordinary graph (linear height, 0–120 km).
      const CHART = { xLabel: 'อุณหภูมิ (°C)', yLabel: 'ความสูง (km)', xMin: -100, xMax: 100, yMin: 0, yMax: CHART_TOP, xTicks: [-100, -50, 0, 50, 100], yTicks: [0, 20, 40, 60, 80, 100, 120] };
      const profile = (top: number) => {
        const pts: [number, number][] = [];
        for (let z = 0; z <= Math.min(top, CHART_TOP); z += 0.5) pts.push([atmosphereAt(z).t, z]);
        return pts;
      };

      const reached = (i: number) => ctx.st.stop > i && !riding;
      const asks: StationAsk[] = LAYERS.flatMap((l, i): StationAsk[] => [
        {
          table: 'layers', row: l.id, col: 'trend', label: `อุณหภูมิเมื่อสูงขึ้นใน${l.name}`,
          choices: () => TREND_CHOICES, answer: () => layerTrend(i), ready: () => reached(i),
          todo: `ผ่าน${l.name}แล้ว ดูเส้นสีแดงในแถบ${l.name}: อุณหภูมิเปลี่ยนอย่างไรเมื่อสูงขึ้น เลือกในตาราง`,
          wait: () => (riding ? 'ลิฟต์กำลังขึ้น… ดูเส้นอุณหภูมิ' : `กด "⬆ ขึ้นต่อ" ขึ้นไปจนสุด${l.name}`),
          waitCue: () => (riding ? null : upBtn),
        },
        {
          table: 'layers', row: l.id, col: 'found', label: `สิ่งที่พบใน${l.name}`,
          choices: () => FOUND_CHOICES, answer: () => FOUND[l.id].text, ready: () => reached(i),
          todo: `ดูป้ายด้านซ้าย: ใน${l.name}พบอะไร เลือกในตาราง`,
          wait: '',
        },
      ]);
      /** Keep the elevator at a stop until the layer just passed is recorded. */
      const asksWaiting = () => {
        const i = ctx.st.stop - 1;
        return i >= 0 && !ctx.has('layers', LAYERS[i].id, 'found');
      };

      return {
        bench,
        asks,
        chips: () => LAYERS.map((l, i) => ({ name: l.name, done: ctx.has('layers', l.id, 'found'), now: ctx.st.stop === i })),
        allDoneLabel: 'บันทึกครบ 4 ชั้นแล้ว',
        figure: () => {
          const c = createLineChart(CHART);
          c.setSeries([{ name: 'อุณหภูมิตามความสูง', points: profile(CHART_TOP), marks: [] }]);
          return c.el;
        },
        doneText: 'บันทึกครบแล้ว ✓ กด "ไปตอบคำถาม"',
        tick(dt) {
          if (!riding) return false;
          const from = ctx.st.stop === 0 ? 0 : STOPS_KM[ctx.st.stop - 1];
          const to = STOPS_KM[ctx.st.stop];
          ctx.st.km = Math.min(to, ctx.st.km + ((to - from) / RIDE) * dt * SPEED);
          if (ctx.st.km >= to) {
            riding = false;
            ctx.st.stop += 1;
            ctx.save();
          }
          return true;
        },
        render() {
          const km = ctx.st.km;
          const a = atmosphereAt(km);
          const parts: SVGElement[] = [];
          // Layer bands across the whole picture, names at the right.
          let lo = 0;
          LAYERS.forEach((l, i) => {
            const hi = STOPS_KM[i] === 400 ? 500 : STOPS_KM[i];
            parts.push(s('rect', { x: 26, y: yOf(hi), width: 312, height: yOf(lo) - yOf(hi), fill: LAYER_FILL[l.id], stroke: '#9aa5a9', 'stroke-width': 0.6 }));
            parts.push(s('text', { x: 336, y: yOf(hi) + 13, 'text-anchor': 'end', 'font-size': 10.5, 'font-weight': 600, fill: '#1f2a2e' }, l.name));
            lo = hi;
          });
          // Height ticks at the left (scale changes between layers).
          for (const t of [0, 12, 50, 85, 100, 500]) {
            parts.push(s('text', { x: 22, y: yOf(t) + 4, 'text-anchor': 'end', 'font-size': 9.5, fill: 'var(--ink-2)' }, `${t}`));
          }
          parts.push(s('text', { x: 2, y: 302, 'font-size': 9, fill: 'var(--ink-2)' }, 'km'));
          // Temperature axis under the curve.
          for (const t of [-100, 0, 100]) {
            parts.push(s('line', { x1: xOf(t), x2: xOf(t), y1: 292, y2: 296, stroke: 'var(--ink-2)' }));
            parts.push(s('text', { x: xOf(t), y: 303, 'text-anchor': 'middle', 'font-size': 8.5, fill: 'var(--ink-2)' }, `${t} °C`));
          }
          parts.push(s('line', { x1: xOf(0), x2: xOf(0), y1: 292, y2: 14, stroke: '#9aa5a9', 'stroke-dasharray': '2 3' }));
          // The curve up to the elevator.
          const pts: string[] = [];
          for (let z = 0; z <= km; z += km > 100 ? 2 : 0.5) pts.push(`${xOf(atmosphereAt(z).t)},${yOf(z)}`);
          pts.push(`${xOf(a.t)},${yOf(km)}`);
          parts.push(s('polyline', { points: pts.join(' '), fill: 'none', stroke: '#b4441c', 'stroke-width': 2.5 }));
          if (km > 115) parts.push(s('text', { x: X1 + 2, y: yOf(140), 'font-size': 9, fill: '#b4441c' }, '→ สูงถึงราว 700 °C'));
          // Things found at each height, shown once the elevator has passed them.
          for (const o of REF_OBJECTS) {
            if (o.km > km + 0.01) continue;
            const y = yOf(o.km);
            parts.push(s('circle', { cx: 32, cy: y, r: 2.8, fill: 'var(--glass)' }));
            parts.push(s('text', { x: 38, y: y + 3.5, 'font-size': 9.5, fill: '#1f2a2e' }, shortName(o.name)));
          }
          // The elevator: a marker line at its height.
          const ey = yOf(km);
          parts.push(s('line', { x1: 26, x2: 338, y1: ey, y2: ey, stroke: 'var(--warn)', 'stroke-width': 1, 'stroke-dasharray': '4 3' }));
          parts.push(s('rect', { x: 128, y: ey - 9, width: 18, height: 18, rx: 4, fill: 'var(--warn)', stroke: 'var(--ink)' }));
          parts.push(s('text', { x: 137, y: ey + 4, 'text-anchor': 'middle', 'font-size': 10, fill: '#fff' }, '⬆'));
          svg.replaceChildren(...parts);
          const layer = LAYERS.find((l) => l.id === layerAt(km))!;
          const p = a.p >= 1 ? formatNumber(a.p, { decimals: 0 }) : formatNumber(a.p, { sig: 2 });
          svg.setAttribute('aria-label', `ลิฟต์ที่ความสูง ${formatNumber(km, { decimals: 0 })} กิโลเมตร ${layer.name} อุณหภูมิ ${formatNumber(a.t, { decimals: 0 })} องศาเซลเซียส`);
          clock.textContent = `${formatNumber(km, { decimals: km < 20 ? 1 : 0 })} km · ${formatNumber(a.t, { decimals: 0 })} °C · ${p} hPa`;
          const done = ctx.st.stop >= STOPS_KM.length;
          upBtn.disabled = riding || done || asksWaiting();
          upBtn.textContent = done ? 'ถึงสถานีอวกาศแล้ว' : riding ? '⬆ กำลังขึ้น' : '⬆ ขึ้นต่อ';
        },
      };
    },
  }, root, lab, home);
}
