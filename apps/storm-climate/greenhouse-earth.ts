// Storm & Climate station 2 — Greenhouse Earth (PLAN §11.2): sunlight in, infrared out, part of it sent
// back by greenhouse gases. Five CO₂ levels in turn give the equilibrium temperature; then the real data
// (NOAA Mauna Loa CO₂, NASA GISTEMP temperature) drawn from the downloaded files with their sources.
import { createLineChart, formatNumber, h, mountStation, s, type QuizItem, type StationAsk } from '@shared/index';
import quiz from '@content/quiz/U6C2-L2a.json';
import { CO2, DATA_ROWS, PRESETS, SOURCES, TEMP, TEMP_CHOICES, presetAnswer, presetTemp } from './answers';

export const GREENHOUSE_EARTH = { id: 'greenhouse-earth', title: 'ปรากฏการณ์เรือนกระจก', lesson: 'U6C2-L2' };
const SPEED = Number(new URLSearchParams(location.search).get('speed')) || 1;
const SETTLE = 3; // seconds for the thermometer to settle on screen

export function mountGreenhouseEarth(root: HTMLElement, lab: string, home: string): void {
  mountStation<{ preset: number; data: boolean }>({
    ...GREENHOUSE_EARTH,
    storeKey: 'sc:greenhouse-earth:v1',
    quiz: quiz.items as unknown as QuizItem[],
    modelNote: 'แบบจำลองสมดุลอย่างง่าย: อุณหภูมิ = อุณหภูมิก่อนยุคอุตสาหกรรม + λ × 5.35 × ln(CO₂ ÷ 280) ค่าใน constants แสดงอุณหภูมิเมื่อโลกปรับตัวเข้าสมดุลแล้ว (ใช้เวลาหลายสิบถึงหลายร้อยปี) ไม่ใช่การพยากรณ์อุณหภูมิของปีใดปีหนึ่ง และไม่รวมปัจจัยอื่น เช่น มีเทน ละอองลอย เมฆ จำนวนลูกศรสีแดงที่ย้อนกลับเป็นภาพเชิงเปรียบเทียบ กราฟข้อมูลจริงมาจากไฟล์ของ NOAA และ NASA',
    tables: [
      { key: 'co2', caption: 'ตารางที่ 1 แบบจำลอง', rowHead: 'บรรยากาศ', rows: PRESETS.map((p) => ({ id: p.id, name: p.name })), columns: [{ key: 'temp', label: 'อุณหภูมิเฉลี่ยโลก (°C)' }] },
      { key: 'data', caption: 'ตารางที่ 2 ข้อมูลจริง', rowHead: 'จากกราฟ', rows: DATA_ROWS.map((r) => ({ id: r.id, name: r.name })), columns: [{ key: 'value', label: 'ผล' }] },
    ],
    initial: () => ({ preset: 0, data: false }),
    build(ctx) {
      let settling = false;
      let t = 0;
      const title = h('p', { className: 'scene-title' });
      const svg = s('svg', { viewBox: '0 0 340 200', class: 'scene-svg', role: 'img' });
      const co2Chart = createLineChart({ xLabel: 'ปี ค.ศ.', yLabel: 'CO₂ (ppm)', xMin: 1880, xMax: 2030, xTicks: [1880, 1920, 1960, 2000, 2030], yMin: 300, yMax: 460, yTicks: [300, 340, 380, 420, 460] });
      const tempChart = createLineChart({ xLabel: 'ปี ค.ศ.', yLabel: 'อุณหภูมิเทียบปี 1951–1980 (°C)', xMin: 1880, xMax: 2030, xTicks: [1880, 1920, 1960, 2000, 2030], yMin: -0.6, yMax: 1.4, yTicks: [-0.5, 0, 0.5, 1, 1.5] });
      co2Chart.setSeries([{ name: 'CO₂ ที่ Mauna Loa (NOAA)', points: CO2, slot: 1, marks: [] }]);
      tempChart.setSeries([{ name: 'อุณหภูมิเฉลี่ยโลก (NASA GISTEMP)', points: TEMP, slot: 0, marks: [] }]);
      const dataBox = h('div', { className: 'scene-chart two-charts', hidden: true }, co2Chart.el, tempChart.el, h('p', { className: 'source-note' }, SOURCES));
      const btn = h('button', { type: 'button', className: 'btn warn small', onclick: () => press() });
      const clock = h('p', { className: 'clock' });
      const bench = h('section', { className: 'bench xbench', 'aria-label': 'โต๊ะทดลอง' }, title, h('div', { className: 'scene-stage' }, svg, dataBox), h('div', { className: 'bench-controls' }, btn, clock));
      const presetDone = (i: number) => ctx.has('co2', PRESETS[i].id, 'temp');
      const allPresets = () => PRESETS.every((_, i) => presetDone(i));

      function press(): void {
        if (!allPresets()) ctx.st.preset = Math.min(PRESETS.length - 1, ctx.st.preset + 1);
        else ctx.st.data = true;
        settling = !ctx.st.data;
        t = 0;
        ctx.save();
        ctx.refresh();
      }

      const asks: StationAsk[] = [
        ...PRESETS.map((p, i): StationAsk => ({
          table: 'co2', row: p.id, col: 'temp', label: `อุณหภูมิเฉลี่ยโลก ${p.name}`,
          choices: TEMP_CHOICES, answer: () => presetAnswer(i), ready: () => ctx.st.preset === i && !settling && !ctx.st.data,
          todo: `${p.name}: อ่านเทอร์โมมิเตอร์ของโลก (ปัดเป็นจำนวนเต็ม) เลือกในตาราง`,
          wait: () => (settling ? 'โลกกำลังปรับเข้าสมดุล…' : `กด "${btn.textContent}"`),
          waitCue: () => (settling ? null : btn),
        })),
        ...DATA_ROWS.map((r): StationAsk => ({
          table: 'data', row: r.id, col: 'value', label: r.name, choices: r.choices, answer: r.answer, ready: () => ctx.st.data,
          todo: r.id.startsWith('co2') ? `ดูกราฟ CO₂ (บน): ${r.name}` : `ดูกราฟอุณหภูมิ (ล่าง): ${r.name}`,
          wait: () => `กด "${btn.textContent}"`, waitCue: () => btn,
        })),
      ];

      return {
        bench,
        asks,
        chips: () => [
          { name: 'แบบจำลอง', done: allPresets(), now: !ctx.st.data },
          { name: 'ข้อมูลจริง', done: DATA_ROWS.every((r) => ctx.has('data', r.id, 'value')), now: ctx.st.data },
        ],
        allDoneLabel: 'บันทึกครบแล้ว',
        doneText: 'บันทึกครบแล้ว ✓ กด "ไปตอบคำถาม"',
        tick(dt) {
          if (!settling) return false;
          t += dt * SPEED;
          if (t >= SETTLE) settling = false;
          return true;
        },
        render() {
          dataBox.hidden = !ctx.st.data;
          svg.style.display = ctx.st.data ? 'none' : '';
          const i = ctx.st.preset;
          const p = PRESETS[i];
          const prev = i === 0 ? presetTemp(0) : presetTemp(i - 1);
          const temp = settling ? prev + (presetTemp(i) - prev) * Math.min(1, t / SETTLE) : presetTemp(i);
          if (ctx.st.data) {
            title.textContent = 'ข้อมูลจริง: CO₂ และอุณหภูมิเฉลี่ยของโลก';
            clock.textContent = '';
          } else {
            title.textContent = `บรรยากาศ: ${p.name}`;
            // Earth, atmosphere, sunlight in (yellow), infrared out (red) and back (red, returning).
            const back = p.co2 === 0 ? 0 : Math.max(1, Math.round(1 + 4.3 * Math.log(p.co2 / 150)));
            const parts: SVGElement[] = [
              s('rect', { x: 0, y: 0, width: 340, height: 200, fill: '#1d2a44' }),
              s('path', { d: 'M-20,200 Q170,90 360,200 Z', fill: p.co2 === 0 ? 'none' : '#9cc3d5', opacity: 0.35 + Math.min(0.4, p.co2 / 2000) }),
              s('path', { d: 'M0,200 Q170,140 340,200 Z', fill: '#4f8f5a' }),
              s('circle', { cx: 30, cy: 30, r: 16, fill: '#f4d35e' }),
            ];
            for (let k = 0; k < 4; k++) parts.push(s('line', { x1: 46 + k * 10, y1: 40 + k * 4, x2: 120 + k * 45, y2: 170 - k * 4, stroke: '#f4d35e', 'stroke-width': 2.5 }));
            for (let k = 0; k < 6; k++) {
              const x = 130 + k * 30;
              const returned = k < back;
              parts.push(s('line', { x1: x, y1: 168, x2: x + 8, y2: returned ? 125 : 20, stroke: '#e0603c', 'stroke-width': 2.5, 'stroke-dasharray': '5 3' }));
              if (returned) parts.push(s('line', { x1: x + 8, y1: 125, x2: x + 16, y2: 166, stroke: '#e0603c', 'stroke-width': 2.5 }));
            }
            parts.push(s('rect', { x: 8, y: 150, width: 92, height: 26, rx: 5, fill: 'var(--card)', stroke: 'var(--ink-2)' }));
            parts.push(s('text', { x: 54, y: 168, 'text-anchor': 'middle', 'font-size': 14, 'font-weight': 700, fill: 'var(--ink)' }, `${formatNumber(temp, { decimals: 1 })} °C`));
            parts.push(s('text', { x: 336, y: 14, 'text-anchor': 'end', 'font-size': 10, fill: '#f3efe5' }, 'เหลือง = แสงอาทิตย์ · แดง = รังสีอินฟราเรดจากโลก'));
            svg.replaceChildren(...parts);
            svg.setAttribute('aria-label', `โลกเมื่อ${p.name} อุณหภูมิเฉลี่ย ${formatNumber(temp, { decimals: 1 })} องศาเซลเซียส`);
            clock.textContent = settling ? 'กำลังเข้าสมดุล…' : 'สมดุลแล้ว';
          }
          btn.textContent = ctx.st.data ? 'ดูข้อมูลจริงแล้ว' : allPresets() ? '📈 ดูข้อมูลจริง' : '▶ เปลี่ยนปริมาณ CO₂';
          btn.disabled = settling || ctx.st.data || (!allPresets() && !presetDone(i));
        },
      };
    },
  }, root, lab, home);
}
