// Heat Transfer Studio station 5 — Cool Box Designer (PLAN §9.4, D-045): test two given boxes, then
// design one's own (up to 3 wall layers, outside finish, in the sun or shade, within a coin budget) and
// see how many minutes 500 g of ice lasts. A design aid before building the real box (ม.1/6).
import { formatNumber, h, mountStation, s, type QuizItem, type StationAsk } from '@shared/index';
import quiz from '@content/quiz/U5C2-L4.json';
import {
  BUDGET, COMPARE_CHOICES, FIXED_DESIGNS, LAYER_OPTIONS, OUTSIDE, compare, designMinutes, minuteChoices, type Design,
} from './answers';

export const COOL_BOX = { id: 'cool-box', title: 'ออกแบบกล่องเก็บความเย็น', lesson: 'U5C2-L4' };
const RUN_SECONDS = 4; // real seconds to play one test, whatever the simulated minutes

interface Own { layers: string[]; outside: keyof typeof OUTSIDE; sun: boolean }

export function mountCoolBox(root: HTMLElement, lab: string, home: string): void {
  mountStation<{ own: Own }>({
    ...COOL_BOX,
    storeKey: 'hts:cool-box:v1',
    quiz: quiz.items as unknown as QuizItem[],
    modelNote: 'แบบจำลองนี้คิดความร้อนที่ผ่านผนังกล่องจากค่าการนำความร้อนและความหนาของวัสดุ (constants) รวมกับแสงแดดที่ผิวนอกดูดกลืน ผลเป็นการประมาณเพื่อเปรียบเทียบแบบก่อนสร้างจริง ผลจริงต้องมาจากการทดสอบกล่องที่สร้าง (รอยต่อ ฝากล่อง และการเปิดกล่องทำให้ความร้อนเข้าได้มากกว่านี้)',
    tables: [{
      key: 'box', caption: 'ตารางบันทึกผล น้ำแข็ง 500 g อากาศภายนอก 32 °C', rowHead: 'แบบกล่อง',
      rows: [{ id: 'd1', name: 'แบบที่ 1 กระดาษลังชั้นเดียว' }, { id: 'd2', name: 'แบบที่ 2 กระดาษลัง + โฟม 2 cm' }, { id: 'd3', name: 'แบบที่ 3 แบบของฉัน' }],
      columns: [{ key: 'time', label: 'น้ำแข็งละลายหมด (นาที)' }, { key: 'compare', label: 'เทียบกับแบบที่ 1' }],
    }],
    initial: () => ({ own: { layers: ['card', 'foam1', ''], outside: 'white', sun: true } }),
    build(ctx) {
      ctx.tables.box.set(0, 'compare', 'ใช้เทียบ');
      let testing: number | null = null; // design index being played
      let played = -1;
      let t = 0;
      const ownDesign = (): Design => ({
        layers: ctx.st.own.layers.filter(Boolean).map((id) => LAYER_OPTIONS.find((o) => o.id === id)!).map((o) => ({ material: o.material, thickness: o.thickness })),
        outside: ctx.st.own.outside, sun: ctx.st.own.sun,
      });
      const designs = () => [FIXED_DESIGNS[0], FIXED_DESIGNS[1], ownDesign()];
      const coins = () => ctx.st.own.layers.filter(Boolean).reduce((sum, id) => sum + LAYER_OPTIONS.find((o) => o.id === id)!.coins, 0) + (ctx.st.own.outside === 'foil' ? 2 : 0);
      const next = () => ['d1', 'd2', 'd3'].findIndex((d) => !ctx.has('box', d, 'time') || (d !== 'd1' && !ctx.has('box', d, 'compare')));

      const testBtn = h('button', { type: 'button', className: 'btn warn small', onclick: () => { testing = next() < 0 ? 2 : next(); played = -1; t = 0; ctx.refresh(); } }, '▶ ทดสอบกล่อง');
      const svg = s('svg', { viewBox: '0 0 240 170', class: 'rig-svg', role: 'img' });
      const result = h('p', { className: 'clock' });
      const select = (label: string, options: [string, string][], value: string, on: (v: string) => void) =>
        h('label', { className: 'field mini' }, label, h('select', { onchange: (e: Event) => { on((e.target as HTMLSelectElement).value); ctx.save(); ctx.refresh(); } },
          ...options.map(([v, name]) => h('option', { value: v, selected: v === value }, name))));
      const layerOpts: [string, string][] = [['', 'ไม่มี'], ...LAYER_OPTIONS.map((o): [string, string] => [o.id, `${o.name} (${o.coins} เหรียญ)`])];
      const design = h('div', { className: 'design-panel' },
        ...[0, 1, 2].map((i) => select(`ชั้นที่ ${i + 1} (นอก → ใน)`, layerOpts, ctx.st.own.layers[i], (v) => { ctx.st.own.layers[i] = v; })),
        select('ผิวนอก', Object.entries(OUTSIDE).map(([k, o]): [string, string] => [k, `${o.name}${k === 'foil' ? ' (2 เหรียญ)' : ''}`]), ctx.st.own.outside, (v) => { ctx.st.own.outside = v as Own['outside']; }),
        select('วางไว้', [['sun', 'กลางแดด'], ['shade', 'ในร่ม']], ctx.st.own.sun ? 'sun' : 'shade', (v) => { ctx.st.own.sun = v === 'sun'; }));
      const coinText = h('p', { className: 'hint' });
      const bench = h('section', { className: 'bench pgbench cbbench', 'aria-label': 'โต๊ะทดลอง' },
        svg, h('div', { className: 'cb-side' }, design, coinText), h('div', { className: 'bench-controls' }, testBtn, result));

      const over = () => coins() > BUDGET || ownDesign().layers.length === 0;
      const ready = (i: number) => () => played === i && t >= RUN_SECONDS;
      const asks: StationAsk[] = [0, 1, 2].flatMap((i): StationAsk[] => {
        const id = `d${i + 1}`;
        const list: StationAsk[] = [{
          table: 'box', row: id, col: 'time', label: `เวลาที่น้ำแข็งละลายหมด แบบที่ ${i + 1}`,
          choices: () => minuteChoices(designMinutes(designs()[i])), answer: () => designMinutes(designs()[i]), ready: ready(i),
          todo: `แบบที่ ${i + 1}: น้ำแข็งละลายหมดในกี่นาที ดูนาฬิกา แล้วเลือกในตาราง`,
          wait: () => (i === 2 && over() ? `ออกแบบกล่องของฉันทางขวา (ใช้ไม่เกิน ${BUDGET} เหรียญ) แล้วกด "▶ ทดสอบกล่อง"`
            : testing === i ? 'กำลังทดสอบ… ดูน้ำแข็งในกล่อง'
              : i === 2 ? 'ออกแบบกล่องของฉันทางขวา แล้วกด "▶ ทดสอบกล่อง"' : `กด "▶ ทดสอบกล่อง" ทดสอบแบบที่ ${i + 1}`),
          waitCue: () => (testing === i ? null : testBtn),
        }];
        if (i > 0) list.push({
          table: 'box', row: id, col: 'compare', label: `แบบที่ ${i + 1} เทียบกับแบบที่ 1`,
          choices: () => COMPARE_CHOICES, answer: () => compare(designs()[i]), ready: ready(i),
          todo: `แบบที่ ${i + 1} เก็บน้ำแข็งได้นานกว่าหรือเร็วกว่าแบบที่ 1 เลือกในตาราง`,
          wait: '',
        });
        return list;
      });

      return {
        bench,
        asks,
        chips: () => ['แบบที่ 1', 'แบบที่ 2', 'แบบของฉัน'].map((name, i) => ({ name, done: ctx.has('box', `d${i + 1}`, i ? 'compare' : 'time'), now: next() === i })),
        allDoneLabel: 'ทดสอบครบ 3 แบบแล้ว',
        doneText: 'ทดสอบครบแล้ว ✓ กด "ไปตอบคำถาม" หรือปรับแบบของฉันแล้วทดสอบอีกได้ (ไม่ต้องบันทึก)',
        tick(dt) {
          if (testing === null) return false;
          t = Math.min(RUN_SECONDS, t + dt);
          if (t >= RUN_SECONDS) { played = testing; testing = null; }
          return true;
        },
        render() {
          const n = next();
          const i = testing ?? (played >= 0 ? played : Math.max(0, n));
          const d = designs()[i];
          const minutes = designMinutes(d);
          const f = testing !== null || played === i ? Math.min(1, t / RUN_SECONDS) : 0;
          const ice = 1 - f;
          const parts: SVGElement[] = [];
          if (d.sun) parts.push(s('text', { x: 222, y: 22, 'font-size': 22, 'text-anchor': 'middle' }, '☀'));
          // Walls: one band per layer, outside first.
          let inset = 0;
          const colour: Record<string, string> = { cardboard: '#c9a26b', eps: '#f4f6f8', cotton: '#d9cbe8', stillAir: '#e6f1f5' };
          parts.push(s('rect', { x: 30, y: 30, width: 170, height: 120, fill: d.outside === 'foil' ? '#c9cfd2' : d.outside === 'white' ? '#ffffff' : '#7a5a3a', stroke: 'var(--ink)' }));
          for (const l of d.layers) {
            const w = Math.max(4, l.thickness * 500);
            parts.push(s('rect', { x: 32 + inset, y: 32 + inset, width: 166 - 2 * inset, height: 116 - 2 * inset, fill: colour[l.material], stroke: 'var(--ink-2)', 'stroke-width': 0.8 }));
            inset += w;
          }
          parts.push(s('rect', { x: 32 + inset, y: 32 + inset, width: Math.max(10, 166 - 2 * inset), height: Math.max(10, 116 - 2 * inset), fill: 'var(--card)' }));
          const size = 50 * Math.sqrt(Math.max(0.02, ice));
          if (ice > 0.01) parts.push(s('rect', { x: 115 - size / 2, y: 140 - inset - size, width: size, height: size, rx: 4, fill: '#e9f4f7', stroke: 'var(--ink-2)' }));
          parts.push(s('rect', { x: 115 - 30, y: 138 - inset, width: 60, height: Math.max(0, 6 * f), fill: 'var(--temp-1)' }));
          svg.replaceChildren(...parts);
          svg.setAttribute('aria-label', `กล่องแบบที่ ${i + 1} ${d.layers.length} ชั้น ${OUTSIDE[d.outside].name} ${d.sun ? 'กลางแดด' : 'ในร่ม'}`);
          result.textContent = testing !== null || played === i ? `⏱ ${formatNumber(Math.round((minutes * f) / 5) * 5)} นาที${f >= 1 ? ' — น้ำแข็งละลายหมด' : ''}` : `แบบที่ ${i + 1}`;
          coinText.textContent = `แบบของฉันใช้ ${coins()} จาก ${BUDGET} เหรียญ${coins() > BUDGET ? ' — เกินงบ ลดวัสดุลง' : ''}`;
          design.hidden = n !== 2 && n !== -1;
          testBtn.disabled = testing !== null || (n === 2 && over()) || (n === -1 && over());
        },
      };
    },
  }, root, lab, home);
}
