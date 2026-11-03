// Liquid thermometer drawn like real lab glassware, with a large number readout.
// The colour scale never carries meaning alone: the value is always printed.
import { h, s } from '../dom';
import { formatNumber } from '../format';
import { niceTicks } from './Chart';
import { celsiusToFahrenheit, celsiusToKelvin } from '../physics/heat';

const STOPS = ['#2c5f8a', '#9cc3d5', '#f1e6c8', '#e59a55', '#a63a16'];

function mix(a: string, b: string, f: number): string {
  const pa = [1, 3, 5].map((i) => parseInt(a.slice(i, i + 2), 16));
  const pb = [1, 3, 5].map((i) => parseInt(b.slice(i, i + 2), 16));
  return `#${pa.map((v, i) => Math.round(v + (pb[i] - v) * f).toString(16).padStart(2, '0')).join('')}`;
}

/** Colour for temperature `t` on a scale from `min` (cool) to `max` (hot). */
export function tempColor(t: number, min: number, max: number): string {
  const f = Math.min(1, Math.max(0, (t - min) / (max - min))) * (STOPS.length - 1);
  const i = Math.min(STOPS.length - 2, Math.floor(f));
  return mix(STOPS[i], STOPS[i + 1], f - i);
}

export type TempUnit = 'C' | 'K' | 'F';

export function formatTemp(tC: number, unit: TempUnit = 'C', decimals = 1): string {
  if (unit === 'K') return `${formatNumber(celsiusToKelvin(tC), { decimals })} K`;
  if (unit === 'F') return `${formatNumber(celsiusToFahrenheit(tC), { decimals })} °F`;
  return `${formatNumber(tC, { decimals })} °C`;
}

export interface Thermometer {
  el: HTMLElement;
  set(tC: number): void;
}

export function createThermometer(o: { min: number; max: number; label?: string; units?: TempUnit[] }): Thermometer {
  const units = o.units ?? ['C'];
  let unit: TempUnit = 'C';
  let value = o.min;
  const H = 220;
  const top = 12;
  const bulbY = H - 26;
  const tubeBottom = bulbY - 14;
  const yFor = (t: number) => tubeBottom - ((t - o.min) / (o.max - o.min)) * (tubeBottom - top);

  const column = s('rect', { x: 25, width: 10, rx: 5 });
  const bulb = s('circle', { cx: 30, cy: bulbY, r: 15 });
  const ticks = s('g', { 'font-size': 11, fill: 'var(--ink-2)', 'font-family': 'IBM Plex Sans Thai, sans-serif' });
  for (const v of niceTicks(o.min, o.max).filter((v) => v >= o.min && v <= o.max)) {
    ticks.append(s('line', { x1: 40, x2: 47, y1: yFor(v), y2: yFor(v), stroke: 'var(--ink-2)' }));
    ticks.append(s('text', { x: 50, y: yFor(v) + 4 }, formatNumber(v)));
  }
  const svg = s('svg', { viewBox: `0 0 84 ${H}`, class: 'thermo-svg', 'aria-hidden': 'true' },
    s('rect', { x: 21, y: top - 6, width: 18, height: tubeBottom - top + 16, rx: 9, fill: 'var(--card)', stroke: 'var(--ink)', 'stroke-width': 1.5 }),
    s('circle', { cx: 30, cy: bulbY, r: 19, fill: 'var(--card)', stroke: 'var(--ink)', 'stroke-width': 1.5 }),
    column, bulb, ticks,
  );
  const readout = h('div', { className: 'thermo-value' });
  const unitBtns = units.length > 1
    ? h('div', { className: 'segmented small', role: 'group', 'aria-label': 'หน่วยอุณหภูมิ' },
      ...units.map((u) => h('button', {
        type: 'button', className: 'seg', 'aria-pressed': String(u === unit),
        onclick: (e: Event) => {
          unit = u;
          (e.currentTarget as HTMLElement).parentElement!.querySelectorAll('button').forEach((b, i) => b.setAttribute('aria-pressed', String(units[i] === u)));
          render();
        },
      }, u === 'C' ? '°C' : u === 'K' ? 'K' : '°F')))
    : null;
  const el = h('div', { className: 'thermometer' }, svg, h('div', {}, o.label ? h('div', { className: 'thermo-label' }, o.label) : null, readout, unitBtns));

  function render(): void {
    const clamped = Math.min(o.max, Math.max(o.min, value));
    const color = tempColor(value, o.min, o.max);
    column.setAttribute('y', String(yFor(clamped)));
    column.setAttribute('height', String(Math.max(0, bulbY - yFor(clamped))));
    column.setAttribute('fill', color);
    bulb.setAttribute('fill', color);
    readout.textContent = formatTemp(value, unit);
  }
  render();
  return {
    el,
    set(tC) {
      value = tC;
      render();
    },
  };
}
