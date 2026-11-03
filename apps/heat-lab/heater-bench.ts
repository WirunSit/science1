// Heat Lab station 2 — Heater Bench: a virtual lab bench (PLAN §4.2, §8.2, D-028–D-032).
// Students pour water or vegetable oil into the beaker, switch the heater on, watch the graph, and
// record each reading with a dropdown that is checked at once.
import {
  createLineChart, createResultTable, createScaleZoom, evidenceList, formatNumber, h, mountLabSteps, prefersReducedMotion,
  readingOptions, s, safeStore, setupQuizAndScore, tempColor, thermometerReading, toast,
  type Answers, type QuizItem, type RunEvidence, type Series,
} from '@shared/index';
import { heat, specificHeat, type SubstanceId } from '@shared/constants';
import { temperatureAfterHeating } from '@shared/physics/heat';
import quiz from '@content/quiz/U5C1-L2.json';

export const HEATER_BENCH = { id: 'heater-bench', title: 'ความร้อนกับการเปลี่ยนอุณหภูมิของสสาร', lesson: 'U5C1-L2' };
const STORE_KEY = 'heat-lab:heater-bench:v1';
// JSON import types each item separately; the shape is checked by tests/unit/quiz.test.ts.
const QUIZ = quiz.items as unknown as QuizItem[];

/**
 * Preset (PLAN §8.2, D-030): 140 W × 30 s = 4,200 J per row → water 100 g +10 °C, 200 g +5 °C.
 * Students see the rate as "4,200 J ทุก 30 วินาที" (no watts in ม.1).
 */
const PRESET = { t0: 25, power: 140, duration: 120 };
const TIMES = [0, 30, 60, 90, 120];
const MAX_G = 200;
type Sub = Extract<SubstanceId, 'water' | 'vegetableOil'>;
const SUBS: { id: Sub; name: string; short: string }[] = [
  { id: 'water', name: 'น้ำ', short: 'น้ำ' },
  { id: 'vegetableOil', name: 'น้ำมันพืช', short: 'น้ำมันพืช' },
];
interface Combo { key: string; sub: Sub; g: number; mission: boolean; slot: number }
/** Mission runs first (they get table columns), then the one extra run students may try. */
const COMBOS: Combo[] = [
  { key: 'water100', sub: 'water', g: 100, mission: true, slot: 0 },
  { key: 'water200', sub: 'water', g: 200, mission: true, slot: 1 },
  { key: 'oil100', sub: 'vegetableOil', g: 100, mission: true, slot: 2 },
  { key: 'oil200', sub: 'vegetableOil', g: 200, mission: false, slot: 3 },
];
const MISSION = COMBOS.filter((c) => c.mission);
/** Simulated seconds per real second (D-024). Tests pass ?speed= to finish faster; teachers can change it. */
let speed = Number(new URLSearchParams(location.search).get('speed')) || 10;
const MODEL_NOTE = 'แบบจำลองนี้ถือว่าความร้อนจากเครื่องให้ความร้อนส่งให้สารในบีกเกอร์ทั้งหมด และสารมีอุณหภูมิเท่ากันทั้งบีกเกอร์ ในการทดลองจริงมีความร้อนบางส่วนสูญเสียไปกับบีกเกอร์และอากาศ อุณหภูมิจึงเพิ่มช้ากว่านี้';

const subName = (id: Sub) => SUBS.find((x) => x.id === id)!.name;
const comboName = (c: Combo) => `${subName(c.sub)} ${c.g} g`;
const tempAt = (c: Combo, at: number) => temperatureAfterHeating(PRESET.t0, PRESET.power, at, c.g / 1000, specificHeat(c.sub));
/** What the thermometer reads at a table row: the model value rounded to the 1 °C tick (D-029). */
const readingAt = (c: Combo, row: number) => thermometerReading(tempAt(c, TIMES[row]));
/** mL in the beaker, so equal masses of oil and water stand at different heights. */
const volumeMl = (sub: Sub, g: number) => g / (heat.density[sub].value / 1000);

interface State {
  beaker: { sub: Sub | null; g: number };
  /** Combo whose run has started (0 s recorded, or heater switched on for an extra run). */
  active: string | null;
  seconds: number;
  /** Furthest time each combo was heated, to redraw its graph line. */
  reached: Record<string, number>;
  cells: Record<string, number>;
  answers: Answers;
  submitted: boolean;
  attempt: number;
  step: number;
}

/** Mount the experiment into the app root. `lab` is the app name, `home` the link back to the list. */
export function mountHeaterBench(root: HTMLElement, lab: string, home: string): void {
  const fresh = (attempt = 1): State => ({
    beaker: { sub: null, g: 0 }, active: null, seconds: 0, reached: {}, cells: {},
    answers: QUIZ.map(() => null), submitted: false, attempt, step: 0,
  });
  let st: State = fresh();
  try {
    st = { ...st, ...JSON.parse(safeStore.get(STORE_KEY) ?? '{}') };
  } catch {
    /* start fresh */
  }
  const save = () => safeStore.set(STORE_KEY, JSON.stringify(st));

  const beakerCombo = () => COMBOS.find((c) => c.sub === st.beaker.sub && c.g === st.beaker.g) ?? null;
  const activeCombo = () => COMBOS.find((c) => c.key === st.active) ?? null;
  /** Rows recorded so far for a mission combo (always a run of rows from 0 s). */
  const rowsDone = (c: Combo) => {
    let n = 0;
    while (n < TIMES.length && st.cells[`${n}:${c.key}`] !== undefined) n++;
    return n;
  };
  const isDone = (c: Combo) => rowsDone(c) === TIMES.length;
  const allDone = () => MISSION.every(isDone);
  const clearRun = (c: Combo) => {
    for (const k of Object.keys(st.cells)) if (k.endsWith(`:${c.key}`)) delete st.cells[k];
    table.clearColumn(c.key);
    st.reached[c.key] = 0;
  };

  const steps = mountLabSteps(root, { lab, title: HEATER_BENCH.title, home, storeKeys: [STORE_KEY] });
  const [pane1] = steps.panes;

  // ── results table and graph (shared by step 1 and step 2) ─
  const table = createResultTable({
    caption: 'ตารางบันทึกผล',
    rowHead: 'เวลา (s)',
    rows: TIMES,
    columns: [
      { key: 'q', label: 'ความร้อนที่ได้รับ (J)' },
      ...MISSION.map((c) => ({ key: c.key, group: 'อุณหภูมิ (°C)', label: comboName(c) })),
    ],
  });
  table.restore(st.cells);
  const CHART = { xLabel: 'เวลา (s)', yLabel: 'อุณหภูมิ (°C)', xTicks: TIMES, yMin: 20, yMax: 120 };
  const chart = createLineChart(CHART);

  function series(): Series[] {
    return COMBOS.filter((c) => (st.reached[c.key] ?? 0) > 0).map((c) => {
      const end = st.reached[c.key];
      const points: [number, number][] = [];
      for (let at = 0; at < end; at += 2) points.push([at, tempAt(c, at)]);
      points.push([end, tempAt(c, end)]);
      const marks = c.mission
        ? TIMES.flatMap((at, i): [number, number][] => (st.cells[`${i}:${c.key}`] === undefined ? [] : [[at, st.cells[`${i}:${c.key}`]]]))
        : [];
      return { name: c.mission ? comboName(c) : `${comboName(c)} (เพิ่มเติม)`, points, marks, slot: c.slot };
    });
  }

  // ── step 1: the bench ─────────────────────────────────────
  // Focusable: on small phones the chips scroll sideways (axe: scrollable-region-focusable).
  const missionBox = h('ul', { className: 'mission', 'aria-label': 'ภารกิจ', tabIndex: 0 });
  const todo = h('p', { className: 'todo', 'aria-live': 'polite' });
  const goQuiz = h('button', { type: 'button', className: 'btn go-quiz', hidden: true, onclick: () => steps.go(1) }, 'ไปตอบคำถาม ›');

  const bottles = SUBS.map((sub) => h('button', {
    type: 'button',
    className: `bottle bottle-${sub.id}`,
    'aria-label': `${sub.short}: เท 100 g ลงบีกเกอร์`,
    onclick: () => pour(sub.id),
  }, s('svg', { viewBox: '0 0 40 64', class: 'bottle-svg', 'aria-hidden': 'true' },
    s('rect', { x: 14, y: 2, width: 12, height: 10, rx: 2, fill: 'var(--ink-2)' }),
    s('path', { d: 'M14 12 h12 v8 l8 8 v30 a4 4 0 0 1 -4 4 h-20 a4 4 0 0 1 -4 -4 v-30 l8 -8 z', class: 'bottle-body', stroke: 'var(--ink)', 'stroke-width': 1.5 })),
  h('span', {}, sub.short)));

  // Beaker on the hotplate with the thermometer dipped in (viewBox units; inside bottom of the beaker at y = 168).
  const BOTTOM = 168;
  const ML_PX = 0.42; // px of liquid height per mL
  const liquid = s('rect', { x: 47, width: 106, rx: 2, height: 0, y: BOTTOM });
  const stream = s('rect', { x: 92, y: 0, width: 8, height: 0, rx: 3, opacity: 0.8 });
  const plate = s('rect', { x: 30, y: 172, width: 140, height: 9, rx: 3 });
  const led = s('circle', { cx: 160, cy: 198, r: 4 });
  const tube = s('g', {},
    s('rect', { x: 128, y: 14, width: 8, height: 146, rx: 4, fill: 'var(--card)', stroke: 'var(--ink)', 'stroke-width': 1.2 }),
    s('circle', { cx: 132, cy: 158, r: 6, fill: 'var(--temp-4)', stroke: 'var(--ink)', 'stroke-width': 1.2 }));
  const tubeColumn = s('rect', { x: 130, width: 4, rx: 2, fill: 'var(--temp-4)' });
  const massBadge = s('text', { x: 86, y: 30, 'text-anchor': 'middle', 'font-size': 16, 'font-weight': 600, 'font-family': 'IBM Plex Sans Thai, sans-serif', fill: 'var(--ink)' });
  const rig = s('svg', { viewBox: '0 0 200 220', class: 'rig-svg', role: 'img', 'aria-label': 'บีกเกอร์บนเครื่องให้ความร้อน มีเทอร์โมมิเตอร์จุ่มอยู่' },
    s('rect', { x: 20, y: 180, width: 160, height: 34, rx: 6, fill: 'var(--rule)', stroke: 'var(--ink)', 'stroke-width': 1.5 }),
    plate, led, stream, liquid,
    s('path', { d: `M45 40 v${BOTTOM - 44} a6 6 0 0 0 6 6 h98 a6 6 0 0 0 6 -6 v-${BOTTOM - 44}`, fill: 'none', stroke: 'var(--ink)', 'stroke-width': 2.2 }),
    ...[70, 100, 130].map((y) => s('line', { x1: 45, x2: 57, y1: y, y2: y, stroke: 'var(--ink-2)' })),
    tube, tubeColumn, massBadge);
  const zoom = createScaleZoom({ min: 0, max: 130, label: 'ช่องขยาย' });

  const emptyBtn = h('button', { type: 'button', className: 'btn ghost small', onclick: () => emptyBeaker() }, 'เทออก');
  const heaterBtn = h('button', { type: 'button', className: 'btn warn small', onclick: () => switchOn() }, '🔥 เปิดเครื่อง');
  const clockTime = h('span');
  const clockNote = h('span', { className: 'clock-note' });
  const clock = h('p', { className: 'clock' }, clockTime, clockNote);
  const slot1 = h('div', { className: 'table-slot' });
  pane1.append(
    h('div', { className: 'mission-row' }, missionBox, goQuiz),
    todo,
    h('section', { className: 'bench', 'aria-label': 'โต๊ะทดลอง' },
      h('div', { className: 'shelf' }, ...bottles),
      rig,
      zoom.el,
      h('div', { className: 'bench-controls' }, emptyBtn, heaterBtn, clock)),
    h('div', { className: 'graph-slot' }, chart.el),
    slot1,
  );

  let heating = false;
  let pouring = false;
  let lastFrame = 0;
  let lastChart = -1;
  let wrongPick = false;
  let askingAt = '';

  type Phase = 'empty' | 'ask0' | 'ready' | 'heating' | 'record' | 'done';
  function phase(): Phase {
    if (heating) return 'heating';
    if (!st.beaker.sub) return 'empty';
    const act = activeCombo();
    if (!act) return beakerCombo()?.mission ? 'ask0' : 'ready';
    // The 120 s row is still to record when the clock reaches the end.
    if (act.mission && !isDone(act) && TIMES[rowsDone(act)] <= st.seconds) return 'record';
    if (st.seconds >= PRESET.duration) return 'done';
    return 'ready';
  }

  /** Only touch the text when it changes, so screen readers do not re-read it every frame. */
  const setText = (el: Element, text: string) => { if (el.textContent !== text) el.textContent = text; };
  /** The one thing to touch next gets a blinking outline (PLAN §0.12). */
  function cue(el: Element | null): void {
    pane1.querySelectorAll('.cue').forEach((x) => x !== el && x.classList.remove('cue'));
    el?.classList.add('cue');
  }

  function setLevel(ml: number): void {
    liquid.setAttribute('y', String(BOTTOM - ml * ML_PX));
    liquid.setAttribute('height', String(ml * ML_PX));
  }

  function render(): void {
    const p = phase();
    const combo = activeCombo() ?? beakerCombo();
    const T = combo ? tempAt(combo, st.seconds) : PRESET.t0;

    // Once everything is recorded the checklist folds into one chip, leaving room for "ไปตอบคำถาม".
    missionBox.replaceChildren(...(allDone()
      ? [h('li', { className: 'done' }, `✓ ทดลองครบ ${MISSION.length} อย่างแล้ว`)]
      : MISSION.map((c) => h('li', { className: isDone(c) ? 'done' : c === combo ? 'now' : '' }, `${isDone(c) ? '✓' : '☐'} ${comboName(c)}`))));
    goQuiz.hidden = !allDone();

    // bench drawing
    if (!pouring) setLevel(st.beaker.sub ? volumeMl(st.beaker.sub, st.beaker.g) : 0);
    liquid.setAttribute('fill', st.beaker.sub === 'vegetableOil' ? 'var(--oil)' : tempColor(T, 0, 130));
    tube.style.display = tubeColumn.style.display = st.beaker.sub ? '' : 'none';
    const colTop = 152 - (T / 130) * 134;
    tubeColumn.setAttribute('y', String(colTop));
    tubeColumn.setAttribute('height', String(158 - colTop));
    plate.setAttribute('fill', heating ? 'var(--temp-4)' : 'var(--card)');
    led.setAttribute('fill', heating ? 'var(--warn)' : 'var(--ink-2)');
    massBadge.textContent = st.beaker.sub ? `${st.beaker.g} g` : '';
    zoom.set(st.beaker.sub ? T : PRESET.t0);
    zoom.el.classList.toggle('off', !st.beaker.sub);
    setText(clockTime, `⏱ ${formatNumber(Math.floor(st.seconds))} s`);
    setText(clockNote, speed === 1 ? 'เท่าเวลาจริง' : `เร็วกว่าจริง ${speed} เท่า`);

    // controls
    const running = st.active !== null && p !== 'done';
    bottles.forEach((b) => (b.disabled = heating || pouring || running));
    emptyBtn.disabled = heating || pouring || !st.beaker.sub;
    heaterBtn.disabled = p !== 'ready';
    setText(heaterBtn, heating ? '🔥 เปิดอยู่' : '🔥 เปิดเครื่อง');

    // the one dropdown cell
    const askRow = p === 'ask0' ? 0 : p === 'record' ? rowsDone(combo!) : -1;
    const askKey = askRow >= 0 ? `${askRow}:${combo!.key}` : '';
    if (askKey !== askingAt) {
      askingAt = askKey;
      if (askRow >= 0) {
        const prev = askRow > 0 ? st.cells[`${askRow - 1}:${combo!.key}`] : undefined;
        table.ask(askRow, combo!.key, readingOptions(readingAt(combo!, askRow), prev),
          `อุณหภูมิของ${comboName(combo!)} ที่ ${TIMES[askRow]} s`, (v) => pick(combo!, askRow, v));
      } else {
        table.cancelAsk();
      }
    }

    // what to do now
    const wrong = '✗ ยังไม่ถูก อ่านขีดในช่องขยายอีกครั้ง แล้วเลือกใหม่';
    const nextMission = MISSION.find((c) => !isDone(c));
    if (p === 'empty') {
      if (nextMission) {
        setText(todo, `ทดลอง${comboName(nextMission)}: แตะขวด${subName(nextMission.sub)}${nextMission.g > 100 ? ` ${nextMission.g / 100} ครั้ง` : ''} (ครั้งละ 100 g)`);
        cue(bottles[SUBS.findIndex((x) => x.id === nextMission.sub)]);
      } else {
        setText(todo, 'ทดลองครบภารกิจแล้ว ✓ กด "ไปตอบคำถาม" หรือลองเทน้ำมันพืช 200 g เพื่อทดลองเพิ่มเติม');
        cue(goQuiz);
      }
    } else if (p === 'ask0') {
      const more = st.beaker.g < MAX_G && COMBOS.some((c) => c.sub === st.beaker.sub && c.g > st.beaker.g && c.mission && !isDone(c));
      const redo = isDone(combo!) ? ` (${comboName(combo!)} บันทึกครบแล้ว ถ้าบันทึกใหม่ ค่าเดิมจะถูกแทนที่)` : '';
      setText(todo, wrongPick ? wrong : `อ่านอุณหภูมิเริ่มต้นในช่องขยาย แล้วเลือกค่าในตารางช่อง 0 s${more ? ' (ต้องการ 200 g แตะขวดอีกครั้ง)' : ''}${redo}`);
      cue(table.el.querySelector('td.asking'));
    } else if (p === 'ready') {
      if (!combo!.mission) {
        setText(todo, `${comboName(combo!)} เป็นการทดลองเพิ่มเติม ไม่ต้องบันทึก — กดเปิดเครื่องแล้วดูเส้นกราฟ`);
      } else {
        setText(todo, st.seconds === 0 ? 'กดเปิดเครื่องให้ความร้อน (ให้ความร้อน 4,200 J ทุก 30 วินาที)' : `บันทึกถึง ${formatNumber(st.seconds)} s แล้ว กดเปิดเครื่องเพื่อให้ความร้อนต่อ`);
      }
      cue(heaterBtn);
    } else if (p === 'heating') {
      const next = combo!.mission ? TIMES[rowsDone(combo!)] : PRESET.duration;
      setText(todo, combo!.mission ? `กำลังให้ความร้อน${comboName(combo!)} ดูเส้นกราฟ — จะหยุดให้บันทึกที่ ${next} s` : `กำลังให้ความร้อน${comboName(combo!)} ดูเส้นกราฟ จนถึง ${next} s`);
      cue(null);
    } else if (p === 'record') {
      setText(todo, wrongPick ? wrong : `ครบ ${formatNumber(st.seconds)} s แล้ว อ่านช่องขยาย แล้วเลือกค่าในตาราง`);
      cue(table.el.querySelector('td.asking'));
    } else {
      setText(todo, allDone()
        ? `${comboName(combo!)} ครบ ${PRESET.duration} s แล้ว ✓ ทดลองครบภารกิจแล้ว กด "ไปตอบคำถาม"`
        : `${comboName(combo!)} ครบ ${PRESET.duration} s แล้ว ✓ แตะ "เทออก" แล้วทดลองครั้งต่อไป`);
      cue(allDone() ? goQuiz : emptyBtn);
    }
  }

  /** Redraw the graph about once per simulated second while heating (it is a full SVG redraw). */
  function drawChart(force = false): void {
    if (!force && Math.abs(st.seconds - lastChart) < 1) return;
    lastChart = st.seconds;
    chart.setSeries(series());
  }

  /** A dropdown pick: right → write it and carry on; wrong → orange cell, try again (D-029). */
  function pick(c: Combo, row: number, v: number | string): boolean {
    if (v !== readingAt(c, row)) {
      wrongPick = true;
      render();
      return false;
    }
    if (row === 0 && Object.keys(st.cells).some((k) => k.endsWith(`:${c.key}`))) {
      if (!confirm(`บันทึก${comboName(c)}ใหม่? ค่าเดิมของ${comboName(c)}ในตารางจะถูกแทนที่`)) return false;
      clearRun(c);
    }
    wrongPick = false;
    st.cells[`${row}:${c.key}`] = readingAt(c, row);
    st.cells[`${row}:q`] = PRESET.power * TIMES[row];
    table.set(row, c.key, readingAt(c, row));
    table.set(row, 'q', st.cells[`${row}:q`]);
    askingAt = '';
    if (row === 0) {
      st.active = c.key;
      st.seconds = 0;
    } else if (row < TIMES.length - 1) {
      startHeating(); // carry on to the next row by itself
    }
    if (allDone()) steps.unlock(1);
    save();
    drawChart(true);
    render();
    return true;
  }

  /** The level rises over half a second with a stream from the bottle (instant with reduced motion). */
  function pour(sub: Sub): void {
    if (st.beaker.sub && st.beaker.sub !== sub) return toast(`ในบีกเกอร์มี${subName(st.beaker.sub)}อยู่ แตะ "เทออก" ก่อน`);
    if (st.beaker.g >= MAX_G) return toast(`บีกเกอร์ใส่ได้ไม่เกิน ${MAX_G} g`);
    const fromMl = st.beaker.sub ? volumeMl(sub, st.beaker.g) : 0;
    st.beaker = { sub, g: st.beaker.g + 100 };
    wrongPick = false;
    save();
    const toMl = volumeMl(sub, st.beaker.g);
    if (prefersReducedMotion()) return render();
    pouring = true;
    stream.setAttribute('fill', sub === 'vegetableOil' ? 'var(--oil)' : 'var(--temp-1)');
    const start = performance.now();
    const step = (now: number) => {
      const f = Math.min(1, (now - start) / 500);
      const ml = fromMl + (toMl - fromMl) * f;
      setLevel(ml);
      stream.setAttribute('height', f < 1 ? String(BOTTOM - ml * ML_PX) : '0');
      if (f < 1) {
        requestAnimationFrame(step);
      } else {
        pouring = false;
        render();
      }
    };
    render();
    requestAnimationFrame(step);
  }

  function emptyBeaker(): void {
    const act = activeCombo();
    if (act?.mission && !isDone(act)) {
      if (!confirm(`หยุดการทดลอง${comboName(act)}และเทออก? ค่าที่บันทึกของครั้งนี้จะถูกล้าง`)) return;
      clearRun(act);
      drawChart(true);
    }
    st.beaker = { sub: null, g: 0 };
    st.active = null;
    st.seconds = 0;
    wrongPick = false;
    save();
    render();
  }

  function switchOn(): void {
    if (phase() !== 'ready') return;
    if (!st.active) {
      st.active = beakerCombo()!.key; // an extra run starts when the heater is switched on
      st.seconds = 0;
      st.reached[st.active] = 0;
    }
    startHeating();
  }

  function startHeating(): void {
    heating = true;
    lastFrame = performance.now();
    requestAnimationFrame(tick);
  }

  function tick(now: number): void {
    const c = activeCombo()!;
    // The first rAF timestamp can precede performance.now(): never step backwards.
    st.seconds += Math.max(0, Math.min(0.1, (now - lastFrame) / 1000)) * speed;
    lastFrame = now;
    const stopAt = c.mission ? TIMES[rowsDone(c)] : PRESET.duration;
    if (st.seconds >= stopAt) {
      st.seconds = stopAt; // stop exactly on the row's time and wait for the reading (D-019)
      heating = false;
    }
    st.reached[c.key] = Math.max(st.reached[c.key] ?? 0, st.seconds);
    if (!heating) save();
    drawChart(!heating);
    render();
    if (heating) requestAnimationFrame(tick);
  }

  // Back from a reload: a mission run waits at its last recorded row (PLAN §4.4).
  const act0 = activeCombo();
  if (act0?.mission && !isDone(act0)) st.seconds = TIMES[Math.max(0, rowsDone(act0) - 1)];

  // ── steps 2–3: questions, score, send ─────────────────────
  const slot2 = h('div', { className: 'table-slot' });
  /** "ดูตารางของฉัน: น้ำ 100 g เวลา 60 s = 45 °C, ความร้อน 8,400 J" from the item's evidence. */
  const where = (q: QuizItem): string | null => {
    const list = evidenceList(q).filter((ev): ev is RunEvidence => 'preset' in ev);
    if (!list.length) return null;
    const cells = list.map((ev) => {
      const c = COMBOS.find((x) => x.sub === ev.preset.substance && x.g / 1000 === ev.preset.mass)!;
      return `${comboName(c)} เวลา ${ev.time} s = ${formatNumber(ev.expect.temp)} °C, ความร้อน ${formatNumber(ev.expect.q)} J`;
    });
    const hint = list.find((ev) => ev.hint)?.hint;
    return `ดูตารางของฉัน: ${cells.join(' และ ')}${hint ? ` — ${hint}` : ''}`;
  };
  setupQuizAndScore({
    steps, lab, title: HEATER_BENCH.title, items: QUIZ, state: st, save,
    aside: slot2,
    tables: () => [table.text()],
    where,
    modelNote: MODEL_NOTE,
    figure: () => {
      const fig = createLineChart(CHART);
      fig.setSeries(series().filter((se) => se.marks?.length)); // the student's recorded runs only
      return fig.el;
    },
    restart: (attempt) => {
      st = fresh(attempt);
      save();
      location.reload();
    },
  });

  // ── teacher tools (?teacher=1) ────────────────────────────
  if (steps.teacherTools) {
    steps.teacherTools.append(
      h('label', { className: 'field' }, 'ความเร็วเวลาในแบบจำลอง',
        h('select', { onchange: (e: Event) => { speed = Number((e.target as HTMLSelectElement).value); render(); } },
          ...[1, 10, 30].map((v) => h('option', { value: String(v), selected: v === speed }, v === 1 ? 'เท่าเวลาจริง' : `เร็วกว่าจริง ${v} เท่า`)))),
      h('button', {
        type: 'button',
        className: 'btn ghost',
        onclick: () => {
          // Demo on the projector: the full mission table and graph, as a careful student would record them.
          for (const c of MISSION) {
            TIMES.forEach((at, row) => {
              st.cells[`${row}:${c.key}`] = readingAt(c, row);
              st.cells[`${row}:q`] = PRESET.power * at;
            });
            st.reached[c.key] = PRESET.duration;
          }
          st.beaker = { sub: null, g: 0 };
          st.active = null;
          st.seconds = 0;
          save();
          location.reload();
        },
      }, 'เติมผลภารกิจให้ครบ (สาธิต)'),
      h('p', { className: 'hint' }, 'โหมดครูเปิดได้ทุกขั้นและแสดงเฉลยในขั้นตอบคำถาม นักเรียนไม่เห็นเครื่องมือนี้'),
    );
  }

  // ── wire the steps ────────────────────────────────────────
  steps.onChange((step) => {
    // One table node: in step 1 under the bench and graph, in step 2 beside the questions.
    (step === 1 ? slot2 : slot1).append(table.el);
    st.step = step;
    save();
  });
  slot1.append(table.el);
  if (allDone()) steps.unlock(1);
  steps.go(st.step);
  drawChart(true);
  render();
}
