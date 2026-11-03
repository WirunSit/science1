// Line chart drawn as SVG (Thai labels, theme colours, up to 4 overlaid runs).
import { s } from '../dom';
import { formatNumber } from '../format';

export interface Series {
  name: string;
  points: [number, number][];
  /** Markers only at these points (e.g. recorded rows); default: markers along the line. */
  marks?: [number, number][];
  /** Fixed colour/marker slot 0–3, so a run keeps its colour when other runs come and go. */
  slot?: number;
}

export interface ChartOptions {
  xLabel: string;
  yLabel: string;
  /** Minimum axis ranges so an empty/flat chart still has sensible axes. */
  xMin?: number;
  xMax?: number;
  yMin?: number;
  yMax?: number;
  /** Fixed x ticks, e.g. the table's recording times. */
  xTicks?: number[];
  yTicks?: number[];
}

export interface Palette {
  ink: string;
  ink2: string;
  rule: string;
  card: string;
  series: string[];
}

const SCREEN: Palette = {
  ink: 'var(--ink)',
  ink2: 'var(--ink-2)',
  rule: 'var(--rule)',
  card: 'var(--card)',
  series: ['var(--series-1)', 'var(--series-2)', 'var(--series-3)', 'var(--series-4)'],
};

/** Light palette with literal colours, for PNG export where CSS variables are not available. */
export const PRINT_PALETTE: Palette = {
  ink: '#1f2a2e',
  ink2: '#56646a',
  rule: '#d8d0bf',
  card: '#ffffff',
  series: ['#0e6b70', '#b4441c', '#6b4fa0', '#8a6d1f'],
};

export const MARKERS = ['circle', 'square', 'triangle', 'diamond'] as const;
export const MARKER_SYMBOLS = ['●', '■', '▲', '◆'];

export function niceTicks(min: number, max: number, count = 5): number[] {
  if (max <= min) max = min + 1;
  const raw = (max - min) / count;
  const mag = 10 ** Math.floor(Math.log10(raw));
  const step = [1, 2, 2.5, 5, 10].map((f) => f * mag).find((st) => st >= raw) ?? 10 * mag;
  const start = Math.floor(min / step) * step;
  const ticks: number[] = [];
  for (let v = start; v <= max + step * 1e-9; v += step) ticks.push(Math.round(v / step) * step);
  if (ticks[ticks.length - 1] < max) ticks.push(ticks[ticks.length - 1] + step);
  return ticks;
}

function marker(kind: (typeof MARKERS)[number], x: number, y: number, color: string, bg: string): SVGElement {
  const r = 4.5;
  const common = { fill: color, stroke: bg, 'stroke-width': 1.5 };
  switch (kind) {
    case 'square':
      return s('rect', { x: x - r, y: y - r, width: 2 * r, height: 2 * r, ...common });
    case 'triangle':
      return s('polygon', { points: `${x},${y - r - 1} ${x + r + 1},${y + r} ${x - r - 1},${y + r}`, ...common });
    case 'diamond':
      return s('polygon', { points: `${x},${y - r - 1.5} ${x + r + 1.5},${y} ${x},${y + r + 1.5} ${x - r - 1.5},${y}`, ...common });
    default:
      return s('circle', { cx: x, cy: y, r, ...common });
  }
}

export function renderChartSvg(series: Series[], o: ChartOptions, p: Palette = SCREEN, width = 640, height = 380): SVGSVGElement {
  // Phone-height charts get tighter margins and smaller text so the plot area stays usable.
  const compact = height < 240;
  const pad = compact ? { l: 44, r: 10, t: 24, b: 40 } : { l: 72, r: 16, t: 40, b: 64 };
  const all = series.flatMap((se) => se.points);
  const xs = all.map((pt) => pt[0]);
  const ys = all.map((pt) => pt[1]);
  const xT = o.xTicks ?? niceTicks(Math.min(o.xMin ?? Infinity, ...xs), Math.max(o.xMax ?? -Infinity, ...xs));
  const yT = o.yTicks ?? niceTicks(Math.min(o.yMin ?? Infinity, ...ys), Math.max(o.yMax ?? -Infinity, ...ys));
  const [x0, x1] = [xT[0], xT[xT.length - 1]];
  const [y0, y1] = [yT[0], yT[yT.length - 1]];
  const X = (v: number) => pad.l + ((v - x0) / (x1 - x0)) * (width - pad.l - pad.r);
  const Y = (v: number) => height - pad.b - ((v - y0) / (y1 - y0)) * (height - pad.t - pad.b);
  // Follow the page's text scale (×1.3 on projectors) so axis numbers stay readable from the back.
  const scale = typeof document === 'undefined' ? 1 : Number(getComputedStyle(document.documentElement).getPropertyValue('--scale')) || 1;
  const fs = Math.round((compact ? 12 : 14) * (p === SCREEN ? scale : 1));
  const font = { 'font-family': 'IBM Plex Sans Thai, Leelawadee UI, sans-serif', 'font-size': fs, fill: p.ink2 };

  const svg = s('svg', { viewBox: `0 0 ${width} ${height}`, width, height, role: 'img', class: 'chart-svg', xmlns: 'http://www.w3.org/2000/svg' });
  svg.append(s('title', {}, `กราฟ${o.yLabel}กับ${o.xLabel}`));
  svg.append(s('rect', { x: 0, y: 0, width, height, fill: p.card }));
  for (const v of yT) {
    svg.append(s('line', { x1: pad.l, x2: width - pad.r, y1: Y(v), y2: Y(v), stroke: p.rule, 'stroke-width': 1 }));
    svg.append(s('text', { x: pad.l - 8, y: Y(v) + 5, 'text-anchor': 'end', ...font }, formatNumber(v)));
  }
  for (const v of xT) {
    svg.append(s('line', { x1: X(v), x2: X(v), y1: height - pad.b, y2: height - pad.b + 6, stroke: p.ink2 }));
    svg.append(s('text', { x: X(v), y: height - pad.b + fs + 8, 'text-anchor': 'middle', ...font }, formatNumber(v)));
  }
  svg.append(s('line', { x1: pad.l, x2: width - pad.r, y1: height - pad.b, y2: height - pad.b, stroke: p.ink, 'stroke-width': 1.5 }));
  svg.append(s('line', { x1: pad.l, x2: pad.l, y1: pad.t, y2: height - pad.b, stroke: p.ink, 'stroke-width': 1.5 }));
  svg.append(s('text', { x: (pad.l + width - pad.r) / 2, y: height - (compact ? 4 : 8), 'text-anchor': 'middle', ...font, fill: p.ink, 'font-size': fs + 1 }, o.xLabel));
  // Y label sits horizontally above the axis: rotated Thai text with tone marks renders badly.
  svg.append(s('text', { x: 8, y: compact ? 15 : 18, ...font, fill: p.ink, 'font-size': fs + 1 }, `↑ ${o.yLabel}`));

  series.slice(0, 4).forEach((se, i) => {
    const slot = se.slot ?? i;
    const color = p.series[slot];
    if (se.points.length > 1) {
      svg.append(s('polyline', {
        points: se.points.map(([x, y]) => `${X(x)},${Y(y)}`).join(' '),
        fill: 'none', stroke: color, 'stroke-width': 2.5, 'stroke-linejoin': 'round',
      }));
    }
    if (se.marks) {
      se.marks.forEach(([x, y]) => svg.append(marker(MARKERS[slot], X(x), Y(y), color, p.card)));
      return;
    }
    // Markers thinned so dense runs stay readable.
    const every = Math.max(1, Math.ceil(se.points.length / 24));
    se.points.forEach(([x, y], j) => {
      if (j % every === 0 || j === se.points.length - 1) svg.append(marker(MARKERS[slot], X(x), Y(y), color, p.card));
    });
  });
  return svg;
}

export interface LineChart {
  el: HTMLElement;
  setSeries(series: Series[]): void;
  series(): Series[];
  /** Standalone SVG markup with literal colours (for PNG export). */
  printSvg(width?: number, height?: number): string;
}

export function createLineChart(o: ChartOptions): LineChart {
  let current: Series[] = [];
  const el = document.createElement('figure');
  el.className = 'chart';
  const legend = document.createElement('figcaption');
  legend.className = 'chart-legend';

  // Draw at the pane's real size so axis text stays ~14px and the chart fills its pane without scrolling.
  let width = 640;
  let height = 360;
  function render(): void {
    el.replaceChildren(renderChartSvg(current, o, undefined, width, height), legend);
    legend.replaceChildren(...current.slice(0, 4).map((se, i) => {
      const slot = se.slot ?? i;
      const item = document.createElement('span');
      item.className = 'legend-item';
      item.style.color = `var(--series-${slot + 1})`;
      item.textContent = `${MARKER_SYMBOLS[slot]} `;
      const label = document.createElement('span');
      label.textContent = se.name;
      item.append(label);
      return item;
    }));
  }
  render();
  if (typeof ResizeObserver !== 'undefined') {
    new ResizeObserver(([entry]) => {
      const { width: cw, height: ch } = entry.contentRect;
      if (cw === 0 || ch === 0) return; // hidden pane
      const w = Math.round(Math.max(240, cw));
      const hgt = Math.round(Math.max(120, ch - legend.offsetHeight - 4));
      if (Math.abs(w - width) > 6 || Math.abs(hgt - height) > 6) {
        width = w;
        height = hgt;
        render();
      }
    }).observe(el);
  }

  return {
    el,
    setSeries(series) {
      current = series;
      render();
    },
    series: () => current,
    printSvg(width = 900, height = 480) {
      return new XMLSerializer().serializeToString(renderChartSvg(current, o, PRINT_PALETTE, width, height));
    },
  };
}
