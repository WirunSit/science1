// Heat Transfer Studio station 4 — Thermal Mixer (PLAN §9.3, D-045): three mixes in turn. "เทผสม"
// brings A and B to the same temperature (shown easing in; the end value is the equilibrium formula),
// with bars for Q lost and Q gained that always stay equal. Students read the final temperature.
import {
  createLineChart, createScaleZoom, formatNumber, h, mountStation, readingOptions, s, type QuizItem, type StationAsk,
} from '@shared/index';
import { substanceName } from '@shared/constants';
import quiz from '@content/quiz/U5C2-L3.json';
import { MIXES, Q_CHOICES, mixFinal, mixHeat, mixReading } from './answers';

export const THERMAL_MIXER = { id: 'thermal-mixer', title: 'สมดุลความร้อน', lesson: 'U5C2-L3' };
const SETTLE = 6; // seconds of real time for the two temperatures to meet (visual time)
/** Eased progress 0 → 1 that reaches exactly 1 at SETTLE, so A and B read the same at the end. */
const ease = (t: number) => Math.min(1, (1 - Math.exp((-4 * t) / SETTLE)) / (1 - Math.exp(-4)));

export function mountThermalMixer(root: HTMLElement, lab: string, home: string): void {
  mountStation<Record<string, never>>({
    ...THERMAL_MIXER,
    storeKey: 'hts:thermal-mixer:v1',
    quiz: quiz.items as unknown as QuizItem[],
    modelNote: 'แบบจำลองนี้ถือว่าภาชนะเก็บความร้อนได้สมบูรณ์ ไม่มีความร้อนสูญเสียไปกับภาชนะและอากาศ Q สูญเสียจึงเท่ากับ Q ได้รับพอดี ของจริงอุณหภูมิสุดท้ายจะต่ำกว่าค่าที่คำนวณเล็กน้อย เวลาที่ใช้กว่าจะถึงสมดุลในภาพไม่ใช่เวลาจริง',
    tables: [{
      key: 'mix', caption: 'ตารางบันทึกผล', rowHead: 'การผสม',
      rows: MIXES.map((m) => ({ id: m.id, name: m.name })),
      columns: [{ key: 'final', label: 'อุณหภูมิสุดท้าย (°C)' }, { key: 'q', label: 'Q สูญเสีย กับ Q ได้รับ' }],
    }],
    initial: () => ({}),
    build(ctx) {
      let current = 0;
      let poured = false;
      let t = 0; // seconds since pouring
      const next = () => MIXES.findIndex((m) => !ctx.has('mix', m.id, 'q'));
      const temps = () => {
        const x = MIXES[current];
        const f = poured ? ease(t) : 0;
        const tf = mixFinal(current);
        return [x.a.t + (tf - x.a.t) * f, x.b.t + (tf - x.b.t) * f];
      };
      const pourBtn = h('button', { type: 'button', className: 'btn warn small', onclick: () => { poured = true; t = 0; ctx.refresh(); } }, '🫗 เทผสม');
      const zoom = createScaleZoom({ min: 0, max: 100, label: 'อุณหภูมิ B' });
      const svg = s('svg', { viewBox: '0 0 260 170', class: 'rig-svg', role: 'img' });
      const bars = h('div', { className: 'qbars' });
      const chart = createLineChart({ xLabel: 'เวลา', yLabel: 'อุณหภูมิ (°C)', xMin: 0, xMax: SETTLE, yMin: 0, yMax: 100, yTicks: [0, 20, 40, 60, 80, 100] });
      const title = h('p', { className: 'scene-title' });
      const bench = h('section', { className: 'bench pgbench', 'aria-label': 'โต๊ะทดลอง' },
        svg, zoom.el, bars, h('div', { className: 'bench-controls' }, title, pourBtn));
      const settled = () => poured && t >= SETTLE;

      const asks: StationAsk[] = MIXES.flatMap((m, i): StationAsk[] => [
        {
          table: 'mix', row: m.id, col: 'final', label: `อุณหภูมิสุดท้าย ${m.name}`,
          choices: () => readingOptions(mixReading(i), MIXES[i].b.t), answer: () => mixReading(i),
          ready: () => current === i && settled(),
          todo: `${m.name}: อุณหภูมิเท่ากันแล้ว อ่านเทอร์โมมิเตอร์ แล้วเลือกค่าในตาราง`,
          wait: () => (current === i && poured ? 'กำลังถ่ายโอนความร้อน… ดูกราฟอุณหภูมิของ A และ B' : `${m.name}: กด "🫗 เทผสม"`),
          waitCue: () => (current === i && poured ? null : pourBtn),
        },
        {
          table: 'mix', row: m.id, col: 'q', label: `Q สูญเสีย กับ Q ได้รับ ${m.name}`,
          choices: () => Q_CHOICES, answer: () => 'เท่ากัน', ready: () => current === i && settled(),
          todo: `${m.name}: เทียบแถบ Q สูญเสีย กับ Q ได้รับ แล้วเลือกในตาราง`,
          wait: '',
        },
      ]);

      return {
        bench,
        graph: chart.el,
        asks,
        chips: () => MIXES.map((m, i) => ({ name: `การผสมที่ ${i + 1}`, done: ctx.has('mix', m.id, 'q'), now: current === i })),
        allDoneLabel: 'บันทึกครบ 3 การผสมแล้ว',
        doneText: 'บันทึกครบแล้ว ✓ กด "ไปตอบคำถาม"',
        tick(dt) {
          const n = next();
          if (n >= 0 && n !== current) {
            current = n;
            poured = false;
            t = 0;
            return true; // next mix: redraw with the new cups and re-enable "เทผสม"
          }
          if (!poured || t >= SETTLE) return false;
          t = Math.min(SETTLE, t + dt);
          return true;
        },
        render() {
          const x = MIXES[current];
          const [ta, tb] = temps();
          const heat = mixHeat(current);
          const f = poured ? ease(t) : 0;
          title.textContent = `การผสมที่ ${current + 1}: ${x.name}`;
          const cup = (cx: number, label: string, temp: number, sub: string, m: number) => [
            s('path', { d: `M${cx - 40} 40 v90 a6 6 0 0 0 6 6 h68 a6 6 0 0 0 6 -6 v-90`, fill: 'none', stroke: 'var(--ink)', 'stroke-width': 2 }),
            sub === 'water'
              ? s('rect', { x: cx - 38, y: 70, width: 76, height: 64, fill: 'var(--temp-1)' })
              : s('rect', { x: cx - 16, y: 104, width: 32, height: 26, rx: 4, fill: '#8a9aa3', stroke: 'var(--ink)' }),
            s('text', { x: cx, y: 30, 'text-anchor': 'middle', 'font-size': 13, 'font-weight': 600, fill: 'var(--ink)' }, `${label}: ${substanceName(sub as 'water')} ${formatNumber(m * 1000)} g`),
            s('text', { x: cx, y: 158, 'text-anchor': 'middle', 'font-size': 14, fill: 'var(--ink)' }, `${formatNumber(temp, { decimals: 1 })} °C`),
          ];
          svg.replaceChildren(...cup(65, 'A', ta, x.a.sub, x.a.m), ...cup(195, 'B', tb, x.b.sub, x.b.m),
            s('text', { x: 130, y: 90, 'text-anchor': 'middle', 'font-size': 20, fill: 'var(--warn)' }, poured ? '→' : ''));
          svg.setAttribute('aria-label', `A ${formatNumber(ta, { decimals: 1 })} องศาเซลเซียส B ${formatNumber(tb, { decimals: 1 })} องศาเซลเซียส`);
          zoom.set(tb);
          const bar = (name: string, q: number, cls: string) => h('div', { className: 'qbar' },
            h('span', {}, name), h('span', { className: `qbar-track` }, h('span', { className: `qbar-fill ${cls}`, style: `width:${Math.round(f * 100)}%` })),
            h('span', {}, `${formatNumber(q * f, { decimals: 0 })} J`));
          bars.replaceChildren(bar('Q สูญเสีย (A)', heat.lost, 'lost'), bar('Q ได้รับ (B)', heat.gained, 'gained'));
          const pts = (from: number, to: number): [number, number][] => Array.from({ length: 31 }, (_, k) => {
            const tt = (k / 30) * Math.min(t, SETTLE);
            return [tt, from + (to - from) * ease(tt)];
          });
          chart.setSeries(poured ? [
            { name: 'A', points: pts(x.a.t, mixFinal(current)), slot: 1, marks: [] },
            { name: 'B', points: pts(x.b.t, mixFinal(current)), slot: 0, marks: [] },
          ] : []);
          pourBtn.disabled = poured;
        },
      };
    },
  }, root, lab, home);
}
