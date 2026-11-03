// Page frame for every experiment (PLAN §4.2–4.3): title, a 3-step bar, and one step on screen at a time.
// The page itself never scrolls; long content scrolls inside its own box.
// Teacher mode (?teacher=1, PLAN §4.3) adds a "เครื่องมือครู" dialog and projector-size text; students never see it.
import { h, safeStore } from '../dom';
import { t, type TextKey } from '../i18n';

const STEP_KEYS: TextKey[] = ['steps.experiment', 'steps.quiz', 'steps.score'];

export interface LabSteps {
  /** Content box of each step (experiment, quiz, score). */
  panes: HTMLElement[];
  readonly current: number;
  /** True when opened with ?teacher=1. */
  readonly teacher: boolean;
  /** Where a lab puts its own teacher tools (inside the dialog); null for students. */
  teacherTools: HTMLElement | null;
  go(step: number): void;
  /** Steps up to and including `step` can be opened from the step bar. */
  unlock(step: number): void;
  onChange(cb: (step: number) => void): void;
}

export interface LabStepsOptions {
  lab: string;
  title: string;
  /** Link back to the app's list of experiments (the lab name in the header becomes that link). */
  home?: string;
  /** localStorage keys this experiment owns, cleared by the teacher's "ล้างข้อมูล". */
  storeKeys?: string[];
}

export function isTeacher(): boolean {
  return new URLSearchParams(location.search).get('teacher') === '1';
}

export function mountLabSteps(root: HTMLElement, o: LabStepsOptions): LabSteps {
  let current = 0;
  let unlocked = 0;
  const teacher = isTeacher();
  const listeners = new Set<(step: number) => void>();
  const panes = STEP_KEYS.map((k, i) => h('section', { className: `step-pane step-${i + 1}`, 'aria-label': `ขั้นที่ ${i + 1} ${t(k)}`, hidden: true }));
  const buttons = STEP_KEYS.map((k, i) =>
    h('button', { type: 'button', className: 'step-btn', onclick: () => go(i) },
      h('span', { className: 'step-no', 'aria-hidden': 'true' }), h('span', { className: 'step-label' }, t(k))));

  let teacherTools: HTMLElement | null = null;
  let dialog: HTMLDialogElement | null = null;
  if (teacher) {
    document.documentElement.classList.add('projector');
    teacherTools = h('div', { className: 'teacher-tools' });
    dialog = h('dialog', { className: 'sheet', 'aria-labelledby': 'teacher-h' },
      h('h2', { id: 'teacher-h' }, 'เครื่องมือครู'),
      teacherTools,
      h('button', {
        type: 'button',
        className: 'btn ghost',
        onclick: () => {
          if (!confirm('ล้างผลการทดลอง คำตอบ และคะแนนของการทดลองนี้ในเครื่องนี้?')) return;
          for (const k of o.storeKeys ?? []) safeStore.set(k, '{}');
          location.reload();
        },
      }, '🗑 ล้างข้อมูลการทดลองนี้ในเครื่อง'),
      h('form', { method: 'dialog' }, h('button', { className: 'btn' }, 'ปิด')));
  }

  const kicker = o.home ? h('a', { className: 'lab-kicker', href: o.home }, `‹ ${o.lab}`) : h('p', { className: 'lab-kicker' }, o.lab);
  root.replaceChildren(
    h('header', { className: 'lab-header' },
      kicker,
      h('h1', { className: 'lab-title' }, o.title),
      teacher ? h('button', { type: 'button', className: 'badge teacher', onclick: () => dialog!.showModal() }, '🧑‍🏫 เครื่องมือครู') : null,
      h('nav', { 'aria-label': 'ขั้นตอน' }, h('ol', { className: 'steps' }, ...buttons.map((b) => h('li', {}, b))))),
    h('main', { className: 'lab-stage' }, ...panes),
  );
  if (dialog) root.append(dialog);
  root.classList.add('lab-app');
  document.title = `${o.title} · ${o.lab}`;

  function render(): void {
    buttons.forEach((b, i) => {
      // ✓ only for steps the student finished; teachers can open every step without marking it done.
      const done = i < unlocked;
      b.disabled = i > (teacher ? panes.length - 1 : unlocked);
      b.classList.toggle('done', done);
      b.setAttribute('aria-current', i === current ? 'step' : 'false');
      b.firstElementChild!.textContent = done ? '✓' : String(i + 1);
    });
    panes.forEach((p, i) => (p.hidden = i !== current));
  }

  function go(step: number): void {
    // Teachers may open any step (to show the questions or the answer key on the projector).
    const next = Math.max(0, Math.min(teacher ? panes.length - 1 : unlocked, step));
    const changed = next !== current;
    current = next;
    render();
    if (changed) listeners.forEach((cb) => cb(current));
  }

  render();
  return {
    panes,
    get current() { return current; },
    teacher,
    teacherTools,
    go,
    unlock(step) {
      unlocked = Math.max(unlocked, Math.min(panes.length - 1, step));
      render();
    },
    onChange: (cb) => listeners.add(cb),
  };
}
