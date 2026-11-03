// Step 1 guidance shared by every experiment (PLAN §4.2, §0.12): the mission chips, the "ตอนนี้ให้ทำ"
// line, the blinking cue on the one thing to touch next, and a runner that asks for one dropdown at a
// time, only once the bench shows what that cell needs (checked at once, D-029).
import { h } from '../dom';
import type { CellValue, ResultTable } from './ResultTable';

export interface MissionUi {
  /** Mission chips + "ไปตอบคำถาม ›" — put this first in the step pane. */
  row: HTMLElement;
  todo: HTMLElement;
  goQuiz: HTMLButtonElement;
  chips(items: { name: string; done: boolean; now?: boolean }[], allDoneLabel: string): void;
  say(text: string): void;
  /** Blinking outline on the one thing to touch next (null clears it). */
  cue(el: Element | null): void;
}

export function createMissionUi(scope: HTMLElement, onGoQuiz: () => void): MissionUi {
  // Focusable: on small phones the chips scroll sideways (axe: scrollable-region-focusable).
  const list = h('ul', { className: 'mission', 'aria-label': 'ภารกิจ', tabIndex: 0 });
  const goQuiz = h('button', { type: 'button', className: 'btn go-quiz', hidden: true, onclick: onGoQuiz }, 'ไปตอบคำถาม ›');
  const todo = h('p', { className: 'todo', 'aria-live': 'polite' });
  return {
    row: h('div', { className: 'mission-row' }, list, goQuiz),
    todo,
    goQuiz,
    chips(items, allDoneLabel) {
      const all = items.every((i) => i.done);
      // Once everything is recorded the checklist folds into one chip, leaving room for "ไปตอบคำถาม".
      list.replaceChildren(...(all
        ? [h('li', { className: 'done' }, `✓ ${allDoneLabel}`)]
        : items.map((i) => h('li', { className: i.done ? 'done' : i.now ? 'now' : '' }, `${i.done ? '✓' : '☐'} ${i.name}`))));
      goQuiz.hidden = !all;
    },
    // Only touch the text when it changes, so screen readers do not re-read it every frame.
    say(text) { if (todo.textContent !== text) todo.textContent = text; },
    cue(el) {
      scope.querySelectorAll('.cue').forEach((x) => x !== el && x.classList.remove('cue'));
      el?.classList.add('cue');
    },
  };
}

/** One dropdown cell of the mission, asked in order. */
export interface AskStep {
  table: ResultTable;
  /** Saved under this key in the experiment's cells. */
  key: string;
  row: number;
  col: string;
  /** Screen-reader name of the dropdown, e.g. "ลูกโลหะเมื่อร้อน". */
  label: string;
  choices(): CellValue[];
  answer(): CellValue;
  /** Does the bench show what this cell needs right now (e.g. the ball has been heated and dropped)? */
  ready(): boolean;
  /** What to do when ready ("…แล้วเลือกในตาราง"). */
  todo: string;
  /** What to do first when not ready ("กด 🔥 ให้ความร้อน แล้ว…"), and what to cue then. */
  wait: string;
  waitCue?(): Element | null;
}

export interface AskRunner {
  next(): AskStep | null;
  allDone(): boolean;
  /** Re-check the next cell: open its dropdown, update the instruction and the cue. */
  refresh(): void;
}

export function createAskRunner(o: {
  steps: AskStep[];
  cells: Record<string, CellValue>;
  ui: MissionUi;
  /** Called after each right pick (save, unlock step 2, redraw). */
  onRecord(): void;
  wrongText?: string;
  doneText: string;
}): AskRunner {
  let asking = '';
  let wrong = false;
  const next = () => o.steps.find((s) => o.cells[s.key] === undefined) ?? null;

  function refresh(): void {
    const s = next();
    const key = s && s.ready() ? s.key : '';
    if (key !== asking) {
      new Set(o.steps.map((x) => x.table)).forEach((t) => t.cancelAsk());
      asking = key;
      wrong = false;
      if (s && key) {
        s.table.ask(s.row, s.col, s.choices(), s.label, (v) => {
          if (v !== s.answer()) {
            wrong = true;
            refresh();
            return false;
          }
          o.cells[s.key] = v;
          s.table.set(s.row, s.col, v);
          asking = '';
          wrong = false;
          o.onRecord();
          refresh();
          return true;
        });
      }
    }
    const cell = () => o.ui.todo.closest('.step-pane')?.querySelector('td.asking') ?? null;
    if (!s) {
      o.ui.say(o.doneText);
      o.ui.cue(o.ui.goQuiz);
    } else if (!key) {
      o.ui.say(s.wait);
      o.ui.cue(s.waitCue?.() ?? null);
    } else {
      o.ui.say(wrong ? o.wrongText ?? '✗ ยังไม่ถูก สังเกตอีกครั้ง แล้วเลือกใหม่' : s.todo);
      o.ui.cue(cell());
    }
  }

  return { next, allDone: () => next() === null, refresh };
}
