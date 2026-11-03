// Assessment questions one at a time (PLAN §4.2 step 2): no right/wrong shown until the student
// sends all answers. The review (step 3) shows the key, the reasoning, and the table cells to check.
import { h, uid } from '../dom';
import { t } from '../i18n';

/** One table row a question relies on: the run's settings, the time, and the values that must appear. */
export interface RunEvidence {
  preset: Record<string, number | string>;
  time: number;
  expect: Record<string, number>;
  hint?: string;
}

/** One observation cell a question relies on, e.g. { table: 'states', row: 'solid', col: 'motion' }. */
export interface CellEvidence {
  cell: { table: string; row: string; col: string };
  expect: string;
  hint?: string;
}

export type Evidence = RunEvidence | CellEvidence;

export interface QuizItem {
  id: string;
  lesson: string;
  station?: string;
  indicator: string;
  level: string;
  stem: string;
  choices: string[];
  answer: number;
  explanation: string;
  /** Why a particular wrong choice is tempting, keyed by choice index. */
  misconception?: Record<string, string>;
  evidence?: Evidence | Evidence[];
  /** Show the student's own graph inside the card (graph-reading items). */
  figure?: 'graph';
}

export type Answers = (number | null)[];

export function evidenceList(q: QuizItem): Evidence[] {
  return q.evidence ? (Array.isArray(q.evidence) ? q.evidence : [q.evidence]) : [];
}

export function scoreOf(items: QuizItem[], answers: Answers): number {
  return items.filter((q, i) => answers[i] === q.answer).length;
}

export const LETTERS = ['ก', 'ข', 'ค', 'ง'];

export interface QuizRunner {
  el: HTMLElement;
  /** After sending: answers can be seen but not changed. */
  lock(): void;
}

export function createQuizRunner(
  items: QuizItem[],
  answers: Answers,
  o: {
    onChange(a: Answers): void;
    onSubmit(a: Answers): void;
    figure?(kind: 'graph'): HTMLElement;
    /** Teacher mode: mark the keyed choice so the class can discuss it on the projector. */
    showKey?: boolean;
  },
): QuizRunner {
  let locked = false;
  let index = Math.max(0, answers.findIndex((a) => a === null));
  if (answers.every((a) => a !== null)) index = items.length - 1;

  const progress = h('p', { className: 'quiz-progress' });
  const dots = h('div', { className: 'quiz-dots', 'aria-hidden': 'true' }, ...items.map(() => h('span')));
  const card = h('div', { className: 'quiz-card', tabIndex: 0 });
  const back = h('button', { type: 'button', className: 'btn ghost', onclick: () => show(index - 1) }, `‹ ${t('quiz.back')}`);
  const next = h('button', {
    type: 'button',
    className: 'btn',
    onclick: () => {
      if (index < items.length - 1) return show(index + 1);
      if (!confirm(t('quiz.confirm'))) return;
      o.onSubmit(answers);
    },
  });
  const note = h('p', { className: 'hint quiz-note', 'aria-live': 'polite' });
  const el = h('div', { className: 'quiz-runner' },
    h('div', { className: 'quiz-head' }, progress, dots), card, note, h('div', { className: 'quiz-nav' }, back, next));

  function show(i: number): void {
    index = Math.max(0, Math.min(items.length - 1, i));
    const q = items[index];
    const name = uid('q');
    const stemId = uid('stem');
    progress.textContent = `ข้อ ${index + 1} จาก ${items.length}`;
    card.replaceChildren(h('p', { className: 'quiz-stem', id: stemId }, q.stem));
    if (q.figure && o.figure) card.append(h('div', { className: 'quiz-figure' }, o.figure(q.figure)));
    card.append(
      h('div', { className: 'quiz-choices', role: 'radiogroup', 'aria-labelledby': stemId },
        ...q.choices.map((c, ci) => h('label', { className: `quiz-choice${o.showKey && ci === q.answer ? ' is-answer' : ''}` },
          h('input', {
            type: 'radio', name, value: ci, checked: answers[index] === ci, disabled: locked,
            onchange: () => { answers[index] = ci; o.onChange(answers); render(); },
          }),
          h('span', { className: 'quiz-letter' }, LETTERS[ci]),
          h('span', {}, c),
          o.showKey && ci === q.answer ? h('span', { className: 'key-tag' }, '✓ เฉลย') : null))),
    );
    card.scrollTop = 0;
    render();
  }

  function render(): void {
    const last = index === items.length - 1;
    dots.querySelectorAll('span').forEach((d, i) => {
      d.className = i === index ? 'current' : answers[i] !== null ? 'answered' : '';
    });
    back.disabled = index === 0;
    next.textContent = last ? `${t('quiz.submit')} ✓` : `${t('quiz.next')} ›`;
    next.classList.toggle('warn', last);
    next.disabled = answers[index] === null || (last && locked);
    next.hidden = last && locked;
    note.textContent = locked ? t('quiz.sent') : answers[index] === null ? t('quiz.pick') : '';
  }

  show(index);
  return {
    el,
    lock() {
      locked = true;
      show(index);
    },
  };
}

/** Step 3 answer key: each item with the student's choice, the right one, why, and where to check. */
export function createReview(items: QuizItem[], answers: Answers, where: (q: QuizItem) => string | null): HTMLElement {
  return h('ol', { className: 'review' }, ...items.map((q, i) => {
    const picked = answers[i];
    const ok = picked === q.answer;
    const why = !ok && picked !== null ? q.misconception?.[String(picked)] : undefined;
    const check = where(q);
    return h('li', { className: `review-item ${ok ? 'ok' : 'no'}` },
      h('p', { className: 'review-mark' }, `ข้อ ${i + 1} ${ok ? `✓ ${t('quiz.correct')}` : `✗ ${t('quiz.wrong')}`}`),
      h('p', { className: 'quiz-stem' }, q.stem),
      ok ? null : h('p', {}, `คำตอบของฉัน: ${picked === null ? '–' : `${LETTERS[picked]}. ${q.choices[picked]}`}`),
      h('p', {}, h('strong', {}, `คำตอบที่ถูก: ${LETTERS[q.answer]}. ${q.choices[q.answer]}`)),
      why ? h('p', {}, `ระวัง: ${why}`) : null,
      h('p', {}, q.explanation),
      check ? h('p', { className: 'review-check' }, `🔎 ${check}`) : null,
    );
  }));
}
