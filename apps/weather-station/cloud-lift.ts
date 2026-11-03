// Weather Station station 5 — Cloud Lift (PLAN §10.5): wind pushes a parcel of air up a 3 km mountain.
// It cools about 10 °C per km until it reaches its dew point (the cloud base), then a cloud forms and it
// cools more slowly. Two runs: drier air (dew point 18 °C) and moister air (dew point 26 °C).
import { formatNumber, h, mountStation, s, type QuizItem, type StationAsk } from '@shared/index';
import { weather } from '@shared/constants';
import { cloudBase, mountainCloud, parcelTemp } from '@shared/physics/weather';
import quiz from '@content/quiz/U6C1-L5.json';
import { BASE_CHOICES, BASE_TEMP_CHOICES, RAIN_CHOICES, RUNS, runAnswers } from './answers';

export const CLOUD_LIFT = { id: 'cloud-lift', title: 'เมฆและฝน', lesson: 'U6C1-L5' };
const SPEED = Number(new URLSearchParams(location.search).get('speed')) || 1;
const TOP = weather.cloudModel.mountainTopM.value;
const RISE = 8; // seconds on screen for the climb
const yOf = (m: number) => 186 - (m / TOP) * 160;
const xOf = (m: number) => 40 + (m / TOP) * 200;

export function mountCloudLift(root: HTMLElement, lab: string, home: string): void {
  mountStation<{ run: number; done: boolean[] }>({
    ...CLOUD_LIFT,
    storeKey: 'ws:cloud-lift:v1',
    quiz: quiz.items as unknown as QuizItem[],
    modelNote: `แบบจำลองอย่างง่ายจาก constants: อากาศยกตัวเย็นลงประมาณ ${weather.cloudModel.dryLapseRate.value} °C ต่อ 1 km จนถึงฐานเมฆ (สูงประมาณ ${weather.cloudModel.cloudBaseFactor.value} × (อุณหภูมิ − จุดน้ำค้าง) เมตร) เหนือฐานเมฆเย็นลงช้าลง ประมาณ ${weather.cloudModel.moistLapseRate.value} °C ต่อ 1 km กฎ "เมฆหนาอย่างน้อย ${formatNumber(weather.cloudModel.rainThicknessM.value)} m จึงมีฝน" เป็นกฎอย่างง่ายเพื่อการเรียนรู้ ของจริงฝนขึ้นกับหลายปัจจัย`,
    tables: [{
      key: 'runs', caption: 'ตารางบันทึกผล อากาศที่ผิวพื้น 30 °C ถูกลมพัดขึ้นภูเขาสูง 3,000 m', rowHead: 'อากาศ',
      rows: RUNS.map((r) => ({ id: r.id, name: r.name })),
      columns: [{ key: 'base', label: 'ฐานเมฆสูง (m)' }, { key: 'baseTemp', label: 'อุณหภูมิที่ฐานเมฆ (°C)' }, { key: 'rain', label: 'ฝน' }],
    }],
    initial: () => ({ run: 0, done: [false, false] }),
    build(ctx) {
      let rising = false;
      let t = 0;
      const title = h('p', { className: 'scene-title' });
      const svg = s('svg', { viewBox: '0 0 340 210', class: 'scene-svg', role: 'img' });
      const btn = h('button', { type: 'button', className: 'btn warn small', onclick: () => press() });
      const clock = h('p', { className: 'clock' });
      const bench = h('section', { className: 'bench xbench', 'aria-label': 'โต๊ะทดลอง' }, title, h('div', { className: 'scene-stage' }, svg), h('div', { className: 'bench-controls' }, btn, clock));
      const runDone = (i: number) => ['base', 'baseTemp', 'rain'].every((c) => ctx.has('runs', RUNS[i].id, c));

      function press(): void {
        if (ctx.st.done[ctx.st.run] && runDone(ctx.st.run) && ctx.st.run < RUNS.length - 1) ctx.st.run += 1;
        rising = true;
        t = 0;
        ctx.save();
        ctx.refresh();
      }

      const asks: StationAsk[] = RUNS.flatMap((r, i): StationAsk[] => {
        const a = runAnswers(i);
        const ready = () => ctx.st.run === i && ctx.st.done[i] && !rising;
        const wait = () => (rising ? 'อากาศกำลังลอยขึ้นตามภูเขา… ดูเทอร์โมมิเตอร์และความสูง' : `กด "${btn.textContent}"`);
        return [
          { table: 'runs', row: r.id, col: 'base', label: `ฐานเมฆ ${r.name}`, choices: () => BASE_CHOICES, answer: () => a.base, ready,
            todo: 'ดูเส้นประฐานเมฆบนแกนความสูง เมฆเริ่มเกิดที่ความสูงกี่เมตร เลือกในตาราง', wait, waitCue: () => (rising ? null : btn) },
          { table: 'runs', row: r.id, col: 'baseTemp', label: `อุณหภูมิที่ฐานเมฆ ${r.name}`, choices: () => BASE_TEMP_CHOICES, answer: () => a.baseTemp, ready,
            todo: 'อ่านอุณหภูมิของก้อนอากาศที่ฐานเมฆ (ป้ายข้างเส้นประ) เลือกในตาราง', wait: '' },
          { table: 'runs', row: r.id, col: 'rain', label: `ฝน ${r.name}`, choices: () => RAIN_CHOICES, answer: () => a.rain, ready,
            todo: 'ที่ยอดเขา เมฆหนาจนมีฝนตกหรือไม่ เลือกในตาราง', wait: '' },
        ];
      });

      return {
        bench,
        asks,
        chips: () => RUNS.map((r, i) => ({ name: i === 0 ? 'ชื้นน้อย' : 'ชื้นมาก', done: runDone(i), now: ctx.st.run === i })),
        allDoneLabel: 'บันทึกครบ 2 ครั้งแล้ว',
        doneText: 'บันทึกครบแล้ว ✓ กด "ไปตอบคำถาม"',
        tick(dt) {
          if (!rising) return false;
          t += dt * SPEED;
          if (t >= RISE) {
            rising = false;
            ctx.st.done[ctx.st.run] = true;
            ctx.save();
          }
          return true;
        },
        render() {
          const i = ctx.st.run;
          const r = RUNS[i];
          const c = mountainCloud(r.t, r.td);
          const base = cloudBase(r.t, r.td);
          const f = ctx.st.done[i] && !rising ? 1 : rising ? Math.min(1, t / RISE) : 0;
          const z = TOP * f;
          const tp = parcelTemp(r.t, r.td, z);
          title.textContent = `ครั้งที่ ${i + 1}: ${r.name}`;
          const parts: SVGElement[] = [
            s('rect', { x: 0, y: 0, width: 340, height: 210, fill: '#e3f0f6' }),
            s('polygon', { points: `20,190 ${xOf(TOP)},${yOf(TOP)} 330,190`, fill: '#8fae6f', stroke: '#5d7a45' }),
          ];
          // Height axis.
          for (let m = 0; m <= TOP; m += 500) {
            parts.push(s('line', { x1: 6, x2: 12, y1: yOf(m), y2: yOf(m), stroke: 'var(--ink-2)' }));
            parts.push(s('text', { x: 14, y: yOf(m) + 4, 'font-size': 9, fill: '#56646a' }, formatNumber(m)));
          }
          // Cloud from the base up to where the parcel has reached.
          // The cloud hugs the slope as puffs, from the base up to where the parcel has reached.
          if (z > base) {
            for (let m = base; m <= z; m += 120) {
              const r = 13 + ((m / 120) % 3) * 3;
              parts.push(s('circle', { cx: xOf(m) - 6, cy: yOf(m) - 14, r, fill: '#ffffff', stroke: '#c3ced5', 'stroke-width': 0.8 }));
            }
          }
          if (z >= base && f > 0) {
            parts.push(s('line', { x1: 0, x2: 340, y1: yOf(base), y2: yOf(base), stroke: '#0e6b70', 'stroke-dasharray': '5 4', 'stroke-width': 1.5 }));
            parts.push(s('text', { x: 336, y: yOf(base) - 4, 'text-anchor': 'end', 'font-size': 11, 'font-weight': 600, fill: '#0e6b70' }, `ฐานเมฆ ${formatNumber(Math.round(base))} m · ${formatNumber(c.baseTemp, { decimals: 0 })} °C`));
          }
          if (f >= 1 && c.rain) for (let k = 0; k < 10; k++) parts.push(s('line', { x1: xOf(TOP) - 40 + k * 9, y1: yOf(TOP) + 30 + (k % 3) * 8, x2: xOf(TOP) - 43 + k * 9, y2: yOf(TOP) + 40 + (k % 3) * 8, stroke: '#2e6e94', 'stroke-width': 2 }));
          // The parcel and its thermometer.
          const x = xOf(z);
          const y = yOf(z) - 12;
          parts.push(s('circle', { cx: x, cy: y, r: 9, fill: z > base ? '#ffffff' : '#cfe6ee', stroke: 'var(--ink)', 'stroke-width': 1.5 }));
          parts.push(s('rect', { x: x + 12, y: y - 10, width: 48, height: 18, rx: 4, fill: 'var(--card)', stroke: 'var(--ink-2)' }));
          parts.push(s('text', { x: x + 36, y: y + 3, 'text-anchor': 'middle', 'font-size': 12, 'font-weight': 600, fill: 'var(--ink)' }, `${formatNumber(tp, { decimals: 0 })} °C`));
          svg.replaceChildren(...parts);
          svg.setAttribute('aria-label', `ก้อนอากาศสูง ${formatNumber(Math.round(z))} เมตร อุณหภูมิ ${formatNumber(tp, { decimals: 0 })} องศาเซลเซียส`);
          clock.textContent = `สูง ${formatNumber(Math.round(z / 50) * 50)} m`;
          const canNext = ctx.st.done[i] && runDone(i) && i < RUNS.length - 1;
          btn.textContent = canNext ? '🌬 ครั้งที่ 2: อากาศชื้นมาก' : ctx.st.done[i] ? 'ลมพัดขึ้นยอดเขาแล้ว' : rising ? '🌬 อากาศกำลังลอยขึ้น' : '🌬 ลมพัดอากาศขึ้นภูเขา';
          btn.disabled = rising || (ctx.st.done[i] && !canNext);
        },
      };
    },
  }, root, lab, home);
}
