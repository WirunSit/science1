// Steps 2 and 3 of every experiment (PLAN §4.2): questions one at a time, then the score, the
// name fields, "ส่งคะแนนให้ครู" (score card image), and the answer key. Each lab supplies its own
// table(s), evidence wording, and model note.
import { h } from '../dom';
import { t } from '../i18n';
import { readStudent, saveStudent, type Student } from '../student';
import type { LabSteps } from './LabSteps';
import { createQuizRunner, createReview, scoreOf, type Answers, type QuizItem } from './QuizRunner';
import { renderScoreCard, safeName, shareImage } from './Export';

export interface QuizScoreState {
  answers: Answers;
  submitted: boolean;
  attempt: number;
}

export interface QuizAndScoreOptions {
  steps: LabSteps;
  lab: string;
  title: string;
  items: QuizItem[];
  state: QuizScoreState;
  save(): void;
  /** Shown beside the questions (the student's table); the lab moves it there on step 2. */
  aside: HTMLElement;
  /** Tables for the score card image. */
  tables(): { head: string[]; rows: string[][] }[];
  /** "ดูตารางของฉัน: …" for the answer key, from the item's evidence. */
  where(q: QuizItem): string | null;
  modelNote: string;
  figure?(kind: 'graph'): HTMLElement;
  /** Start again (after the student confirms): clear this experiment's state and reload. */
  restart(nextAttempt: number): void;
}

export function setupQuizAndScore(o: QuizAndScoreOptions): void {
  const [, pane2, pane3] = o.steps.panes;
  const runner = createQuizRunner(o.items, o.state.answers, {
    onChange: (a) => { o.state.answers = a; o.save(); },
    onSubmit: (a) => {
      o.state.answers = a;
      o.state.submitted = true;
      o.save();
      runner.lock();
      showScore();
      o.steps.unlock(2);
      o.steps.go(2);
    },
    figure: o.figure,
    showKey: o.steps.teacher,
  });
  pane2.append(o.aside, runner.el);

  let student: Student = readStudent();
  const scoreBig = h('p', { className: 'score-big' });
  const scoreMsg = h('p', { className: 'score-msg' });
  const field = (label: string, key: keyof Student, cls = '') =>
    h('label', { className: `field ${cls}` }, label,
      h('input', {
        type: 'text', value: student[key], autocomplete: 'off',
        oninput: (e: Event) => {
          student = { ...student, [key]: (e.target as HTMLInputElement).value };
          saveStudent(student);
          updateSend();
        },
      }));
  const sendBtn = h('button', { type: 'button', className: 'btn main', onclick: () => send() }, `📤 ${t('score.send')}`);
  const sendHint = h('p', { className: 'hint' });
  const reviewList = h('div', { className: 'review-slot', tabIndex: 0 });
  pane3.append(
    h('div', { className: 'score-box' }, h('p', { className: 'score-label' }, t('score.title')), scoreBig, scoreMsg),
    h('div', { className: 'send-box' },
      field(t('student.name'), 'name', 'name'), field(t('student.class'), 'className'), field(t('student.number'), 'number'),
      sendBtn, sendHint),
    h('section', { className: 'review-box', 'aria-labelledby': 'review-h' },
      h('h2', { id: 'review-h' }, t('score.review')),
      reviewList,
      h('div', { className: 'review-foot' },
        h('button', {
          type: 'button',
          className: 'link-btn',
          onclick: () => { if (confirm(t('score.retryConfirm'))) o.restart(o.state.attempt + 1); },
        }, `↺ ${t('score.retry')}`))),
  );

  function showScore(): void {
    const score = scoreOf(o.items, o.state.answers);
    const total = o.items.length;
    scoreBig.textContent = `${score} / ${total}`;
    scoreMsg.textContent = score === total ? 'เยี่ยมมาก ถูกทุกข้อ' : score >= total * 0.6 ? 'ดีมาก ดูเฉลยข้อที่ยังไม่ถูก' : 'ดูเฉลยแล้วเทียบกับตารางของตัวเองอีกครั้ง';
    reviewList.replaceChildren(createReview(o.items, o.state.answers, o.where), h('p', { className: 'hint review-note' }, `หมายเหตุ: ${o.modelNote}`));
    updateSend();
  }

  function updateSend(): void {
    const ready = student.name.trim() !== '' && student.number.trim() !== '';
    sendBtn.disabled = !ready;
    sendHint.textContent = ready ? t('score.sendHint') : t('student.missing');
  }

  async function send(): Promise<void> {
    const blob = await renderScoreCard({
      lab: o.lab, title: o.title, student,
      score: scoreOf(o.items, o.state.answers), total: o.items.length,
      marks: o.items.map((q, i) => o.state.answers[i] === q.answer),
      tables: o.tables(), attempt: o.state.attempt, when: new Date(),
    });
    await shareImage(blob, `${safeName(`${o.title}-${student.className}-${student.number}`)}.png`, o.title);
  }

  if (o.state.submitted) {
    runner.lock();
    showScore();
    o.steps.unlock(2);
  }
}
