// Heat Lab station 1 — Particle Box (PLAN §8.1, D-033): three boxes (solid, liquid, gas) side by side.
// Students observe the particles, then heat and cool all three with one heater and record what changes,
// with dropdowns checked at once. Particle size never changes; only their motion does.
import {
  createResultTable, createScaleZoom, evidenceList, h, mountLabSteps, readingOptions, safeStore, setupQuizAndScore,
  thermometerReading,
  type Answers, type CellEvidence, type CellValue, type QuizItem,
} from '@shared/index';
import { celsiusToKelvin } from '@shared/physics/heat';
import quiz from '@content/quiz/U5C1-L1.json';
import {
  ARRANGEMENT, CHANGE, MOTION, SIZE, STATE_ANSWERS, STATES, T_MAX, T_MIN, T_START, T_STEP, TEMP_ANSWERS, TEMP_ROWS,
  visualSpeed, type StateId,
} from './particle-box-model';

export const PARTICLE_BOX = { id: 'particle-box', title: 'แบบจำลองอนุภาคของสสารในแต่ละสถานะ', lesson: 'U5C1-L1' };
const STORE_KEY = 'heat-lab:particle-box:v1';
// JSON import types each item separately; the shape is checked by tests/unit/quiz.test.ts.
const QUIZ = quiz.items as unknown as QuizItem[];
const REAL_GAIN = Math.round((Math.sqrt(celsiusToKelvin(T_MAX) / celsiusToKelvin(T_MIN)) - 1) * 100);
const MODEL_NOTE = `แบบจำลองนี้วาดอนุภาคเป็นลูกกลมจำนวนน้อยให้มองเห็น ของจริงอนุภาคเล็กมากจนมองไม่เห็นและมีจำนวนมหาศาล ความเร็วในภาพขยายให้เห็นชัด ของจริงอนุภาคที่ ${T_MAX} °C เคลื่อนที่เร็วกว่าที่ ${T_MIN} °C เพียงประมาณ ${REAL_GAIN}% และแบบจำลองนี้ไม่แสดงการเปลี่ยนสถานะ`;

/** One dropdown to fill, in mission order. `needs` says what the thermometer must show first. */
interface Ask {
  table: 'states' | 'temps';
  row: number;
  col: string;
  needs: 'start' | 'hot' | 'cold' | 'any';
  label: string;
}
const ASKS: Ask[] = [
  { table: 'temps', row: 0, col: 'temp', needs: 'start', label: 'อุณหภูมิตอนเริ่ม' },
  ...STATES.flatMap((s, i): Ask[] => [
    { table: 'states', row: i, col: 'arrangement', needs: 'any', label: `การจัดเรียงอนุภาคของ${s.name}` },
    { table: 'states', row: i, col: 'motion', needs: 'any', label: `การเคลื่อนที่ของอนุภาคของ${s.name}` },
  ]),
  { table: 'temps', row: 1, col: 'temp', needs: 'hot', label: 'อุณหภูมิหลังให้ความร้อน' },
  { table: 'temps', row: 1, col: 'motion', needs: 'hot', label: 'การเคลื่อนที่ของอนุภาคหลังให้ความร้อน' },
  { table: 'temps', row: 1, col: 'size', needs: 'hot', label: 'ขนาดของอนุภาคหลังให้ความร้อน' },
  { table: 'temps', row: 2, col: 'temp', needs: 'cold', label: 'อุณหภูมิหลังทำให้เย็นลง' },
  { table: 'temps', row: 2, col: 'motion', needs: 'cold', label: 'การเคลื่อนที่ของอนุภาคหลังทำให้เย็นลง' },
  { table: 'temps', row: 2, col: 'size', needs: 'cold', label: 'ขนาดของอนุภาคหลังทำให้เย็นลง' },
];
const askKey = (a: Ask) => `${a.table}:${a.row}:${a.col}`;
const MISSION = [
  { name: 'สังเกต 3 สถานะ', last: 6 },
  { name: 'ให้ความร้อน', last: 9 },
  { name: 'ทำให้เย็นลง', last: 12 },
];

interface State {
  target: number;
  cells: Record<string, CellValue>;
  answers: Answers;
  submitted: boolean;
  attempt: number;
  step: number;
}

// ── particles ─────────────────────────────────────────────
// Each box is 100 × 120 model units; particles have a fixed radius (their size never changes, PLAN §8.1).
const BW = 100;
const BH = 120;
const R = 5;
interface P { x: number; y: number; vx: number; vy: number; hx: number; hy: number; ph: number; trail: [number, number][] }

function makeBox(state: StateId): P[] {
  const ps: P[] = [];
  const add = (x: number, y: number) => ps.push({ x, y, vx: 0, vy: 0, hx: x, hy: y, ph: Math.random() * Math.PI * 2, trail: [] });
  if (state === 'solid') {
    for (let r = 0; r < 4; r++) for (let c = 0; c < 5; c++) add(28 + c * 11, BH - 12 - r * 11);
  } else if (state === 'liquid') {
    for (let r = 0; r < 2; r++) for (let c = 0; c < 9; c++) add(8 + c * 10.5 + (r % 2) * 4, BH - 8 - r * 10);
  } else {
    for (let i = 0; i < 10; i++) {
      const a = Math.random() * Math.PI * 2;
      add(10 + (i % 5) * 18, 15 + Math.floor(i / 5) * 50);
      ps[i].vx = Math.cos(a);
      ps[i].vy = Math.sin(a);
    }
  }
  return ps;
}

function stepBox(state: StateId, ps: P[], f: number, dt: number, time: number): void {
  if (state === 'solid') {
    // Vibrate about the lattice site: wider and faster when hotter.
    const amp = 1.1 * f;
    for (const p of ps) {
      p.x = p.hx + amp * Math.sin(time * 9 * f + p.ph);
      p.y = p.hy + amp * Math.cos(time * 11 * f + p.ph * 1.7);
    }
    return;
  }
  if (state === 'liquid') {
    // Random jostling, a little gravity, and soft repulsion: close together but sliding past each other.
    for (const p of ps) {
      p.vx += (Math.random() - 0.5) * 220 * f * dt;
      p.vy += (Math.random() - 0.5) * 220 * f * dt + 30 * dt;
      p.vx *= 0.92;
      p.vy *= 0.92;
      const cap = 28 * f;
      const sp = Math.hypot(p.vx, p.vy);
      if (sp > cap) { p.vx *= cap / sp; p.vy *= cap / sp; }
    }
    for (let i = 0; i < ps.length; i++) {
      for (let j = i + 1; j < ps.length; j++) {
        const a = ps[i];
        const b = ps[j];
        const dx = b.x - a.x;
        const dy = b.y - a.y;
        const d = Math.hypot(dx, dy) || 0.01;
        if (d < 2 * R) {
          const push = (2 * R - d) / 2;
          a.x -= (dx / d) * push; a.y -= (dy / d) * push;
          b.x += (dx / d) * push; b.y += (dy / d) * push;
        }
      }
    }
  } else {
    // Gas: keep each particle's speed at the temperature's value, elastic collisions with the walls and each other.
    const want = 38 * f;
    for (const p of ps) {
      const sp = Math.hypot(p.vx, p.vy) || 1;
      const k = 1 + (want / sp - 1) * Math.min(1, dt * 3);
      p.vx *= k;
      p.vy *= k;
    }
    for (let i = 0; i < ps.length; i++) {
      for (let j = i + 1; j < ps.length; j++) {
        const a = ps[i];
        const b = ps[j];
        const dx = b.x - a.x;
        const dy = b.y - a.y;
        const d = Math.hypot(dx, dy);
        if (d > 0 && d < 2 * R) {
          const nx = dx / d;
          const ny = dy / d;
          const rel = (a.vx - b.vx) * nx + (a.vy - b.vy) * ny;
          if (rel > 0) { a.vx -= rel * nx; a.vy -= rel * ny; b.vx += rel * nx; b.vy += rel * ny; }
        }
      }
    }
  }
  for (const p of ps) {
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    if (p.x < R) { p.x = R; p.vx = Math.abs(p.vx); }
    if (p.x > BW - R) { p.x = BW - R; p.vx = -Math.abs(p.vx); }
    if (p.y < R) { p.y = R; p.vy = Math.abs(p.vy); }
    if (p.y > BH - R) { p.y = BH - R; p.vy = -Math.abs(p.vy); }
  }
}

/** Mount the experiment into the app root. `lab` is the app name, `home` the link back to the list. */
export function mountParticleBox(root: HTMLElement, lab: string, home: string): void {
  const fresh = (attempt = 1): State => ({ target: T_START, cells: {}, answers: QUIZ.map(() => null), submitted: false, attempt, step: 0 });
  let st: State = fresh();
  try {
    st = { ...st, ...JSON.parse(safeStore.get(STORE_KEY) ?? '{}') };
  } catch {
    /* start fresh */
  }
  const save = () => safeStore.set(STORE_KEY, JSON.stringify(st));
  // Before the mission is done the heater only works when the next step needs it.
  let temp = st.target;
  let tracking = false;
  let wrongPick = false;
  let asking = '';

  const steps = mountLabSteps(root, { lab, title: PARTICLE_BOX.title, home, storeKeys: [STORE_KEY] });
  const [pane1] = steps.panes;
  pane1.classList.add('no-graph');

  // ── tables ──────────────────────────────────────────────
  const statesTable = createResultTable({
    caption: 'ตารางที่ 1 อนุภาคในแต่ละสถานะ',
    rowHead: 'สถานะ',
    rows: STATES.map((s) => s.name),
    columns: [{ key: 'arrangement', label: 'การจัดเรียง' }, { key: 'motion', label: 'การเคลื่อนที่' }],
  });
  const tempsTable = createResultTable({
    caption: 'ตารางที่ 2 เมื่ออุณหภูมิเปลี่ยน (เทียบกับตอนเริ่ม)',
    rowHead: 'ช่วง',
    rows: TEMP_ROWS.map((r) => r.name),
    columns: [{ key: 'temp', label: 'อุณหภูมิ (°C)' }, { key: 'motion', label: 'อนุภาคเคลื่อนที่' }, { key: 'size', label: 'ขนาดอนุภาค' }],
  });
  const tableOf = (a: Ask) => (a.table === 'states' ? statesTable : tempsTable);
  const restoreTable = (table: 'states' | 'temps') => Object.fromEntries(Object.entries(st.cells)
    .filter(([k]) => k.startsWith(`${table}:`)).map(([k, v]) => [k.slice(table.length + 1), v]));
  statesTable.restore(restoreTable('states'));
  tempsTable.restore(restoreTable('temps'));
  tempsTable.set(0, 'motion', 'ใช้เทียบ');
  tempsTable.set(0, 'size', 'ใช้เทียบ');
  const tables = h('div', { className: 'tables' }, statesTable.el, tempsTable.el);
  const slot1 = h('div', { className: 'table-slot' }, tables);

  // ── bench: three boxes, thermometer, heater ─────────────
  // Focusable: on small phones the chips scroll sideways (axe: scrollable-region-focusable).
  const missionBox = h('ul', { className: 'mission', 'aria-label': 'ภารกิจ', tabIndex: 0 });
  const goQuiz = h('button', { type: 'button', className: 'btn go-quiz', hidden: true, onclick: () => steps.go(1) }, 'ไปตอบคำถาม ›');
  const todo = h('p', { className: 'todo', 'aria-live': 'polite' });
  const boxes = STATES.map((s) => {
    const canvas = h('canvas', { className: 'pbox-canvas', role: 'img', 'aria-label': `อนุภาคของ${s.name} ${s.example}` });
    const fig = h('figure', { className: `pbox pbox-${s.id}` }, h('figcaption', {}, h('strong', {}, s.name), h('span', {}, s.example)), canvas);
    return { state: s.id, canvas, fig, ps: makeBox(s.id) };
  });
  const zoom = createScaleZoom({ min: 0, max: 100, label: 'อุณหภูมิ' });
  const coolBtn = h('button', { type: 'button', className: 'btn ghost small', onclick: () => setTarget(st.target - T_STEP) }, '❄ ทำให้เย็นลง');
  const heatBtn = h('button', { type: 'button', className: 'btn warn small', onclick: () => setTarget(st.target + T_STEP) }, '🔥 ให้ความร้อน');
  // Short label on the button; the accessible name starts with the visible words (WCAG 2.5.3).
  const trackBtn = h('button', { type: 'button', className: 'btn ghost small', 'aria-pressed': 'false', 'aria-label': '🔎 ติดตาม อนุภาค 1 ตัว', onclick: () => toggleTrack() }, '🔎 ติดตาม');
  const keFill = h('span', { className: 'ke-fill' });
  pane1.append(
    h('div', { className: 'mission-row' }, missionBox, goQuiz),
    todo,
    h('section', { className: 'bench pbench', 'aria-label': 'กล่องอนุภาค' },
      h('div', { className: 'pboxes' }, ...boxes.map((b) => b.fig)),
      zoom.el,
      h('div', { className: 'bench-controls' }, coolBtn, heatBtn),
      h('div', { className: 'ke' },
        h('span', { className: 'ke-label' }, 'อนุภาคเคลื่อนที่เร็วเฉลี่ย'),
        h('span', { className: 'ke-bar', role: 'img', 'aria-label': 'แถบความเร็วเฉลี่ยของอนุภาค ยิ่งยาวยิ่งเร็ว' }, keFill),
        trackBtn)),
    slot1,
  );

  const nextAsk = () => ASKS.find((a) => st.cells[askKey(a)] === undefined) ?? null;
  const allDone = () => nextAsk() === null;
  const stable = () => Math.abs(temp - st.target) < 0.01;
  const meets = (a: Ask) => a.needs === 'any' || (stable() && (a.needs === 'start' ? temp === T_START : a.needs === 'hot' ? temp > T_START : temp < T_START));
  const choicesFor = (a: Ask): CellValue[] => {
    if (a.col === 'temp') return readingOptions(thermometerReading(temp));
    if (a.table === 'states') return a.col === 'arrangement' ? ARRANGEMENT : MOTION;
    return a.col === 'motion' ? CHANGE : SIZE;
  };
  const answerFor = (a: Ask): CellValue => {
    if (a.col === 'temp') return thermometerReading(temp);
    if (a.table === 'states') return STATE_ANSWERS[STATES[a.row].id][a.col as 'arrangement' | 'motion'];
    return TEMP_ANSWERS[TEMP_ROWS[a.row].id as 'heated' | 'cooled'][a.col as 'motion' | 'size'];
  };

  function setTarget(v: number): void {
    st.target = Math.max(T_MIN, Math.min(T_MAX, v));
    wrongPick = false;
    save();
    render();
  }

  function toggleTrack(): void {
    tracking = !tracking;
    trackBtn.setAttribute('aria-pressed', String(tracking));
    boxes.forEach((b) => b.ps.forEach((p) => (p.trail = [])));
  }

  function pick(a: Ask, v: CellValue): boolean {
    if (v !== answerFor(a)) {
      wrongPick = true;
      render();
      return false;
    }
    wrongPick = false;
    st.cells[askKey(a)] = v;
    tableOf(a).set(a.row, a.col, v);
    asking = '';
    if (allDone()) steps.unlock(1);
    save();
    render();
    return true;
  }

  /** The one thing to touch next gets a blinking outline (PLAN §0.12). */
  function cue(el: Element | null): void {
    pane1.querySelectorAll('.cue').forEach((x) => x !== el && x.classList.remove('cue'));
    el?.classList.add('cue');
  }
  const setText = (el: Element, text: string) => { if (el.textContent !== text) el.textContent = text; };

  function render(): void {
    const a = nextAsk();
    const done = MISSION.filter((m) => ASKS.slice(0, m.last).every((x) => st.cells[askKey(x)] !== undefined));
    missionBox.replaceChildren(...(allDone()
      ? [h('li', { className: 'done' }, '✓ สังเกตครบแล้ว')]
      : MISSION.map((m) => h('li', { className: done.includes(m) ? 'done' : '' }, `${done.includes(m) ? '✓' : '☐'} ${m.name}`))));
    goQuiz.hidden = !allDone();
    const free = allDone();
    heatBtn.disabled = st.target >= T_MAX || !(free || a?.needs === 'hot' || a?.needs === 'cold');
    coolBtn.disabled = st.target <= T_MIN || !(free || a?.needs === 'hot' || a?.needs === 'cold');

    // the dropdown, only once the thermometer shows what the row needs
    const key = a && meets(a) ? askKey(a) : '';
    if (key !== asking) {
      statesTable.cancelAsk();
      tempsTable.cancelAsk();
      asking = key;
      if (a && key) tableOf(a).ask(a.row, a.col, choicesFor(a), a.label, (v) => pick(a, v));
    }

    const wrong = '✗ ยังไม่ถูก ดูอนุภาคและเทอร์โมมิเตอร์อีกครั้ง แล้วเลือกใหม่';
    const askCell = () => pane1.querySelector('td.asking');
    if (!a) {
      setText(todo, 'สังเกตครบแล้ว ✓ กด "ไปตอบคำถาม" หรือลองให้ความร้อนและทำให้เย็นลงต่อ');
      cue(goQuiz);
    } else if (!meets(a)) {
      const changing = !stable();
      if (a.needs === 'hot') setText(todo, changing ? 'กำลังให้ความร้อน… รอให้เทอร์โมมิเตอร์นิ่ง' : `กด "🔥 ให้ความร้อน" ให้อุณหภูมิสูงกว่าตอนเริ่ม (${T_START} °C)`);
      else if (a.needs === 'cold') setText(todo, changing ? 'กำลังทำให้เย็นลง… รอให้เทอร์โมมิเตอร์นิ่ง' : `กด "❄ ทำให้เย็นลง" ให้อุณหภูมิต่ำกว่าตอนเริ่ม (${T_START} °C)`);
      else setText(todo, 'รอให้เทอร์โมมิเตอร์นิ่ง');
      cue(changing ? null : a.needs === 'cold' ? coolBtn : heatBtn);
    } else if (wrongPick) {
      setText(todo, wrong);
      cue(askCell());
    } else {
      const s = a.table === 'states' ? STATES[a.row] : null;
      if (a.col === 'temp') setText(todo, 'อ่านเทอร์โมมิเตอร์ แล้วเลือกค่าในตารางที่ 2');
      else if (s && a.col === 'arrangement') setText(todo, `ดูกล่อง${s.name}: อนุภาคจัดเรียงอย่างไร เลือกในตารางที่ 1`);
      else if (s) setText(todo, `ดูกล่อง${s.name}: อนุภาคเคลื่อนที่อย่างไร (แตะ 🔎 ติดตาม เพื่อดูเส้นทางของอนุภาค)`);
      else if (a.col === 'motion') setText(todo, 'เทียบกับตอนเริ่ม อนุภาคเคลื่อนที่เร็วขึ้นหรือช้าลง เลือกในตารางที่ 2');
      else setText(todo, 'เทียบกับตอนเริ่ม ขนาดของอนุภาคแต่ละลูกเปลี่ยนไปหรือไม่ เลือกในตารางที่ 2');
      cue(askCell());
    }
    zoom.set(temp);
    keFill.style.width = `${Math.round((visualSpeed(temp) / visualSpeed(T_MAX)) * 100)}%`;
  }

  // ── animation ───────────────────────────────────────────
  let last = performance.now();
  let lastRender = 0;
  function frame(now: number): void {
    const dt = Math.min(0.05, Math.max(0, (now - last) / 1000));
    last = now;
    if (!document.hidden && steps.current === 0) {
      // The thermometer follows the heater at 15 °C per second, so students see it change, then settle.
      if (!stable()) {
        const d = st.target - temp;
        temp += Math.sign(d) * Math.min(Math.abs(d), 15 * dt);
        if (stable()) temp = st.target;
      }
      const f = visualSpeed(temp);
      for (const b of boxes) {
        stepBox(b.state, b.ps, f, dt, now / 1000);
        draw(b);
      }
      if (now - lastRender > 120) {
        lastRender = now;
        render();
      }
    }
    requestAnimationFrame(frame);
  }

  function draw(b: (typeof boxes)[number]): void {
    const c = b.canvas;
    const w = c.clientWidth;
    const hgt = c.clientHeight;
    if (!w || !hgt) return;
    const dpr = window.devicePixelRatio || 1;
    if (c.width !== Math.round(w * dpr) || c.height !== Math.round(hgt * dpr)) {
      c.width = Math.round(w * dpr);
      c.height = Math.round(hgt * dpr);
    }
    const ctx = c.getContext('2d')!;
    const k = Math.min(w / BW, hgt / BH);
    ctx.setTransform(dpr * k, 0, 0, dpr * k, dpr * (w - BW * k) / 2, dpr * (hgt - BH * k) / 2);
    const css = getComputedStyle(c);
    ctx.clearRect(-BW, -BH, 3 * BW, 3 * BH);
    ctx.strokeStyle = css.getPropertyValue('--ink').trim() || '#1f2a2e';
    ctx.lineWidth = 1.2;
    ctx.strokeRect(0.5, 0.5, BW - 1, BH - 1);
    const fill = css.getPropertyValue(`--p-${b.state}`).trim() || '#0e6b70';
    const tracked = b.state === 'solid' ? 7 : b.state === 'liquid' ? 4 : 0;
    b.ps.forEach((p, i) => {
      if (tracking && i === tracked) {
        p.trail.push([p.x, p.y]);
        if (p.trail.length > 90) p.trail.shift();
        ctx.strokeStyle = css.getPropertyValue('--warn').trim() || '#b4441c';
        ctx.lineWidth = 1;
        ctx.beginPath();
        p.trail.forEach(([x, y], j) => (j ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
        ctx.stroke();
      }
      ctx.beginPath();
      ctx.arc(p.x, p.y, R, 0, Math.PI * 2);
      ctx.fillStyle = tracking && i === tracked ? css.getPropertyValue('--warn').trim() || '#b4441c' : fill;
      ctx.fill();
    });
  }

  // ── steps 2–3 ───────────────────────────────────────────
  const slot2 = h('div', { className: 'table-slot' });
  /** "ดูตารางของฉัน: ของแข็ง · การเคลื่อนที่ = สั่นอยู่กับที่" from the item's evidence. */
  const where = (q: QuizItem): string | null => {
    const list = evidenceList(q).filter((ev): ev is CellEvidence => 'cell' in ev);
    if (!list.length) return null;
    const colName: Record<string, string> = { arrangement: 'การจัดเรียง', motion: 'การเคลื่อนที่', size: 'ขนาดอนุภาค' };
    const rowName = (table: string, row: string) => (table === 'states' ? STATES.find((s) => s.id === row)?.name : TEMP_ROWS.find((r) => r.id === row)?.name) ?? row;
    const hint = list.find((ev) => ev.hint)?.hint;
    return `ดูตารางของฉัน: ${list.map((ev) => `${rowName(ev.cell.table, ev.cell.row)} · ${colName[ev.cell.col] ?? ev.cell.col} = ${ev.expect}`).join(' และ ')}${hint ? ` — ${hint}` : ''}`;
  };
  setupQuizAndScore({
    steps, lab, title: PARTICLE_BOX.title, items: QUIZ, state: st, save,
    aside: slot2,
    tables: () => [statesTable.text(), tempsTable.text()],
    where,
    modelNote: MODEL_NOTE,
    restart: (attempt) => {
      st = fresh(attempt);
      save();
      location.reload();
    },
  });

  // ── teacher tools ───────────────────────────────────────
  if (steps.teacherTools) {
    steps.teacherTools.append(
      h('label', { className: 'field' }, 'ตั้งอุณหภูมิอิสระ (สาธิต)',
        h('select', { onchange: (e: Event) => { st.target = Number((e.target as HTMLSelectElement).value); render(); } },
          ...[10, 30, 50, 70, 90].map((v) => h('option', { value: String(v), selected: v === st.target }, `${v} °C`)))),
      h('p', { className: 'hint' }, `ความเร็วในภาพขยายจากของจริง (ของจริงต่างกันเพียงประมาณ ${REAL_GAIN}% ระหว่าง ${T_MIN} °C กับ ${T_MAX} °C) ใช้อภิปรายเรื่องข้อจำกัดของแบบจำลองได้`),
    );
  }

  // ── wire the steps ──────────────────────────────────────
  steps.onChange((step) => {
    (step === 1 ? slot2 : slot1).append(tables);
    st.step = step;
    save();
  });
  if (allDone()) steps.unlock(1);
  steps.go(st.step);
  render();
  requestAnimationFrame(frame);
}
