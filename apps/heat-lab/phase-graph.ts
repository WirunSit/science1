// Heat Lab station 4 — Phase Graph (PLAN §8.4, D-042): 100 g of ice at −10 °C heated at a steady
// 1,000 J every second until it is steam. The graph draws itself; the run pauses once in each of the
// 5 stages so students record what is in the container and what the temperature is doing.
import {
  createAskRunner, createLineChart, createMissionUi, createResultTable, createScaleZoom, evidenceList, formatNumber, h,
  mountLabSteps, s, safeStore, setupQuizAndScore,
  type Answers, type AskStep, type CellEvidence, type CellValue, type QuizItem,
} from '@shared/index';
import { curvePoint } from '@shared/physics/heat';
import quiz from '@content/quiz/U5C1-L4.json';
import { RUN, STAGES, STATE_CHOICES, TEMP_CHOICES, stageAnswer } from './phase-graph-model';

export const PHASE_GRAPH = { id: 'phase-graph', title: 'ความร้อนกับการเปลี่ยนสถานะของสสาร', lesson: 'U5C1-L4' };
const STORE_KEY = 'heat-lab:phase-graph:v2';
// JSON import types each item separately; the shape is checked by tests/unit/quiz.test.ts.
const QUIZ = quiz.items as unknown as QuizItem[];
const MODEL_NOTE = 'แบบจำลองนี้ถือว่าความร้อนจากเครื่องให้ความร้อนส่งให้สารทั้งหมด สารมีอุณหภูมิเท่ากันทั้งภาชนะ และไอน้ำอยู่ในภาชนะปิด (สมมติ) จึงร้อนเกิน 100 °C ได้ ในการทดลองจริงไอน้ำลอยออกไป และน้ำแข็งบดที่อยู่ติดก้นภาชนะละลายก่อน';
const SPEED = Number(new URLSearchParams(location.search).get('speed')) || 10;
const TOTAL_Q = STAGES.reduce((a, st) => a + st.q, 0);
const DURATION = TOTAL_Q / RUN.power;
/** When to stop and record each stage (in seconds of heating): a warming stage at its end, so the
 *  thermometer shows where it got to (ice reaches 0 °C before it starts to melt); a flat stage halfway. */
const PAUSES = STAGES.map((stage, i) => {
  const before = STAGES.slice(0, i).reduce((a, st) => a + st.q, 0);
  return (before + (stage.from === stage.to ? stage.q / 2 : stage.q)) / RUN.power;
});

interface State {
  seconds: number;
  cells: Record<string, CellValue>;
  answers: Answers;
  submitted: boolean;
  attempt: number;
  step: number;
}

export function mountPhaseGraph(root: HTMLElement, lab: string, home: string): void {
  const fresh = (attempt = 1): State => ({ seconds: 0, cells: {}, answers: QUIZ.map(() => null), submitted: false, attempt, step: 0 });
  let st: State = fresh();
  try {
    st = { ...st, ...JSON.parse(safeStore.get(STORE_KEY) ?? '{}') };
  } catch {
    /* start fresh */
  }
  const save = () => safeStore.set(STORE_KEY, JSON.stringify(st));

  const steps = mountLabSteps(root, { lab, title: PHASE_GRAPH.title, home, storeKeys: [STORE_KEY] });
  const [pane1] = steps.panes;
  const ui = createMissionUi(pane1, () => steps.go(1));

  const table = createResultTable({
    caption: 'ตารางบันทึกผล',
    rowHead: 'ช่วง',
    rows: STAGES.map((_, i) => `ช่วงที่ ${i + 1}`),
    columns: [{ key: 'state', label: 'สารในภาชนะ' }, { key: 'temp', label: 'อุณหภูมิ' }],
  });
  table.restore(Object.fromEntries(Object.entries(st.cells).map(([k, v]) => [k.replace(/^stage/, ''), v])));
  const slot1 = h('div', { className: 'table-slot' }, table.el);

  // ── bench ───────────────────────────────────────────────
  let heating = false;
  let cooling = false;
  let coolQ = 0; // heat removed after the run, in J (exploration only)
  const q = () => Math.min(TOTAL_Q, st.seconds * RUN.power) - coolQ;
  const point = () => curvePoint(STAGES, q());

  const contents = s('g');
  const plate = s('rect', { x: 40, y: 172, width: 160, height: 9, rx: 3 });
  const rig = s('svg', { viewBox: '0 0 240 220', class: 'rig-svg', role: 'img' },
    s('rect', { x: 30, y: 180, width: 180, height: 34, rx: 6, fill: 'var(--rule)', stroke: 'var(--ink)', 'stroke-width': 1.5 }),
    plate, contents,
    s('path', { d: 'M55 40 v122 a6 6 0 0 0 6 6 h118 a6 6 0 0 0 6 -6 v-122', fill: 'none', stroke: 'var(--ink)', 'stroke-width': 2.2 }));
  const zoom = createScaleZoom({ min: -20, max: 120, label: 'อุณหภูมิ' });
  const bar = h('div', { className: 'phase-bar', role: 'img' });
  const heatBtn = h('button', { type: 'button', className: 'btn warn small', onclick: () => start() }, '🔥 เปิดเครื่อง');
  const coolBtn = h('button', { type: 'button', className: 'btn ghost small', hidden: true, onclick: () => startCooling() }, '❄ ทำให้เย็นลง');
  const clock = h('p', { className: 'clock' });
  const chart = createLineChart({ xLabel: 'เวลา (s)', yLabel: 'อุณหภูมิ (°C)', xMin: 0, xMax: Math.ceil(DURATION / 50) * 50, yMin: -20, yMax: 120, yTicks: [-20, 0, 20, 40, 60, 80, 100, 120] });
  pane1.append(ui.row, ui.todo,
    h('section', { className: 'bench pgbench', 'aria-label': 'โต๊ะทดลอง' },
      rig, zoom.el, bar, h('div', { className: 'bench-controls' }, coolBtn, heatBtn, clock)),
    h('div', { className: 'graph-slot' }, chart.el),
    slot1);

  // ── what to record ──────────────────────────────────────
  const stepsList: AskStep[] = STAGES.flatMap((_, i): AskStep[] => {
    const at = () => !heating && !cooling && Math.abs(st.seconds - PAUSES[i]) < 0.01;
    return [
      {
        table, key: `stage${i}:state`, row: i, col: 'state', label: `สารในภาชนะ ช่วงที่ ${i + 1}`,
        choices: () => STATE_CHOICES, answer: () => stageAnswer(i).state, ready: at,
        todo: `ช่วงที่ ${i + 1}: ดูในบีกเกอร์และแถบสัดส่วน ตอนนี้มีสารใดในภาชนะ เลือกในตาราง`,
        wait: '', // set in render(): depends on whether the heater is on
        waitCue: () => (heating ? null : heatBtn),
      },
      {
        table, key: `stage${i}:temp`, row: i, col: 'temp', label: `อุณหภูมิ ช่วงที่ ${i + 1}`,
        choices: () => TEMP_CHOICES, answer: () => stageAnswer(i).temp, ready: at,
        todo: `ช่วงที่ ${i + 1}: ดูกราฟและอ่านเทอร์โมมิเตอร์ อุณหภูมิสูงขึ้นถึงเท่าใด หรือคงที่ เลือกในตาราง`,
        wait: '',
        waitCue: () => (heating ? null : heatBtn),
      },
    ];
  });
  const runner = createAskRunner({
    steps: stepsList, cells: st.cells, ui,
    onRecord: () => {
      if (runner.allDone()) steps.unlock(1);
      save();
      // Carry on heating by itself after the second cell of a stage.
      const n = runner.next();
      if ((!n || n.col === 'state') && st.seconds < DURATION) start();
      render();
    },
    wrongText: '✗ ยังไม่ถูก ดูภาพในบีกเกอร์ กราฟ และเทอร์โมมิเตอร์อีกครั้ง แล้วเลือกใหม่',
    doneText: 'บันทึกครบ 5 ช่วงแล้ว ✓ กด "ไปตอบคำถาม" หรือกด "❄ ทำให้เย็นลง" ดูการคายความร้อน',
  });

  function nextPause(): number {
    const n = runner.next();
    if (!n) return DURATION;
    return PAUSES[n.row];
  }

  function start(): void {
    if (heating || st.seconds >= DURATION) return;
    cooling = false;
    heating = true;
    last = performance.now();
  }

  function startCooling(): void {
    cooling = true;
    heating = false;
    coolQ = 0;
    coolSeries = [];
    last = performance.now();
  }

  // ── drawing ─────────────────────────────────────────────
  let coolSeries: [number, number][] = [];
  function render(): void {
    const p = point();
    const id = STAGES[p.stage].id;
    // Fractions in the container: ice, water, steam.
    const ice = id === 'ice' ? 1 : id === 'melting' ? 1 - p.f : 0;
    const steam = id === 'boiling' ? p.f : id === 'steam' ? 1 : 0;
    const water = 1 - ice - steam;
    const parts: SVGElement[] = [];
    if (water > 0.001) parts.push(s('rect', { x: 57, y: 166 - 60 * water, width: 126, height: 60 * water, fill: 'var(--temp-1)' }));
    for (let j = 0; j < Math.round(ice * 9); j++) {
      parts.push(s('rect', { x: 64 + (j % 3) * 38, y: 128 - Math.floor(j / 3) * 26 - 60 * water * 0.3, width: 30, height: 22, rx: 4, fill: '#e9f4f7', stroke: 'var(--ink-2)' }));
    }
    if (id === 'boiling') for (let j = 0; j < 6; j++) parts.push(s('circle', { cx: 70 + j * 20, cy: 160 - ((j * 37 + st.seconds * 40) % 50), r: 3, fill: 'none', stroke: 'var(--ink-2)' }));
    if (steam > 0.02) parts.push(s('path', { d: 'M90 40 q10 -14 0 -28 M120 40 q10 -14 0 -28 M150 40 q10 -14 0 -28', fill: 'none', stroke: 'var(--ink-2)', 'stroke-width': 2, opacity: Math.min(1, steam + 0.3) }));
    contents.replaceChildren(...parts);
    plate.setAttribute('fill', heating ? 'var(--temp-4)' : 'var(--card)');
    rig.setAttribute('aria-label', `บีกเกอร์บนเครื่องให้ความร้อน ช่วงที่ ${p.stage + 1}`);
    zoom.set(p.t);
    bar.replaceChildren(
      ...([['น้ำแข็ง', ice, 'ice'], ['น้ำ', water, 'water'], ['ไอน้ำ', steam, 'steam']] as const)
        .filter(([, v]) => v > 0.001)
        .map(([name, v, cls]) => h('span', { className: `pb-${cls}`, style: `flex:${v}` }, v > 0.18 ? name : '')),
    );
    bar.setAttribute('aria-label', `สัดส่วน น้ำแข็ง ${Math.round(ice * 100)}% น้ำ ${Math.round(water * 100)}% ไอน้ำ ${Math.round(steam * 100)}%`);
    clock.textContent = `⏱ ${formatNumber(Math.floor(st.seconds))} s`;
    heatBtn.disabled = heating || cooling || st.seconds >= DURATION || runner.next()?.ready() === true;
    heatBtn.textContent = heating ? '🔥 เปิดอยู่' : '🔥 เปิดเครื่อง';
    coolBtn.hidden = !(runner.allDone() && st.seconds >= DURATION);
    coolBtn.disabled = cooling;
    const n = runner.next();
    if (n) {
      n.wait = heating
        ? `กำลังให้ความร้อน… ดูกราฟ จะหยุดให้บันทึกช่วงที่ ${n.row + 1}`
        : st.seconds === 0
          ? 'กด "🔥 เปิดเครื่อง" ให้ความร้อนแก่น้ำแข็ง 100 g (1,000 J ทุกวินาที) แล้วดูกราฟ'
          : 'กด "🔥 เปิดเครื่อง" ให้ความร้อนต่อ';
    }
    ui.chips(STAGES.map((_, i) => ({ name: `ช่วงที่ ${i + 1}`, done: st.cells[`stage${i}:temp`] !== undefined, now: runner.next()?.row === i })), 'บันทึกครบ 5 ช่วงแล้ว');
    runner.refresh();
  }

  function drawChart(): void {
    const pts: [number, number][] = [];
    const end = Math.min(st.seconds, DURATION);
    for (let t = 0; t < end; t += 1) pts.push([t, curvePoint(STAGES, t * RUN.power).t]);
    pts.push([end, curvePoint(STAGES, end * RUN.power).t]);
    const series = [{ name: 'ให้ความร้อน', points: pts, slot: 1, marks: [] as [number, number][] }];
    if (coolSeries.length) series.push({ name: 'ทำให้เย็นลง (เวลานับใหม่)', points: coolSeries, slot: 0, marks: [] });
    chart.setSeries(series);
  }

  let last = performance.now();
  let lastChart = 0;
  function frame(now: number): void {
    const dt = Math.min(0.1, Math.max(0, (now - last) / 1000)) * SPEED;
    last = now;
    if (heating) {
      const stop = nextPause();
      st.seconds = Math.min(stop, st.seconds + dt);
      if (st.seconds >= stop) {
        heating = false;
        save();
      }
    } else if (cooling) {
      coolQ = Math.min(TOTAL_Q, coolQ + dt * RUN.power);
      coolSeries.push([coolQ / RUN.power, point().t]);
      if (coolQ >= TOTAL_Q) cooling = false;
    }
    if (!document.hidden && steps.current === 0 && (heating || cooling || now - lastChart > 400)) {
      if (now - lastChart > 120 || !heating) {
        lastChart = now;
        drawChart();
      }
      render();
    }
    requestAnimationFrame(frame);
  }

  // ── steps 2–3 ───────────────────────────────────────────
  const slot2 = h('div', { className: 'table-slot' });
  setupQuizAndScore({
    steps, lab, title: PHASE_GRAPH.title, items: QUIZ, state: st, save,
    aside: slot2,
    tables: () => [table.text()],
    where: (qi) => {
      const list = evidenceList(qi).filter((ev): ev is CellEvidence => 'cell' in ev);
      if (!list.length) return null;
      const col = (c: string) => (c === 'state' ? 'สารในภาชนะ' : 'อุณหภูมิ');
      return `ดูตารางของฉัน: ${list.map((ev) => `ช่วงที่ ${STAGES.findIndex((x) => x.id === ev.cell.row) + 1} ${col(ev.cell.col)} = ${ev.expect}`).join(' และ ')}`;
    },
    modelNote: MODEL_NOTE,
    figure: () => {
      const fig = createLineChart({ xLabel: 'เวลา (s)', yLabel: 'อุณหภูมิ (°C)', xMin: 0, xMax: Math.ceil(DURATION / 50) * 50, yMin: -20, yMax: 120, yTicks: [-20, 0, 20, 40, 60, 80, 100, 120] });
      const pts: [number, number][] = [];
      for (let t = 0; t <= DURATION; t += 1) pts.push([t, curvePoint(STAGES, t * RUN.power).t]);
      fig.setSeries([{ name: 'น้ำแข็ง 100 g ได้รับความร้อน', points: pts, slot: 1, marks: [] }]);
      return fig.el;
    },
    restart: (attempt) => { st = fresh(attempt); save(); location.reload(); },
  });

  if (steps.teacherTools) {
    steps.teacherTools.append(
      h('p', { className: 'hint' }, `ความร้อนแต่ละช่วง (จาก constants; L_f และ L_v รอครูยืนยัน): ${STAGES.map((x, i) => `ช่วงที่ ${i + 1} ${formatNumber(x.q)} J`).join(', ')} รวม ${formatNumber(TOTAL_Q)} J`),
      h('button', {
        type: 'button', className: 'btn ghost',
        onclick: () => {
          STAGES.forEach((_, i) => { st.cells[`stage${i}:state`] = stageAnswer(i).state; st.cells[`stage${i}:temp`] = stageAnswer(i).temp; });
          st.seconds = DURATION;
          save();
          location.reload();
        },
      }, 'เติมผลให้ครบ (สาธิต)'),
    );
  }

  steps.onChange((step) => {
    (step === 1 ? slot2 : slot1).append(table.el);
    st.step = step;
    save();
  });
  // Back from a reload: stay at the last pause reached (heating is off).
  if (runner.allDone()) steps.unlock(1);
  steps.go(st.step);
  drawChart();
  render();
  requestAnimationFrame(frame);
}
