// Heat Lab station 3 — Expand It (PLAN §8.3, D-041): five small scenes in turn (metal ball and ring,
// bimetal strip, rail joint, coloured water in a tube, balloon on a bottle). Students heat and cool each
// one, watch what happens, and record it with dropdowns. "แสดงอนุภาค" shows the particle spacing change
// while every particle keeps its size.
import {
  createAskRunner, createMissionUi, createResultTable, evidenceList, h, mountLabSteps, s, safeStore, setupQuizAndScore,
  type Answers, type AskStep, type CellEvidence, type CellValue, type QuizItem,
} from '@shared/index';
import { heat } from '@shared/constants';
import quiz from '@content/quiz/U5C1-L3.json';
import { BIMETAL, ROWS, TEMPS, bimetalBendsToward, type Scene, type Temp } from './expand-it-model';

export const EXPAND_IT = { id: 'expand-it', title: 'ความร้อนกับการขยายหรือหดตัวของสสาร', lesson: 'U5C1-L3' };
const STORE_KEY = 'heat-lab:expand-it:v1';
// JSON import types each item separately; the shape is checked by tests/unit/quiz.test.ts.
const QUIZ = quiz.items as unknown as QuizItem[];
/** A 10 m steel rail warmed by 40 °C grows by α·L·ΔT, worked out from the constants (in mm). */
const RAIL_MM = Math.round(heat.linearExpansion.steel.value * 10 * 40 * 1000);
const MODEL_NOTE = `ภาพขยายการเปลี่ยนขนาดให้เห็นชัด ของจริงโลหะขยายตัวน้อยมาก เช่น รางเหล็กยาว 10 m ร้อนขึ้น 40 °C ยาวขึ้นเพียงประมาณ ${RAIL_MM} mm และแบบจำลองไม่แสดงเวลาที่ความร้อนใช้ในการถ่ายโอน`;

interface State {
  cells: Record<string, CellValue>;
  answers: Answers;
  submitted: boolean;
  attempt: number;
  step: number;
}

/** What each scene's buttons are called, so the instructions match the bench. */
const SCENE_WORDS: Record<Scene, { hot: string; cold: string; act?: string }> = {
  ball: { hot: '🔥 ให้ความร้อน', cold: '❄ ทำให้เย็นลง', act: '⬇ หย่อนผ่านห่วง' },
  bimetal: { hot: '🔥 ให้ความร้อน', cold: '❄ ทำให้เย็นลง' },
  gap: { hot: '☀ แดดร้อน', cold: '❄ อากาศเย็น' },
  liquid: { hot: '🔥 แช่น้ำร้อน', cold: '❄ แช่น้ำเย็น' },
  gas: { hot: '🔥 แช่น้ำร้อน', cold: '❄ แช่น้ำเย็น' },
};

export function mountExpandIt(root: HTMLElement, lab: string, home: string): void {
  const fresh = (attempt = 1): State => ({ cells: {}, answers: QUIZ.map(() => null), submitted: false, attempt, step: 0 });
  let st: State = fresh();
  try {
    st = { ...st, ...JSON.parse(safeStore.get(STORE_KEY) ?? '{}') };
  } catch {
    /* start fresh */
  }
  const save = () => safeStore.set(STORE_KEY, JSON.stringify(st));

  const steps = mountLabSteps(root, { lab, title: EXPAND_IT.title, home, storeKeys: [STORE_KEY] });
  const [pane1] = steps.panes;
  pane1.classList.add('no-graph');
  const ui = createMissionUi(pane1, () => steps.go(1));

  // ── table ───────────────────────────────────────────────
  const table = createResultTable({
    caption: 'ตารางบันทึกผล สิ่งที่สังเกตได้',
    rowHead: 'สิ่งที่สังเกต',
    rows: ROWS.map((r) => r.name),
    columns: TEMPS.map((t) => ({ key: t.id, label: t.name })),
  });
  table.restore(Object.fromEntries(Object.entries(st.cells).map(([k, v]) => {
    const [scene, t] = k.split(':');
    return [`${ROWS.findIndex((r) => r.scene === scene)}:${t}`, v];
  })));
  const slot1 = h('div', { className: 'table-slot' }, table.el);

  // ── bench: one scene at a time ──────────────────────────
  // warm: −1 cold … 0 room … +1 hot, eased toward the target so students see the change happen.
  const warm: Record<Scene, number> = { ball: 0, bimetal: 0, gap: 0, liquid: 0, gas: 0 };
  const target: Record<Scene, number> = { ball: 0, bimetal: 0, gap: 0, liquid: 0, gas: 0 };
  let dropped: number | null = null; // warm value when the ball was last dropped, null when not dropped since
  let dropY = 0;
  let showParticles = false;
  let scene: Scene = 'ball';
  /** Teacher tools can pin a scene for a demo; students always see the scene the mission needs. */
  let pinned: Scene | null = null;

  const sceneTitle = h('p', { className: 'scene-title' });
  const stage = s('svg', { viewBox: '0 0 320 200', class: 'scene-svg', role: 'img' });
  const inset = s('svg', { viewBox: '0 0 90 90', class: 'particle-inset', 'aria-hidden': 'true' });
  const insetBox = h('figure', { className: 'inset', hidden: true }, h('figcaption', {}, 'อนุภาค (ขนาดเท่าเดิม)'), inset);
  const coolBtn = h('button', { type: 'button', className: 'btn ghost small', onclick: () => setTarget(-1) });
  const heatBtn = h('button', { type: 'button', className: 'btn warn small', onclick: () => setTarget(1) });
  const actBtn = h('button', { type: 'button', className: 'btn small', onclick: () => drop() });
  const partBtn = h('button', {
    type: 'button', className: 'btn ghost small', 'aria-pressed': 'false',
    onclick: () => {
      showParticles = !showParticles;
      partBtn.setAttribute('aria-pressed', String(showParticles));
      insetBox.hidden = !showParticles;
    },
  }, '⚛ อนุภาค');
  pane1.append(ui.row, ui.todo,
    h('section', { className: 'bench xbench', 'aria-label': 'โต๊ะทดลอง' },
      sceneTitle, h('div', { className: 'scene-stage' }, stage, insetBox),
      h('div', { className: 'bench-controls' }, coolBtn, heatBtn, actBtn, partBtn)),
    slot1);

  const settled = (sc: Scene) => Math.abs(warm[sc] - target[sc]) < 0.01;
  const isAt = (sc: Scene, t: Temp) => settled(sc) && target[sc] === (t === 'hot' ? 1 : -1);

  function setTarget(v: number): void {
    target[scene] = v;
    if (scene === 'ball') { dropped = null; dropY = 0; }
    runner.refresh();
  }

  function drop(): void {
    dropped = warm.ball;
    dropY = 0;
  }

  // ── what to record, in order ────────────────────────────
  const steps1: AskStep[] = ROWS.flatMap((r, ri) => TEMPS.map((t): AskStep => {
    const w = SCENE_WORDS[r.scene];
    const button = t.id === 'hot' ? w.hot : w.cold;
    const ballNeedsDrop = r.scene === 'ball';
    return {
      table, key: `${r.scene}:${t.id}`, row: ri, col: t.id,
      label: `${r.name} ${t.name}`,
      choices: () => r.choices,
      answer: () => r.answer[t.id],
      ready: () => scene === r.scene && isAt(r.scene, t.id) && (!ballNeedsDrop || (dropped !== null && dropY >= 1)),
      todo: `${r.name}${t.name}: ${r.scene === 'ball' ? 'ลูกโลหะลอดห่วงได้หรือไม่' : 'เกิดอะไรขึ้น'} เลือกในตาราง`,
      wait: ballNeedsDrop && isAt('ball', t.id)
        ? `กด "${w.act}" แล้วดูว่าลูกโลหะลอดห่วงได้หรือไม่`
        : `ฉาก${r.name}: กด "${button}" แล้วรอให้เปลี่ยนจนนิ่ง${ballNeedsDrop ? ` จากนั้นกด "${w.act}"` : ''}`,
      waitCue: () => (ballNeedsDrop && isAt('ball', t.id) ? actBtn : t.id === 'hot' ? heatBtn : coolBtn),
    };
  }));
  const runner = createAskRunner({
    steps: steps1, cells: st.cells, ui,
    onRecord: () => {
      if (runner.allDone()) steps.unlock(1);
      save();
      render();
    },
    wrongText: '✗ ยังไม่ถูก ดูภาพบนโต๊ะทดลองอีกครั้ง แล้วเลือกใหม่',
    doneText: 'สังเกตครบแล้ว ✓ กด "ไปตอบคำถาม" หรือกดให้ความร้อนและทำให้เย็นลงดูอีกครั้ง',
  });
  // The wait text for the ball changes once it is hot or cold, so recompute it on each refresh.
  const ballWait = (t: Temp) => (isAt('ball', t)
    ? `กด "${SCENE_WORDS.ball.act}" แล้วดูว่าลูกโลหะลอดห่วงได้หรือไม่`
    : `ฉากลูกโลหะกับห่วง: กด "${t === 'hot' ? SCENE_WORDS.ball.hot : SCENE_WORDS.ball.cold}" แล้วรอให้เปลี่ยนจนนิ่ง`);

  function render(): void {
    const nextStep = runner.next();
    scene = pinned ?? (nextStep ? ROWS[nextStep.row].scene : scene);
    for (const t of ['hot', 'cold'] as Temp[]) {
      const sb = steps1.find((x) => x.key === `ball:${t}`)!;
      sb.wait = ballWait(t);
    }
    ui.chips(ROWS.map((r) => ({
      name: r.name,
      done: TEMPS.every((t) => st.cells[`${r.scene}:${t.id}`] !== undefined),
      now: r.scene === scene,
    })), 'สังเกตครบ 5 ฉากแล้ว');
    const words = SCENE_WORDS[scene];
    const i = ROWS.findIndex((r) => r.scene === scene);
    sceneTitle.textContent = `ฉากที่ ${i + 1} จาก ${ROWS.length}: ${ROWS[i].name}`;
    heatBtn.textContent = words.hot;
    coolBtn.textContent = words.cold;
    actBtn.hidden = !words.act;
    if (words.act) actBtn.textContent = words.act;
    heatBtn.disabled = target[scene] === 1 && settled(scene);
    coolBtn.disabled = target[scene] === -1 && settled(scene);
    actBtn.disabled = !settled('ball') || (dropped !== null && dropY < 1);
    draw();
    runner.refresh();
  }

  // ── drawing ─────────────────────────────────────────────
  const T = { ink: 'var(--ink)', ink2: 'var(--ink-2)', hot: 'var(--temp-4)', cold: 'var(--temp-0)', card: 'var(--card)' };
  const bath = (w: number) => (w > 0.05 ? 'var(--warn-soft)' : w < -0.05 ? 'var(--glass-soft)' : 'var(--paper)');
  const metal = (w: number) => (w > 0.05 ? `color-mix(in srgb, var(--temp-4) ${Math.round(w * 70)}%, #8a9aa3)` : '#8a9aa3');

  function draw(): void {
    const w = warm[scene];
    const parts: SVGElement[] = [];
    let label = '';
    if (scene === 'ball') {
      // Ring opening 33 units; the ball is 31 at room temperature, 36 hot, 26 cold (size change drawn much larger than real).
      const r = 31 + 5 * w;
      const inner = 33;
      const top = 40 + r;
      const fall = dropped === null ? 0 : dropY;
      const stuck = dropped !== null && 31 + 5 * dropped > inner;
      const restY = 120 - Math.sqrt(Math.max(0, r * r - inner * inner)) - 2;
      const y = dropped === null ? top : stuck ? top + (restY - top) * Math.min(1, fall) : top + (185 - top) * fall;
      parts.push(
        s('line', { x1: 160, y1: 0, x2: 160, y2: y - r, stroke: T.ink2, 'stroke-width': 2 }),
        s('rect', { x: 60, y: 118, width: 200, height: 6, fill: T.ink2 }),
        s('rect', { x: 160 - inner - 2, y: 114, width: 2 * inner + 4, height: 14, rx: 3, fill: T.card, stroke: T.ink, 'stroke-width': 2 }),
        s('circle', { cx: 160, cy: y, r, fill: metal(w), stroke: T.ink, 'stroke-width': 1.5 }),
      );
      label = dropped !== null && fall >= 1 ? (stuck ? 'ลูกโลหะค้างอยู่บนห่วง' : 'ลูกโลหะลอดห่วงลงไปได้') : '';
    } else if (scene === 'bimetal') {
      // Bend sign from the constants: hot bends toward the metal that expands less (bimetalBendsToward).
      const down = bimetalBendsToward('hot') === BIMETAL.bottom ? 1 : -1;
      const k = down * w * 0.0026;
      const path = (off: number) => Array.from({ length: 23 }, (_, j) => {
        const x = j * 10;
        return `${50 + x},${100 + off + k * x * x}`;
      }).join(' ');
      parts.push(
        s('rect', { x: 20, y: 80, width: 32, height: 44, fill: T.ink2 }),
        s('polyline', { points: path(-4), fill: 'none', stroke: '#c9a64a', 'stroke-width': 8 }),
        s('polyline', { points: path(4), fill: 'none', stroke: '#8a9aa3', 'stroke-width': 8 }),
        s('text', { x: 60, y: 82, 'font-size': 13, fill: T.ink }, `${BIMETAL.top} (บน)`),
        s('text', { x: 60, y: 130, 'font-size': 13, fill: T.ink }, `${BIMETAL.bottom} (ล่าง)`),
      );
      if (w > 0.05) parts.push(s('text', { x: 160, y: 190, 'font-size': 22, 'text-anchor': 'middle' }, '🔥🔥🔥'));
    } else if (scene === 'gap') {
      const gap = 10 - 7 * w;
      const bump = Math.max(0, w) * 14;
      const top = Array.from({ length: 31 }, (_, j) => `${20 + j * 9.33},${60 - bump * Math.sin((Math.PI * j) / 30)}`).join(' ');
      parts.push(
        s('text', { x: 20, y: 30, 'font-size': 13, fill: T.ink }, 'รางไม่มีรอยต่อ'),
        s('polyline', { points: top, fill: 'none', stroke: '#8a9aa3', 'stroke-width': 7 }),
        s('text', { x: 20, y: 120, 'font-size': 13, fill: T.ink }, 'รางมีรอยต่อ (เว้นช่องว่าง)'),
        s('rect', { x: 20, y: 140, width: 140 - gap / 2, height: 8, fill: '#8a9aa3' }),
        s('rect', { x: 160 + gap / 2, y: 140, width: 140 - gap / 2, height: 8, fill: '#8a9aa3' }),
        s('line', { x1: 160 - gap / 2, x2: 160 + gap / 2, y1: 165, y2: 165, stroke: T.hot, 'stroke-width': 2 }),
        s('text', { x: 160, y: 182, 'font-size': 12, fill: T.ink, 'text-anchor': 'middle' }, 'ช่องว่าง'),
      );
      parts.push(s('text', { x: 290, y: 30, 'font-size': 24, 'text-anchor': 'middle' }, w > 0.05 ? '☀' : w < -0.05 ? '❄' : ''));
    } else if (scene === 'liquid') {
      const level = 70 - 28 * w;
      parts.push(
        s('rect', { x: 90, y: 110, width: 140, height: 80, rx: 6, fill: bath(w), stroke: T.ink2 }),
        s('circle', { cx: 160, cy: 150, r: 34, fill: 'var(--temp-1)', stroke: T.ink, 'stroke-width': 2 }),
        s('rect', { x: 154, y: 12, width: 12, height: 108, fill: T.card, stroke: T.ink, 'stroke-width': 1.5 }),
        s('rect', { x: 156, y: level, width: 8, height: 118 - level, fill: 'var(--temp-0)' }),
        ...[30, 50, 70, 90].map((y) => s('line', { x1: 166, x2: 176, y1: y, y2: y, stroke: T.ink2 })),
      );
    } else {
      const ry = 22 + 14 * w;
      const rx = 18 + 10 * w;
      parts.push(
        s('rect', { x: 90, y: 110, width: 140, height: 80, rx: 6, fill: bath(w), stroke: T.ink2 }),
        s('path', { d: 'M135 180 v-50 q0 -14 14 -18 v-12 h22 v12 q14 4 14 18 v50 z', fill: T.card, stroke: T.ink, 'stroke-width': 2 }),
        s('ellipse', { cx: 160, cy: 100 - ry, rx, ry, fill: 'var(--series-2)', opacity: 0.85 }),
      );
    }
    if (label) parts.push(s('text', { x: 160, y: 196, 'font-size': 13, 'text-anchor': 'middle', fill: T.ink }, label));
    stage.replaceChildren(...parts);
    stage.setAttribute('aria-label', `ฉาก${ROWS.find((r) => r.scene === scene)!.name} ${w > 0.5 ? 'ร้อน' : w < -0.5 ? 'เย็น' : 'อุณหภูมิห้อง'}${label ? ` ${label}` : ''}`);

    // Particle inset: same radius always; only the spacing follows the temperature.
    const gas = scene === 'gas';
    const sp = gas ? 30 + 8 * w : 22 + 4 * w;
    const off = 45 - sp;
    inset.replaceChildren(...Array.from({ length: 9 }, (_, j) =>
      s('circle', { cx: off + (j % 3) * sp, cy: off + Math.floor(j / 3) * sp, r: 7, fill: 'var(--p-solid, #56646a)' })));
  }

  let last = performance.now();
  let lastRefresh = 0;
  function frame(now: number): void {
    const dt = Math.min(0.05, Math.max(0, (now - last) / 1000));
    last = now;
    if (!document.hidden && steps.current === 0) {
      let moving = false;
      for (const sc of Object.keys(warm) as Scene[]) {
        const d = target[sc] - warm[sc];
        if (Math.abs(d) > 0.001) {
          warm[sc] += Math.sign(d) * Math.min(Math.abs(d), dt * 0.8);
          moving = true;
        } else {
          warm[sc] = target[sc];
        }
      }
      if (dropped !== null && dropY < 1) {
        dropY = Math.min(1, dropY + dt * 1.5);
        moving = true;
      }
      if (moving || now - lastRefresh > 300) {
        lastRefresh = now;
        render();
      }
    }
    requestAnimationFrame(frame);
  }

  // ── steps 2–3 ───────────────────────────────────────────
  const slot2 = h('div', { className: 'table-slot' });
  setupQuizAndScore({
    steps, lab, title: EXPAND_IT.title, items: QUIZ, state: st, save,
    aside: slot2,
    tables: () => [table.text()],
    where: (q) => {
      const list = evidenceList(q).filter((ev): ev is CellEvidence => 'cell' in ev);
      if (!list.length) return null;
      const rowName = (scene: string) => ROWS.find((r) => r.scene === scene)?.name ?? scene;
      const colName = (t: string) => TEMPS.find((x) => x.id === t)?.name ?? t;
      return `ดูตารางของฉัน: ${list.map((ev) => `${rowName(ev.cell.row)} ${colName(ev.cell.col)} = ${ev.expect}`).join(' และ ')}`;
    },
    modelNote: MODEL_NOTE,
    restart: (attempt) => { st = fresh(attempt); save(); location.reload(); },
  });

  if (steps.teacherTools) {
    steps.teacherTools.append(
      h('label', { className: 'field' }, 'เลือกฉาก (สาธิต)',
        h('select', { onchange: (e: Event) => { pinned = (e.target as HTMLSelectElement).value as Scene; render(); } },
          ...ROWS.map((r) => h('option', { value: r.scene }, r.name)))),
      h('p', { className: 'hint' }, 'การเปลี่ยนขนาดในภาพขยายให้เห็นชัดกว่าจริงมาก ใช้ถามนักเรียนเรื่องข้อจำกัดของแบบจำลองได้'),
    );
  }

  steps.onChange((step) => {
    (step === 1 ? slot2 : slot1).append(table.el);
    st.step = step;
    save();
  });
  if (runner.allDone()) steps.unlock(1);
  steps.go(st.step);
  render();
  requestAnimationFrame(frame);
}
