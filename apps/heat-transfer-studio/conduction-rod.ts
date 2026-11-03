// Heat Transfer Studio station 1 — Conduction Rod (PLAN §9.1, D-045): four rods (copper, aluminium,
// iron, wood) with one end in boiling water and wax beads along them. Students heat all four together,
// watch the colour creep along and the beads drop, then record the order and conductor/insulator.
import { formatNumber, h, mountStation, s, tempColor, type QuizItem, type StationAsk } from '@shared/index';
import { makeRod, rodTempAt, stepRod, ROD, type Rod } from '@shared/physics/transfer';
import quiz from '@content/quiz/U5C2-L1.json';
import { KIND_CHOICES, ORDER_CHOICES, ROD_RUN, RODS, WAX_AT, rodAnswers, rodName } from './answers';

export const CONDUCTION_ROD = { id: 'conduction-rod', title: 'การนำความร้อน', lesson: 'U5C2-L1' };
const SPEED = Number(new URLSearchParams(location.search).get('speed')) || 20;

export function mountConductionRod(root: HTMLElement, lab: string, home: string): void {
  const answers = rodAnswers();
  mountStation<{ seconds: number }>({
    ...CONDUCTION_ROD,
    storeKey: 'hts:conduction-rod:v1',
    quiz: quiz.items as unknown as QuizItem[],
    modelNote: `แบบจำลองนี้คิดการนำความร้อนตามความยาวแท่ง โดยใช้ค่าการนำความร้อน ความหนาแน่น และความจุความร้อนจำเพาะของวัสดุจาก constants และมีความร้อนสูญเสียทางผิวแท่งเล็กน้อย เวลาเร็วกว่าจริง ${SPEED} เท่า ของจริงเม็ดเทียนอาจหลุดช้าหรือเร็วต่างไปตามขนาดแท่งและเทียน แต่ลำดับวัสดุเหมือนกัน`,
    tables: [{
      key: 'rods', caption: 'ตารางบันทึกผล', rowHead: 'วัสดุ',
      rows: RODS.map((m) => ({ id: m, name: rodName(m) })),
      columns: [{ key: 'order', label: 'ลำดับเทียนเม็ดแรกหลุด' }, { key: 'kind', label: 'ตัวนำ/ฉนวน' }],
    }],
    initial: () => ({ seconds: 0 }),
    build(ctx) {
      let running = false;
      const rods: Rod[] = RODS.map((m) => makeRod(m, ROD_RUN.tAir));
      const dropped: number[][] = RODS.map(() => WAX_AT.map(() => Infinity));
      // Back from a reload: replay the model up to the saved time.
      const advance = (to: number) => {
        while (ctx.st.seconds < to) {
          const step = Math.min(1, to - ctx.st.seconds);
          rods.forEach((r) => stepRod(r, step, ROD_RUN.tHot, ROD_RUN.tAir));
          ctx.st.seconds += step;
          rods.forEach((r, i) => WAX_AT.forEach((x, j) => { if (dropped[i][j] === Infinity && rodTempAt(r, x) >= ROD_RUN.wax) dropped[i][j] = ctx.st.seconds; }));
        }
      };
      const saved = ctx.st.seconds;
      ctx.st.seconds = 0;
      advance(saved);

      const svg = s('svg', { viewBox: '0 0 340 230', class: 'scene-svg', role: 'img', 'aria-label': 'แท่งวัสดุ 4 แท่ง ปลายหนึ่งจุ่มในน้ำเดือด มีเม็ดเทียนไขติดเป็นระยะ' });
      const startBtn = h('button', { type: 'button', className: 'btn warn small', onclick: () => { running = true; ctx.refresh(); } }, '🔥 เริ่มให้ความร้อน');
      const clock = h('p', { className: 'clock' });
      const bench = h('section', { className: 'bench xbench', 'aria-label': 'โต๊ะทดลอง' },
        h('p', { className: 'scene-title' }, 'ปลายแท่งจุ่มในน้ำเดือด เม็ดเทียนไขหลุดเมื่อร้อนถึง ' + formatNumber(ROD_RUN.wax) + ' °C'),
        h('div', { className: 'scene-stage' }, svg),
        h('div', { className: 'bench-controls' }, startBtn, clock));
      const done = () => ctx.st.seconds >= ROD_RUN.seconds;

      const asks: StationAsk[] = RODS.flatMap((m): StationAsk[] => [
        {
          table: 'rods', row: m, col: 'order', label: `ลำดับเทียนเม็ดแรกหลุด ${rodName(m)}`,
          choices: () => ORDER_CHOICES, answer: () => answers[m].order, ready: done,
          todo: `${rodName(m)}: เทียนเม็ดแรก (ใกล้น้ำเดือดที่สุด) หลุดเป็นลำดับที่เท่าไร เลือกในตาราง`,
          wait: () => (running ? 'กำลังให้ความร้อน… ดูสีของแท่งและเม็ดเทียนที่หลุด' : 'กด "🔥 เริ่มให้ความร้อน" แล้วสังเกตว่าเทียนบนแท่งใดหลุดก่อน'),
          waitCue: () => (running ? null : startBtn),
        },
        {
          table: 'rods', row: m, col: 'kind', label: `${rodName(m)} เป็นตัวนำหรือฉนวนความร้อน`,
          choices: () => KIND_CHOICES, answer: () => answers[m].kind, ready: done,
          todo: `${rodName(m)} เป็นตัวนำความร้อนหรือฉนวนความร้อน เลือกในตาราง`,
          wait: '',
        },
      ]);

      return {
        bench,
        asks,
        chips: () => RODS.map((m) => ({ name: rodName(m), done: ctx.has('rods', m, 'kind'), now: false })),
        allDoneLabel: 'บันทึกครบ 4 วัสดุแล้ว',
        doneText: 'บันทึกครบแล้ว ✓ กด "ไปตอบคำถาม"',
        tick(dt) {
          if (!running || done()) return false;
          advance(Math.min(ROD_RUN.seconds, ctx.st.seconds + dt * SPEED));
          if (done()) { running = false; ctx.save(); }
          return true;
        },
        render() {
          const parts: SVGElement[] = [
            s('rect', { x: 6, y: 20, width: 46, height: 200, rx: 6, fill: 'var(--temp-1)', stroke: 'var(--ink)', 'stroke-width': 1.5 }),
            s('text', { x: 29, y: 14, 'text-anchor': 'middle', 'font-size': 11, fill: 'var(--ink)' }, 'น้ำเดือด'),
          ];
          const x0 = 40;
          const len = 290;
          rods.forEach((r, i) => {
            const y = 40 + i * 48;
            for (let k = 0; k < ROD.points - 1; k++) {
              parts.push(s('rect', { x: x0 + (k * len) / (ROD.points - 1), y, width: len / (ROD.points - 1) + 0.5, height: 10, fill: tempColor(r.t[k], 20, 100) }));
            }
            parts.push(s('rect', { x: x0, y, width: len, height: 10, fill: 'none', stroke: 'var(--ink)', 'stroke-width': 1 }));
            parts.push(s('text', { x: x0 + 18, y: y - 4, 'font-size': 12, fill: 'var(--ink)' }, rodName(RODS[i])));
            WAX_AT.forEach((x, j) => {
              const px = x0 + (x / ROD.length) * len;
              const off = dropped[i][j] !== Infinity;
              parts.push(s('ellipse', { cx: px, cy: off ? y + 32 : y + 14, rx: 5, ry: 4, fill: '#f1e6c8', stroke: 'var(--ink-2)', opacity: off ? 0.6 : 1 }));
            });
          });
          svg.replaceChildren(...parts);
          clock.textContent = `⏱ ${formatNumber(Math.floor(ctx.st.seconds / 60))} นาที ${formatNumber(Math.floor(ctx.st.seconds % 60))} วินาที (เร็วกว่าจริง ${SPEED} เท่า)`;
          startBtn.disabled = running || done();
          startBtn.textContent = done() ? `ครบ ${ROD_RUN.seconds / 60} นาทีแล้ว` : running ? '🔥 กำลังให้ความร้อน' : '🔥 เริ่มให้ความร้อน';
        },
      };
    },
  }, root, lab, home);
}
