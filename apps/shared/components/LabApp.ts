// An app with several experiments (PLAN §4.1): one link per experiment (#<id>); without a hash, the
// list of experiments as big buttons. Changing the hash reloads, so nothing is left running behind.
import { h } from '../dom';
import { isTeacher } from './LabSteps';

export interface Experiment {
  id: string;
  title: string;
  lesson: string;
  mount(root: HTMLElement, lab: string, home: string): void;
}

export function mountLabApp(o: { lab: string; kicker: string; experiments: Experiment[] }): void {
  const root = document.getElementById('app')!;
  const exp = o.experiments.find((e) => `#${e.id}` === location.hash);
  window.addEventListener('hashchange', () => location.reload());
  if (exp) {
    exp.mount(root, o.lab, `${location.pathname}${location.search}`);
    return;
  }
  document.title = o.lab;
  root.classList.add('lab-home');
  root.replaceChildren(
    h('header', { className: 'lab-header' },
      h('p', { className: 'lab-kicker' }, o.kicker),
      h('h1', { className: 'lab-title' }, o.lab),
      isTeacher() ? h('p', { className: 'badge teacher' }, '🧑‍🏫 โหมดครู') : null),
    h('main', { className: 'home-list' },
      h('p', { className: 'hint' }, 'เลือกการทดลองที่ครูบอก หรือสแกน QR ในใบกิจกรรม'),
      ...o.experiments.map((e, i) => h('a', { className: 'home-card', href: `#${e.id}` },
        h('span', { className: 'home-no' }, String(i + 1)),
        h('span', {}, h('strong', {}, e.title), h('span', { className: 'hint' }, `เรื่องที่ ${e.lesson.slice(-1)} · 3 ขั้น: ทดลอง → ตอบคำถาม → ส่งคะแนน`))))),
  );
}
