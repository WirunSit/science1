// "ดูวิธีคิด" — shows the substitution into the equation line by line (PLAN §4.6).
import { h } from '../dom';
import { t } from '../i18n';

export interface WorkSteps {
  el: HTMLElement;
  set(lines: string[]): void;
}

export function createWorkSteps(title = t('work.show')): WorkSteps {
  const list = h('ol', { className: 'work-lines' });
  const el = h('details', { className: 'work-steps' }, h('summary', {}, title), list);
  return {
    el,
    set(lines) {
      list.replaceChildren(...lines.map((l) => h('li', {}, l)));
    },
  };
}
