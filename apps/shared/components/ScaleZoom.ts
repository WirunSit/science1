// Magnified part of a liquid-in-glass thermometer (PLAN §4.2 step 1): ticks every 1 °C, numbers every
// 5 °C, no digital readout — students read the top of the column against the scale, as in the lab.
import { h, s } from '../dom';

export interface ScaleZoom {
  el: HTMLElement;
  set(tC: number): void;
}

const SPAN = 16; // °C visible in the window
const W = 64;
const H = 200;
const PX = H / SPAN;

export function createScaleZoom(o: { min: number; max: number; label: string }): ScaleZoom {
  // Red like the liquid in a school thermometer, so the column top stands out against the ticks.
  const column = s('rect', { x: 8, width: 12, rx: 2, fill: 'var(--temp-4)' });
  const ticks = s('g', { 'font-family': 'IBM Plex Sans Thai, sans-serif', 'font-size': 14, 'font-weight': 600, fill: 'var(--ink)' });
  const svg = s('svg', { viewBox: `0 0 ${W} ${H}`, class: 'zoom-svg', 'aria-hidden': 'true' },
    s('rect', { x: 4, y: 0, width: 20, height: H, fill: 'var(--card)', stroke: 'var(--ink-2)' }),
    column, ticks);
  const el = h('figure', { className: 'scale-zoom' }, h('figcaption', {}, `🔍 ${o.label}`), svg);

  return {
    el,
    set(tC) {
      // The window follows the column top so it always sits in the middle third.
      const low = Math.max(o.min, Math.min(o.max - SPAN, tC - SPAN / 2));
      const y = (v: number) => H - (v - low) * PX;
      column.setAttribute('y', String(y(tC)));
      column.setAttribute('height', String(Math.max(0, H - y(tC))));
      ticks.replaceChildren();
      for (let v = Math.ceil(low); v <= low + SPAN; v++) {
        const major = v % 5 === 0;
        ticks.append(s('line', { x1: 24, x2: major ? 40 : 32, y1: y(v), y2: y(v), stroke: 'var(--ink)', 'stroke-width': major ? 1.6 : 1 }));
        if (major) ticks.append(s('text', { x: 42, y: y(v) + 5 }, String(v)));
      }
    },
  };
}
