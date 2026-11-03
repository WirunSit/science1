// Weather Station station 2 — Sun Angle (PLAN §10.2), three scenes in turn: (A) the same beam of
// sunlight at 90°, 60° and 30° spreads over more ground; (B) sand, soil, grass and water in the same sun
// for an hour; (C) the ground temperature through 24 hours on a clear and on a cloudy day.
import { createLineChart, formatNumber, h, mountStation, s, tempColor, type QuizItem, type StationAsk } from '@shared/index';
import { dayCurve, sunEnergyFraction, warmingInSun } from '@shared/physics/weather';
import { weather } from '@shared/constants';
import quiz from '@content/quiz/U6C1-L2.json';
import {
  ANGLES, ENERGY_CHOICES, HOUR_CHOICES, RANGE_CHOICES, RANK_CHOICES, SURFACE_ROWS, cloudyRange, dayAnswer, energyPercent, surfaceName, surfaceRanks,
} from './answers';

export const SUN_ANGLE = { id: 'sun-angle', title: 'อุณหภูมิอากาศและแสงอาทิตย์', lesson: 'U6C1-L2' };
const SPEED = Number(new URLSearchParams(location.search).get('speed')) || 1;
const T_AIR = weather.sunlight.airTemperatureC.value;
const SUN_SECONDS = 5; // on screen, for one hour of sun
const DAY_SECONDS = 8; // on screen, for 24 hours
const DAY_ROWS = [
  { id: 'max', name: 'วันฟ้าโปร่ง ผิวดินร้อนที่สุดเวลา' },
  { id: 'min', name: 'วันฟ้าโปร่ง ผิวดินเย็นที่สุดเวลา' },
  { id: 'cloudy', name: 'วันที่มีเมฆมาก ช่วงอุณหภูมิกลางวัน–กลางคืน' },
];

export function mountSunAngle(root: HTMLElement, lab: string, home: string): void {
  const ranks = surfaceRanks();
  const clear = dayCurve('soil');
  const cloudy = dayCurve('soil', true);
  mountStation<{ angle: number; sunDone: boolean; dayDone: boolean }>({
    ...SUN_ANGLE,
    storeKey: 'ws:sun-angle:v1',
    quiz: quiz.items as unknown as QuizItem[],
    modelNote: 'พลังงานต่อพื้นที่คิดจาก sin ของมุมแสง ฉากพื้นผิวและฉาก 24 ชั่วโมงคิดพลังงานแสงที่พื้นดูดกลืน ความร้อนที่ใช้ระเหยน้ำ ความร้อนที่ส่งให้อากาศ และรังสีที่พื้นคายออก โดยใช้ค่าโดยประมาณใน constants กราฟ 24 ชั่วโมงเป็นอุณหภูมิผิวดิน อากาศเหนือพื้นได้รับความร้อนจากพื้น จึงร้อนที่สุดช่วงบ่ายเช่นกัน แต่ช่วงอุณหภูมิแคบกว่า (อากาศเย็นที่สุดราวรุ่งเช้า)',
    tables: [
      { key: 'angle', caption: 'ฉาก 1 มุมของแสง', rowHead: 'มุมแสง', rows: ANGLES.map((a) => ({ id: `a${a}`, name: `${a}°` })), columns: [{ key: 'energy', label: 'พลังงานต่อพื้นที่ (% ของแสงตั้งฉาก)' }] },
      { key: 'surface', caption: 'ฉาก 2 แดด 1 ชั่วโมง', rowHead: 'พื้นผิว', rows: SURFACE_ROWS.map((id) => ({ id, name: surfaceName(id) })), columns: [{ key: 'rank', label: 'ร้อนขึ้นมากลำดับที่' }] },
      { key: 'day', caption: 'ฉาก 3 อุณหภูมิในรอบวัน', rowHead: 'สิ่งที่สังเกต', rows: DAY_ROWS, columns: [{ key: 'value', label: 'ผล' }] },
    ],
    initial: () => ({ angle: 0, sunDone: false, dayDone: false }),
    build(ctx) {
      let running = false;
      let t = 0; // seconds into the running scene
      const scene = () => (!ANGLES.every((a) => ctx.has('angle', `a${a}`, 'energy')) ? 0 : !SURFACE_ROWS.every((r) => ctx.has('surface', r, 'rank')) ? 1 : 2);
      const title = h('p', { className: 'scene-title' });
      const svg = s('svg', { viewBox: '0 0 340 200', class: 'scene-svg', role: 'img' });
      const CHART = { xLabel: 'เวลา (นาฬิกา)', yLabel: 'อุณหภูมิผิวดิน (°C)', xMin: 0, xMax: 24, yMin: 15, yMax: 55, xTicks: [0, 6, 12, 18, 24], yTicks: [15, 25, 35, 45, 55] };
      const chart = createLineChart(CHART);
      const days = (upTo: number) => {
        const line = (c: number[]) => c.slice(0, upTo + 1).map((v, hr): [number, number] => [hr, v]);
        return [{ name: 'วันฟ้าโปร่ง', points: line(clear), slot: 1 }, { name: 'วันที่มีเมฆมาก', points: line(cloudy), slot: 0 }];
      };
      const chartBox = h('div', { className: 'scene-chart', hidden: true }, chart.el);
      const btn = h('button', { type: 'button', className: 'btn warn small', onclick: () => press() });
      const clock = h('p', { className: 'clock' });
      const bench = h('section', { className: 'bench xbench', 'aria-label': 'โต๊ะทดลอง' }, title, h('div', { className: 'scene-stage' }, svg, chartBox), h('div', { className: 'bench-controls' }, btn, clock));

      function press(): void {
        const sc = scene();
        if (sc === 0) ctx.st.angle = Math.min(ANGLES.length - 1, ctx.st.angle + (ctx.has('angle', `a${ANGLES[ctx.st.angle]}`, 'energy') ? 1 : 0));
        else { running = true; t = 0; }
        ctx.save();
        ctx.refresh();
      }

      const asks: StationAsk[] = [
        ...ANGLES.map((a, i): StationAsk => ({
          table: 'angle', row: `a${a}`, col: 'energy', label: `พลังงานต่อพื้นที่ที่มุม ${a}°`,
          choices: () => ENERGY_CHOICES, answer: () => energyPercent(a), ready: () => ctx.st.angle === i,
          todo: `แสงทำมุม ${a}° กับพื้น: อ่านพลังงานต่อพื้นที่ (%) ใต้ภาพ แล้วเลือกในตาราง`,
          wait: () => `กด "☀ เปลี่ยนมุมแสง" ให้แสงทำมุม ${a}°`,
          waitCue: () => btn,
        })),
        ...SURFACE_ROWS.map((id, i): StationAsk => ({
          table: 'surface', row: id, col: 'rank', label: `${surfaceName(id)} ร้อนขึ้นมากลำดับที่`,
          choices: () => RANK_CHOICES, answer: () => ranks[i], ready: () => ctx.st.sunDone && !running,
          todo: `ครบ 1 ชั่วโมง: ${surfaceName(id)}ร้อนขึ้นมากเป็นลำดับที่เท่าไร (1 = ร้อนขึ้นมากที่สุด) ดูเทอร์โมมิเตอร์`,
          wait: () => (running ? 'กำลังให้แสงแดด… ดูเทอร์โมมิเตอร์ทั้ง 4 ถาด' : 'กด "☀ ให้แสงแดด 1 ชั่วโมง" แก่ถาดทั้ง 4 พร้อมกัน'),
          waitCue: () => (running ? null : btn),
        })),
        ...DAY_ROWS.map((r): StationAsk => ({
          table: 'day', row: r.id, col: 'value', label: r.name,
          choices: () => (r.id === 'cloudy' ? RANGE_CHOICES : HOUR_CHOICES),
          answer: () => (r.id === 'cloudy' ? cloudyRange() : dayAnswer(r.id as 'max' | 'min')),
          ready: () => ctx.st.dayDone && !running,
          todo: r.id === 'cloudy' ? 'เทียบเส้นวันที่มีเมฆมากกับวันฟ้าโปร่ง: ผลต่างระหว่างกลางวันกับกลางคืนเป็นอย่างไร' : `ดูเส้นวันฟ้าโปร่ง: ${r.name.replace('วันฟ้าโปร่ง ', '')}`,
          wait: () => (running ? 'กำลังเดินเวลา 24 ชั่วโมง… ดูเส้นกราฟ' : 'กด "▶ เดินเวลา 24 ชั่วโมง" ดูอุณหภูมิผิวดินวันฟ้าโปร่งและวันที่มีเมฆมาก'),
          waitCue: () => (running ? null : btn),
        })),
      ];

      return {
        bench,
        asks,
        chips: () => [
          { name: 'มุมแสง', done: scene() > 0, now: scene() === 0 },
          { name: 'พื้นผิว', done: scene() > 1, now: scene() === 1 },
          { name: 'รอบวัน', done: DAY_ROWS.every((r) => ctx.has('day', r.id, 'value')), now: scene() === 2 },
        ],
        allDoneLabel: 'บันทึกครบ 3 ฉากแล้ว',
        figure: () => {
          const c = createLineChart(CHART);
          c.setSeries(days(24));
          return c.el;
        },
        doneText: 'บันทึกครบแล้ว ✓ กด "ไปตอบคำถาม"',
        tick(dt) {
          if (!running) return false;
          t += dt * SPEED;
          const sc = scene();
          const end = sc === 1 ? SUN_SECONDS : DAY_SECONDS;
          if (t >= end) {
            running = false;
            if (sc === 1) ctx.st.sunDone = true;
            else ctx.st.dayDone = true;
            ctx.save();
          }
          return true;
        },
        render() {
          const sc = scene();
          const parts: SVGElement[] = [];
          chartBox.hidden = sc !== 2;
          svg.style.display = sc === 2 ? 'none' : '';
          if (sc === 0) {
            const a = ANGLES[ctx.st.angle];
            title.textContent = `ฉากที่ 1: ลำแสงขนาดเท่าเดิม ตกกระทบพื้นที่มุม ${a}°`;
            const beam = 60; // beam width
            const spread = beam / sunEnergyFraction(a);
            const cx = 170;
            const gy = 170;
            const rad = (a * Math.PI) / 180;
            const dx = Math.cos(rad) * 140;
            const dy = Math.sin(rad) * 140;
            parts.push(s('rect', { x: 0, y: gy, width: 340, height: 30, fill: '#c9b48a' }));
            parts.push(s('polygon', {
              points: `${cx - spread / 2 - dx},${gy - dy} ${cx + spread / 2 - dx},${gy - dy} ${cx + spread / 2},${gy} ${cx - spread / 2},${gy}`,
              fill: '#f4d35e', opacity: 0.75, stroke: '#c79a1c',
            }));
            parts.push(s('rect', { x: cx - spread / 2, y: gy - 3, width: spread, height: 6, fill: '#b4441c' }));
            parts.push(s('text', { x: cx, y: gy + 22, 'text-anchor': 'middle', 'font-size': 13, 'font-weight': 600, fill: '#1f2a2e' }, `พลังงานต่อพื้นที่ ${energyPercent(a)}%`));
            btn.textContent = '☀ เปลี่ยนมุมแสง';
            btn.disabled = ctx.st.angle === ANGLES.length - 1 || !ctx.has('angle', `a${a}`, 'energy');
            clock.textContent = `ความกว้างที่แสงตก ${formatNumber(spread / beam, { decimals: 1 })} เท่า`;
          } else if (sc === 1) {
            title.textContent = 'ฉากที่ 2: แดดเท่ากัน 4 ถาด เริ่มที่อุณหภูมิเท่ากัน';
            const f = ctx.st.sunDone ? 1 : running ? Math.min(1, t / SUN_SECONDS) : 0;
            const fills: Record<string, string> = { sand: '#e6cf98', soil: '#8a6a4a', grass: '#6f9e4f', water: '#5b9cc4' };
            SURFACE_ROWS.forEach((id, i) => {
              const x = 14 + i * 82;
              const temp = T_AIR + warmingInSun(id, 60 * f);
              parts.push(s('rect', { x, y: 110, width: 66, height: 40, rx: 4, fill: fills[id], stroke: 'var(--ink)' }));
              parts.push(s('text', { x: x + 33, y: 168, 'text-anchor': 'middle', 'font-size': 12, fill: 'var(--ink)' }, surfaceName(id)));
              parts.push(s('rect', { x: x + 6, y: 176, width: 54, height: 20, rx: 4, fill: 'var(--card)', stroke: tempColor(temp, 25, 50), 'stroke-width': 2 }));
              parts.push(s('text', { x: x + 33, y: 191, 'text-anchor': 'middle', 'font-size': 13, 'font-weight': 600, fill: 'var(--ink)' }, `${formatNumber(temp, { decimals: 1 })} °C`));
            });
            parts.push(s('circle', { cx: 170, cy: 36, r: 20, fill: '#f4d35e', stroke: '#c79a1c' }));
            for (let k = 0; k < 4; k++) parts.push(s('line', { x1: 170, y1: 58, x2: 47 + k * 82, y2: 106, stroke: '#e5c04a', 'stroke-width': 2, opacity: running || f > 0 ? 1 : 0.35 }));
            btn.textContent = ctx.st.sunDone ? 'ครบ 1 ชั่วโมงแล้ว' : running ? '☀ กำลังให้แสงแดด' : '☀ ให้แสงแดด 1 ชั่วโมง';
            btn.disabled = running || ctx.st.sunDone;
            clock.textContent = `⏱ ${formatNumber(Math.round(60 * f))} นาที`;
          } else {
            title.textContent = 'ฉากที่ 3: อุณหภูมิผิวดินตลอด 24 ชั่วโมง';
            const f = ctx.st.dayDone ? 1 : running ? Math.min(1, t / DAY_SECONDS) : 0;
            const upTo = Math.round(24 * f);
            chart.setSeries(upTo > 0 ? days(upTo) : []);
            btn.textContent = ctx.st.dayDone ? 'ครบ 24 ชั่วโมงแล้ว' : running ? '▶ กำลังเดินเวลา' : '▶ เดินเวลา 24 ชั่วโมง';
            btn.disabled = running || ctx.st.dayDone;
            clock.textContent = `⏱ ${String(upTo).padStart(2, '0')}:00 น.`;
          }
          svg.replaceChildren(...parts);
          svg.setAttribute('aria-label', title.textContent ?? '');
        },
      };
    },
  }, root, lab, home);
}
