// Heat Transfer Studio station 2 — Convection Pot (PLAN §9.2, D-045): a container of water with dye at
// the bottom. Heating the bottom middle sets up two convection cells (rising over the heater, sinking at
// the sides); heating the top only warms a layer of water at the top that stays there. The flow is a
// synthetic stream function that gives these directions (allowed by the plan), not a fluid solver.
import { h, mountStation, s, tempColor, type QuizItem, type StationAsk } from '@shared/index';
import quiz from '@content/quiz/U5C2-L2a.json';
import { FLOW_CHOICES, HOT_CHOICES, POT_ANSWERS, POT_ROWS } from './answers';

export const CONVECTION_POT = { id: 'convection-pot', title: 'การพาความร้อน', lesson: 'U5C2-L2' };
const W = 300;
const H = 190;
const N = 260;
const WATCH = 7; // seconds of watching before the observation can be recorded

type Mode = 'bottom' | 'top';

export function mountConvectionPot(root: HTMLElement, lab: string, home: string): void {
  mountStation<Record<string, never>>({
    ...CONVECTION_POT,
    storeKey: 'hts:convection-pot:v1',
    quiz: quiz.items as unknown as QuizItem[],
    modelNote: 'การไหลในแบบจำลองนี้สร้างให้มีทิศทางเหมือนของจริง (น้ำร้อนเหนือแหล่งความร้อนลอยขึ้น เย็นลงแล้วจมลงด้านข้าง) ไม่ได้คำนวณการไหลของน้ำทุกจุด ของจริงการไหลไม่สม่ำเสมอและสีย้อมค่อย ๆ กระจายไปทั่ว',
    tables: [{
      key: 'pot', caption: 'ตารางบันทึกผล', rowHead: 'การทดลอง',
      rows: POT_ROWS.map((r) => ({ id: r.id, name: r.name })),
      columns: [{ key: 'hot', label: 'น้ำที่ร้อนขึ้น' }, { key: 'flow', label: 'สีย้อม' }],
    }],
    initial: () => ({}),
    build(ctx) {
      let mode: Mode | null = null;
      let watched = 0;
      let strength = 0;
      let warmth = 0;
      const dots: [number, number][] = [];
      const reset = (m: Mode) => {
        mode = m;
        watched = 0;
        strength = 0;
        warmth = 0;
        dots.length = 0;
        // Dye dropped in a small cloud at the bottom middle.
        for (let i = 0; i < N; i++) dots.push([W / 2 + (Math.random() - 0.5) * 50, H - 8 - Math.random() * 18]);
        ctx.refresh();
      };
      const bottomBtn = h('button', { type: 'button', className: 'btn warn small', onclick: () => reset('bottom') }, '🔥 ให้ความร้อนที่ก้น');
      const topBtn = h('button', { type: 'button', className: 'btn warn small', onclick: () => reset('top') }, '🔥 ให้ความร้อนด้านบน');
      const svg = s('svg', { viewBox: `0 0 ${W + 20} ${H + 30}`, class: 'scene-svg', role: 'img' });
      const bench = h('section', { className: 'bench xbench', 'aria-label': 'โต๊ะทดลอง' },
        h('p', { className: 'scene-title' }, 'บีกเกอร์ใส่น้ำ หยดสีย้อม (ด่างทับทิม) ไว้ที่ก้น'),
        h('div', { className: 'scene-stage' }, svg),
        h('div', { className: 'bench-controls' }, bottomBtn, topBtn));

      /**
       * Two convection cells over a bottom heater: ψ = −A·sin(2πx/W)·sin(πy/H), u = ∂ψ/∂y, v = −∂ψ/∂x
       * (screen y grows downward): water rises in the middle, spreads out along the top, sinks at the walls.
       */
      function velocity(x: number, y: number): [number, number] {
        if (mode !== 'bottom') return [0, 0];
        const kx = (2 * Math.PI) / W;
        const ky = Math.PI / H;
        const a = (40 / kx) * strength; // fastest vertical flow about 40 px/s
        const u = -a * ky * Math.sin(kx * x) * Math.cos(ky * y);
        const v = a * kx * Math.cos(kx * x) * Math.sin(ky * y);
        return [u, v];
      }

      const ready = (m: Mode) => () => mode === m && watched >= WATCH;
      const btn = (m: Mode) => (m === 'bottom' ? bottomBtn : topBtn);
      const asks: StationAsk[] = POT_ROWS.flatMap((r): StationAsk[] => [
        {
          table: 'pot', row: r.id, col: 'hot', label: `น้ำที่ร้อนขึ้น ${r.name}`,
          choices: () => HOT_CHOICES, answer: () => POT_ANSWERS[r.id].hot, ready: ready(r.id),
          todo: `${r.name}: น้ำที่ร้อนขึ้น (สีแดง) เคลื่อนที่อย่างไร เลือกในตาราง`,
          wait: () => (mode === r.id ? 'กำลังให้ความร้อน… ดูสีย้อมและสีของน้ำสักครู่' : `กด "${btn(r.id).textContent}" แล้วสังเกตสีย้อม`),
          waitCue: () => (mode === r.id ? null : btn(r.id)),
        },
        {
          table: 'pot', row: r.id, col: 'flow', label: `สีย้อม ${r.name}`,
          choices: () => FLOW_CHOICES, answer: () => POT_ANSWERS[r.id].flow, ready: ready(r.id),
          todo: `${r.name}: สีย้อมหมุนวนทั่วภาชนะหรือแทบไม่หมุนวน เลือกในตาราง`,
          wait: '',
        },
      ]);

      return {
        bench,
        asks,
        chips: () => POT_ROWS.map((r) => ({ name: r.name, done: ctx.has('pot', r.id, 'flow'), now: mode === r.id })),
        allDoneLabel: 'บันทึกครบ 2 แบบแล้ว',
        doneText: 'บันทึกครบแล้ว ✓ กด "ไปตอบคำถาม" หรือลองให้ความร้อนอีกแบบดู',
        tick(dt) {
          if (!mode) return false;
          watched += dt;
          strength = Math.min(1, strength + dt / 2.5);
          warmth = Math.min(1, warmth + dt / 4);
          for (const d of dots) {
            const [u, v] = velocity(d[0], d[1]);
            // Small random spread so the dye looks like dye, not beads on rails.
            d[0] = Math.min(W - 3, Math.max(3, d[0] + (u + (Math.random() - 0.5) * 4) * dt));
            d[1] = Math.min(H - 3, Math.max(3, d[1] + (v + (Math.random() - 0.5) * 4) * dt));
          }
          return true;
        },
        render() {
          const parts: SVGElement[] = [];
          // Temperature map: bottom heating mixes warmth through; top heating makes a warm top layer.
          for (let row = 0; row < 8; row++) {
            const y = (row + 0.5) / 8;
            const t = mode === 'bottom' ? 30 + 25 * warmth * (0.7 + 0.3 * (1 - y)) : mode === 'top' ? 30 + 40 * warmth * Math.max(0, 1 - y * 3) : 30;
            parts.push(s('rect', { x: 10, y: 10 + (row * H) / 8, width: W, height: H / 8 + 0.5, fill: tempColor(t, 20, 90), opacity: 0.55 }));
          }
          parts.push(s('path', { d: `M10 10 v${H} h${W} v-${H}`, fill: 'none', stroke: 'var(--ink)', 'stroke-width': 2.5 }));
          for (const [x, y] of dots) parts.push(s('circle', { cx: 10 + x, cy: 10 + y, r: 1.8, fill: '#7a1f6e' }));
          if (mode === 'bottom') parts.push(s('text', { x: 10 + W / 2, y: H + 26, 'text-anchor': 'middle', 'font-size': 18 }, '🔥'));
          if (mode === 'top') parts.push(s('rect', { x: 20, y: 0, width: W - 20, height: 8, rx: 3, fill: 'var(--temp-4)' }));
          svg.replaceChildren(...parts);
          svg.setAttribute('aria-label', mode === 'bottom' ? 'ให้ความร้อนที่ก้นภาชนะ สีย้อมลอยขึ้นตรงกลางแล้วจมลงด้านข้าง' : mode === 'top' ? 'ให้ความร้อนด้านบน น้ำร้อนอยู่ด้านบน สีย้อมอยู่ที่ก้น' : 'บีกเกอร์น้ำ ยังไม่ได้ให้ความร้อน');
          bottomBtn.disabled = mode === 'bottom';
          topBtn.disabled = mode === 'top';
        },
      };
    },
  }, root, lab, home);
}
