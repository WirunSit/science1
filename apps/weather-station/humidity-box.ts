// Weather Station station 4 — Humidity Box (PLAN §10.4): a box of air (1 m³) at 30 °C holding 15.2 g of
// water vapour. Cooling it 5 °C at a time leaves the vapour the same while the most it can hold drops,
// so the relative humidity rises; cooled to the dew point, droplets form on the walls.
import { formatNumber, h, mountStation, s, type QuizItem, type StationAsk } from '@shared/index';
import { dewPoint, saturationDensity } from '@shared/physics/weather';
import quiz from '@content/quiz/U6C1-L4.json';
import { BOX, DEW_CHOICES, RH_CHOICES, SAT_CHOICES, WHAT_CHOICES, dewShown, rhShown, satShown } from './answers';

export const HUMIDITY_BOX = { id: 'humidity-box', title: 'ความชื้น', lesson: 'U6C1-L4' };
const SPEED = Number(new URLSearchParams(location.search).get('speed')) || 1;
const COOL = 3; // seconds per cooling step on screen
const DEW_ROWS = [
  { id: 'temp', name: 'อุณหภูมิเมื่อหยดน้ำเริ่มเกาะผนัง (°C)' },
  { id: 'what', name: 'เมื่ออากาศเย็นลงจนถึงอุณหภูมินี้' },
];

export function mountHumidityBox(root: HTMLElement, lab: string, home: string): void {
  const dew = dewPoint(BOX.vapor);
  // Stage 0–2: the box at 30, 25, 20 °C; stage 3: cooled to the dew point.
  const tempOf = (stage: number) => (stage < BOX.temps.length ? BOX.temps[stage] : dew);
  mountStation<{ stage: number }>({
    ...HUMIDITY_BOX,
    storeKey: 'ws:humidity-box:v1',
    quiz: quiz.items as unknown as QuizItem[],
    modelNote: 'ปริมาณไอน้ำอิ่มตัวคิดจากสูตร Magnus ใน constants ค่าจริงในหนังสืออาจต่างเล็กน้อย กล่องปิดสนิท ไอน้ำจึงเท่าเดิมตลอดการทดลอง จุดไอน้ำในภาพแทนปริมาณไอน้ำ (ของจริงมองไม่เห็นไอน้ำ)',
    tables: [
      {
        key: 'box', caption: 'ตารางบันทึกผล ไอน้ำในอากาศ 15.2 g/m³ เท่าเดิม', rowHead: 'อุณหภูมิอากาศ',
        rows: BOX.temps.map((t) => ({ id: `t${t}`, name: `${t} °C` })),
        columns: [{ key: 'sat', label: 'ไอน้ำอิ่มตัว (g/m³)' }, { key: 'rh', label: 'ความชื้นสัมพัทธ์ (%)' }],
      },
      { key: 'dew', caption: 'จุดน้ำค้าง', rowHead: 'สิ่งที่สังเกต', rows: DEW_ROWS, columns: [{ key: 'value', label: 'ผล' }] },
    ],
    initial: () => ({ stage: 0 }),
    build(ctx) {
      let cooling = false;
      let t = 0;
      const svg = s('svg', { viewBox: '0 0 340 210', class: 'scene-svg', role: 'img' });
      const btn = h('button', { type: 'button', className: 'btn warn small', onclick: () => { cooling = true; t = 0; ctx.refresh(); } });
      const clock = h('p', { className: 'clock' });
      const bench = h('section', { className: 'bench xbench', 'aria-label': 'โต๊ะทดลอง' },
        h('p', { className: 'scene-title' }, 'กล่องอากาศปิดสนิท 1 m³ มีไอน้ำ 15.2 g'),
        h('div', { className: 'scene-stage' }, svg), h('div', { className: 'bench-controls' }, btn, clock));
      const stageDone = (i: number) => (i < BOX.temps.length ? ctx.has('box', `t${BOX.temps[i]}`, 'rh') : ctx.has('dew', 'what', 'value'));
      // Fixed dot positions, so the vapour does not jump around between redraws.
      const dots = Array.from({ length: 60 }, (_, i) => [20 + ((i * 37) % 170), 30 + ((i * 53) % 150)]);

      const asks: StationAsk[] = [
        ...BOX.temps.flatMap((temp, i): StationAsk[] => [
          {
            table: 'box', row: `t${temp}`, col: 'sat', label: `ไอน้ำอิ่มตัวที่ ${temp} °C`,
            choices: SAT_CHOICES, answer: () => satShown(temp).toFixed(1), ready: () => ctx.st.stage === i && !cooling,
            todo: `อากาศ ${temp} °C: อ่านความจุของถังไอน้ำอิ่มตัว (อากาศรับไอน้ำได้มากที่สุดกี่ g/m³) เลือกในตาราง`,
            wait: () => (cooling ? 'กำลังทำให้เย็นลง… ดูถังไอน้ำอิ่มตัว' : `กด "${btn.textContent}"`),
            waitCue: () => (cooling ? null : btn),
          },
          {
            table: 'box', row: `t${temp}`, col: 'rh', label: `ความชื้นสัมพัทธ์ที่ ${temp} °C`,
            choices: RH_CHOICES, answer: () => String(rhShown(temp)), ready: () => ctx.st.stage === i && !cooling,
            todo: `คำนวณ: ความชื้นสัมพัทธ์ = 15.2 ÷ ${formatNumber(satShown(temp), { decimals: 1 })} × 100 ได้กี่ % (ปัดเป็นจำนวนเต็ม) เลือกในตาราง`,
            wait: '',
          },
        ]),
        {
          table: 'dew', row: 'temp', col: 'value', label: 'อุณหภูมิเมื่อหยดน้ำเริ่มเกาะ',
          choices: DEW_CHOICES, answer: () => String(dewShown()), ready: () => ctx.st.stage === 3 && !cooling,
          todo: 'หยดน้ำเริ่มเกาะผนังกล่องแล้ว อ่านเทอร์โมมิเตอร์ (ค่าเต็มองศาที่ใกล้ที่สุด) เลือกในตาราง',
          wait: () => (cooling ? 'กำลังทำให้เย็นลง… ดูผนังกล่อง' : `กด "${btn.textContent}"`),
          waitCue: () => (cooling ? null : btn),
        },
        {
          table: 'dew', row: 'what', col: 'value', label: 'เกิดอะไรขึ้นที่จุดน้ำค้าง',
          choices: () => WHAT_CHOICES, answer: () => WHAT_CHOICES[0], ready: () => ctx.st.stage === 3 && !cooling,
          todo: 'ความชื้นสัมพัทธ์ถึง 100% แล้ว ไอน้ำเกิดอะไรขึ้น เลือกในตาราง',
          wait: '',
        },
      ];

      return {
        bench,
        asks,
        chips: () => [...BOX.temps.map((tp, i) => ({ name: `${tp} °C`, done: stageDone(i), now: ctx.st.stage === i })), { name: 'จุดน้ำค้าง', done: stageDone(3), now: ctx.st.stage === 3 }],
        allDoneLabel: 'บันทึกครบแล้ว',
        doneText: 'บันทึกครบแล้ว ✓ กด "ไปตอบคำถาม"',
        tick(dt) {
          if (!cooling) return false;
          t += dt * SPEED;
          if (t >= COOL) {
            cooling = false;
            ctx.st.stage += 1;
            ctx.save();
          }
          return true;
        },
        render() {
          const st = ctx.st.stage;
          const from = tempOf(st);
          const to = tempOf(Math.min(3, st + 1));
          const temp = cooling ? from + (to - from) * Math.min(1, t / COOL) : from;
          const sat = saturationDensity(temp);
          const rh = Math.min(100, (BOX.vapor / sat) * 100);
          const parts: SVGElement[] = [];
          // The box with vapour dots (number ∝ g/m³).
          parts.push(s('rect', { x: 10, y: 20, width: 190, height: 170, rx: 6, fill: '#eef6f9', stroke: 'var(--ink)', 'stroke-width': 2 }));
          dots.slice(0, Math.round(BOX.vapor * 3)).forEach(([x, y]) => parts.push(s('circle', { cx: x, cy: y, r: 2.4, fill: '#5b9cc4' })));
          if (rh >= 99.5) for (let k = 0; k < 9; k++) parts.push(s('ellipse', { cx: 18 + (k % 3) * 85, cy: 40 + Math.floor(k / 3) * 60, rx: 4, ry: 5, fill: '#5b9cc4', stroke: '#2e6e94' }));
          parts.push(s('text', { x: 105, y: 14, 'text-anchor': 'middle', 'font-size': 11, fill: 'var(--ink-2)' }, `ไอน้ำในอากาศ ${formatNumber(BOX.vapor, { decimals: 1 })} g/m³`));
          // The saturation tank: how much vapour this air could hold.
          const tankTop = 30;
          const tankH = 150;
          const full = 40; // g/m³ at the top of the tank
          const satH = (tankH * sat) / full;
          const vapH = (tankH * Math.min(BOX.vapor, sat)) / full;
          parts.push(s('rect', { x: 224, y: tankTop, width: 44, height: tankH, rx: 4, fill: 'var(--card)', stroke: 'var(--ink-2)' }));
          parts.push(s('rect', { x: 224, y: tankTop + tankH - satH, width: 44, height: satH, fill: 'none', stroke: '#0e6b70', 'stroke-width': 2, 'stroke-dasharray': '4 3' }));
          parts.push(s('rect', { x: 225, y: tankTop + tankH - vapH, width: 42, height: vapH, fill: '#5b9cc4', opacity: 0.8 }));
          parts.push(s('text', { x: 246, y: tankTop + tankH - satH - 4, 'text-anchor': 'middle', 'font-size': 11, 'font-weight': 600, fill: '#0e6b70' }, `${formatNumber(Math.round(sat * 10) / 10, { decimals: 1 })}`));
          parts.push(s('text', { x: 246, y: 200, 'text-anchor': 'middle', 'font-size': 10, fill: 'var(--ink-2)' }, 'ไอน้ำอิ่มตัว (g/m³)'));
          // Thermometer readout and (after the cell is recorded) the humidity gauge.
          parts.push(s('rect', { x: 278, y: 30, width: 56, height: 22, rx: 4, fill: 'var(--card)', stroke: 'var(--ink-2)' }));
          parts.push(s('text', { x: 306, y: 46, 'text-anchor': 'middle', 'font-size': 13, 'font-weight': 600, fill: 'var(--ink)' }, `${formatNumber(temp, { decimals: 1 })} °C`));
          const shownRh = st < 3 ? ctx.has('box', `t${BOX.temps[st]}`, 'rh') : true;
          parts.push(s('text', { x: 306, y: 80, 'text-anchor': 'middle', 'font-size': 10, fill: 'var(--ink-2)' }, 'ความชื้นสัมพัทธ์'));
          parts.push(s('text', { x: 306, y: 100, 'text-anchor': 'middle', 'font-size': 15, 'font-weight': 700, fill: 'var(--ink)' }, shownRh && !cooling ? `${formatNumber(rh, { decimals: 0 })}%` : '? %'));
          svg.replaceChildren(...parts);
          svg.setAttribute('aria-label', `กล่องอากาศ ${formatNumber(temp, { decimals: 1 })} องศาเซลเซียส ไอน้ำอิ่มตัว ${formatNumber(sat, { decimals: 1 })} กรัมต่อลูกบาศก์เมตร`);
          clock.textContent = rh >= 99.5 ? '💧 หยดน้ำเกาะผนังกล่อง' : '';
          btn.textContent = st >= 3 ? 'ถึงจุดน้ำค้างแล้ว' : st === 2 ? '❄ ทำให้เย็นลงจนเกิดหยดน้ำ' : '❄ ทำให้เย็นลง 5 °C';
          btn.disabled = cooling || st >= 3 || !stageDone(st);
        },
      };
    },
  }, root, lab, home);
}
