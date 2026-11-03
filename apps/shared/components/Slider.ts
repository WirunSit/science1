import { h, uid } from '../dom';
import { formatNumber } from '../format';
import { t } from '../i18n';

export interface SliderOptions {
  label: string;
  min: number;
  max: number;
  step: number;
  value: number;
  unit?: string;
  /** Custom display of the current value (e.g. mass in kg and g). */
  format?: (v: number) => string;
  onInput?: (v: number) => void;
}

export interface Slider {
  el: HTMLElement;
  get(): number;
  set(v: number): void;
  /** Lock (e.g. controlled variable in mission mode). */
  lock(locked: boolean): void;
}

export function createSlider(o: SliderOptions): Slider {
  const id = uid('slider');
  const fmt = o.format ?? ((v: number) => `${formatNumber(v, { sig: 4 })}${o.unit ? ` ${o.unit}` : ''}`);
  const output = h('output', { htmlFor: id, className: 'slider-value' }, fmt(o.value));
  const lockTag = h('span', { className: 'lock-tag', hidden: true }, `🔒 ${t('control.locked')}`);
  const input = h('input', {
    id,
    type: 'range',
    min: o.min,
    max: o.max,
    step: o.step,
    value: o.value,
    oninput: () => {
      output.textContent = fmt(Number(input.value));
      input.setAttribute('aria-valuetext', output.textContent);
      o.onInput?.(Number(input.value));
    },
  });
  input.setAttribute('aria-valuetext', fmt(o.value));
  const el = h('div', { className: 'slider' },
    h('div', { className: 'slider-head' }, h('label', { htmlFor: id }, o.label), lockTag, output),
    input,
    h('div', { className: 'slider-range', 'aria-hidden': 'true' }, h('span', {}, fmt(o.min)), h('span', {}, fmt(o.max))),
  );
  return {
    el,
    get: () => Number(input.value),
    set(v) {
      input.value = String(v);
      output.textContent = fmt(Number(input.value));
    },
    lock(locked) {
      input.disabled = locked;
      lockTag.hidden = !locked;
      el.classList.toggle('locked', locked);
    },
  };
}

export interface SelectOption<T extends string> {
  value: T;
  label: string;
}

export function createSelect<T extends string>(label: string, options: SelectOption<T>[], value: T, onChange: (v: T) => void) {
  const id = uid('select');
  const select = h('select', { id, onchange: () => onChange(select.value as T) },
    ...options.map((op) => h('option', { value: op.value, selected: op.value === value }, op.label)),
  );
  const lockTag = h('span', { className: 'lock-tag', hidden: true }, `🔒 ${t('control.locked')}`);
  const el = h('div', { className: 'slider' }, h('div', { className: 'slider-head' }, h('label', { htmlFor: id }, label), lockTag), select);
  return {
    el,
    get: () => select.value as T,
    set(v: T) {
      select.value = v;
    },
    lock(locked: boolean) {
      select.disabled = locked;
      lockTag.hidden = !locked;
    },
  };
}
