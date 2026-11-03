// One Web Lab experiment (PLAN §4.1–4.4) from a small spec: the lab supplies its bench, tables, the
// cells to record in order, and its quiz; this file does the rest — saving, the 3-step frame, mission
// chips and "ตอนนี้ให้ทำ", dropdown recording, the animation loop, steps 2–3, and teacher tools.
// Cell keys are "<table>/<row id>/<column key>", the same triple quiz evidence uses (evidence.cell).
import { h, safeStore } from '../dom';
import { formatNumber } from '../format';
import { mountLabSteps, type LabSteps } from './LabSteps';
import { createAskRunner, createMissionUi, type AskRunner, type AskStep, type MissionUi } from './Mission';
import { setupQuizAndScore } from './QuizAndScore';
import { evidenceList, type Answers, type CellEvidence, type QuizItem } from './QuizRunner';
import { createResultTable, type CellValue, type ResultTable } from './ResultTable';

export interface StationTable {
  key: string;
  caption: string;
  rowHead: string;
  rows: { id: string; name: string }[];
  columns: { key: string; label: string; group?: string }[];
}

/** One cell to record, in mission order (see AskStep; table/row/col are ids here). */
export interface StationAsk {
  table: string;
  row: string;
  col: string;
  label: string;
  choices(): CellValue[];
  answer(): CellValue;
  ready(): boolean;
  todo: string | (() => string);
  wait: string | (() => string);
  waitCue?(): Element | null;
}

export interface StationBase {
  cells: Record<string, CellValue>;
  answers: Answers;
  submitted: boolean;
  attempt: number;
  step: number;
}

export interface StationCtx<S> {
  st: S & StationBase;
  save(): void;
  steps: LabSteps;
  ui: MissionUi;
  tables: Record<string, ResultTable>;
  /** Re-check the next cell and redraw (call after a button press). */
  refresh(): void;
  isDone(): boolean;
  /** Has this cell been recorded? */
  has(table: string, row: string, col: string): boolean;
}

export interface StationParts {
  bench: HTMLElement;
  graph?: HTMLElement;
  asks: StationAsk[];
  chips(): { name: string; done: boolean; now?: boolean }[];
  allDoneLabel: string;
  doneText: string;
  wrongText?: string;
  /** Advance the simulation by dt seconds of real time; return true when the picture changed. */
  tick?(dt: number): boolean;
  /** Redraw the bench from the current state. */
  render?(): void;
  teacher?(tools: HTMLElement): void;
  figure?(kind: 'graph'): HTMLElement;
}

export interface StationSpec<S> {
  id: string;
  title: string;
  lesson: string;
  /** App name in the header and on the score card. */
  storeKey: string;
  quiz: QuizItem[];
  modelNote: string;
  tables: StationTable[];
  /** Station-specific saved state (cells, answers… are added). */
  initial(): S;
  build(ctx: StationCtx<S>): StationParts;
}

export const cellKey = (table: string, row: string, col: string) => `${table}/${row}/${col}`;

export function mountStation<S extends object>(spec: StationSpec<S>, root: HTMLElement, lab: string, home: string): void {
  // The station's own state must not reuse a name the frame keeps (e.g. "step" is the open lab step).
  const reserved = Object.keys(spec.initial()).filter((k) => ['cells', 'answers', 'submitted', 'attempt', 'step'].includes(k));
  if (reserved.length) throw new Error(`${spec.id}: state name ${reserved.join(', ')} is reserved by mountStation`);
  const fresh = (attempt = 1) => ({ ...spec.initial(), cells: {}, answers: spec.quiz.map(() => null), submitted: false, attempt, step: 0 }) as S & StationBase;
  let st = fresh();
  try {
    st = { ...st, ...JSON.parse(safeStore.get(spec.storeKey) ?? '{}') };
  } catch {
    /* start fresh */
  }
  const save = () => safeStore.set(spec.storeKey, JSON.stringify(st));

  const steps = mountLabSteps(root, { lab, title: spec.title, home, storeKeys: [spec.storeKey] });
  const [pane1] = steps.panes;
  const ui = createMissionUi(pane1, () => steps.go(1));

  const tables: Record<string, ResultTable> = {};
  for (const t of spec.tables) {
    const table = createResultTable({ caption: t.caption, rowHead: t.rowHead, rows: t.rows.map((r) => r.name), columns: t.columns });
    const saved: Record<string, CellValue> = {};
    for (const [k, v] of Object.entries(st.cells)) {
      const [tk, row, col] = k.split('/');
      const ri = t.rows.findIndex((r) => r.id === row);
      if (tk === t.key && ri >= 0) saved[`${ri}:${col}`] = v;
    }
    table.restore(saved);
    tables[t.key] = table;
  }
  const tableBox = h('div', { className: spec.tables.length > 1 ? 'tables' : '' }, ...Object.values(tables).map((t) => t.el));
  const slot1 = h('div', { className: 'table-slot' }, tableBox);
  const slot2 = h('div', { className: 'table-slot' });

  let runner: AskRunner;
  const ctx: StationCtx<S> = {
    st, save, steps, ui, tables,
    refresh: () => { parts.render?.(); refreshAsks(); },
    isDone: () => runner.allDone(),
    has: (t, r, c) => st.cells[cellKey(t, r, c)] !== undefined,
  };
  const parts = spec.build(ctx);
  if (!parts.graph) pane1.classList.add('no-graph');
  pane1.append(ui.row, ui.todo, parts.bench, ...(parts.graph ? [h('div', { className: 'graph-slot' }, parts.graph)] : []), slot1);

  const asks: (AskStep & { src: StationAsk })[] = parts.asks.map((a) => {
    const t = spec.tables.find((x) => x.key === a.table)!;
    return {
      src: a,
      table: tables[a.table], key: cellKey(a.table, a.row, a.col), row: t.rows.findIndex((r) => r.id === a.row), col: a.col,
      label: a.label, choices: a.choices, answer: a.answer, ready: a.ready, todo: '', wait: '', waitCue: a.waitCue,
    };
  });
  runner = createAskRunner({
    steps: asks, cells: st.cells, ui,
    onRecord: () => {
      if (runner.allDone()) steps.unlock(1);
      save();
      parts.render?.();
    },
    wrongText: parts.wrongText,
    doneText: parts.doneText,
  });
  function refreshAsks(): void {
    // Instructions may depend on the bench state, so they are read fresh each time.
    for (const a of asks) {
      a.todo = typeof a.src.todo === 'function' ? a.src.todo() : a.src.todo;
      a.wait = typeof a.src.wait === 'function' ? a.src.wait() : a.src.wait;
    }
    ui.chips(parts.chips(), parts.allDoneLabel);
    runner.refresh();
    // Several tables would squeeze the bench on a phone: while experimenting, show only the one being
    // filled in (the last one once everything is recorded). Steps 2–3 show them all.
    if (spec.tables.length > 1) {
      const next = runner.next() as (AskStep & { src: StationAsk }) | null;
      const focus = steps.current === 0 ? (next?.src.table ?? spec.tables[spec.tables.length - 1].key) : null;
      for (const t of spec.tables) tables[t.key].el.hidden = focus !== null && t.key !== focus;
    }
  }

  setupQuizAndScore({
    steps, lab, title: spec.title, items: spec.quiz, state: st, save,
    aside: slot2,
    tables: () => Object.values(tables).map((t) => t.text()),
    where: (q) => {
      const list = evidenceList(q).filter((ev): ev is CellEvidence => 'cell' in ev);
      if (!list.length) return null;
      const text = list.map((ev) => {
        const t = spec.tables.find((x) => x.key === ev.cell.table);
        const row = t?.rows.find((r) => r.id === ev.cell.row)?.name ?? ev.cell.row;
        const col = t?.columns.find((c) => c.key === ev.cell.col);
        const value = typeof ev.expect === 'number' ? formatNumber(ev.expect) : ev.expect;
        return `${row} · ${col ? `${col.group ? `${col.group} ` : ''}${col.label}` : ev.cell.col} = ${value}`;
      });
      const hint = list.find((ev) => ev.hint)?.hint;
      return `ดูตารางของฉัน: ${text.join(' และ ')}${hint ? ` — ${hint}` : ''}`;
    },
    modelNote: spec.modelNote,
    figure: parts.figure,
    restart: (attempt) => { st = fresh(attempt); save(); location.reload(); },
  });

  if (steps.teacherTools) {
    parts.teacher?.(steps.teacherTools);
    steps.teacherTools.append(h('button', {
      type: 'button', className: 'btn ghost',
      onclick: () => {
        // Demo on the projector: every mission cell filled with the right value.
        for (const a of asks) st.cells[a.key] = a.answer();
        save();
        location.reload();
      },
    }, 'เติมผลภารกิจให้ครบ (สาธิต)'));
  }

  steps.onChange((step) => {
    (step === 1 ? slot2 : slot1).append(tableBox);
    st.step = step;
    save();
    refreshAsks();
  });
  if (runner.allDone()) steps.unlock(1);
  steps.go(st.step);
  parts.render?.();
  refreshAsks();

  let last = performance.now();
  let lastRefresh = 0;
  function frame(now: number): void {
    const dt = Math.min(0.1, Math.max(0, (now - last) / 1000));
    last = now;
    if (!document.hidden && steps.current === 0) {
      if (parts.tick?.(dt)) parts.render?.();
      // Instructions, chips and the dropdown a few times a second is plenty.
      if (now - lastRefresh > 150) {
        lastRefresh = now;
        refreshAsks();
      }
    }
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
}
