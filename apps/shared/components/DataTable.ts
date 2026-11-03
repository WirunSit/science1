import { h } from '../dom';
import { formatNumber, type FormatOptions } from '../format';
import { t } from '../i18n';

export interface Column {
  key: string;
  label: string;
  unit?: string;
  format?: FormatOptions;
}

/** A row may carry extra keys (e.g. the run's settings) that are not displayed but used as evidence. */
export type Row = Record<string, number | string>;

export interface DataTable {
  el: HTMLElement;
  add(row: Row): void;
  clear(): void;
  rows(): Row[];
  /** Replace all rows (restoring saved results). */
  restore(rows: Row[]): void;
  /** Highlight the rows matching `match` and scroll the first into view. Returns how many matched. */
  highlight(match: (row: Row) => boolean): number;
  columns: Column[];
  toCSV(): string;
}

export function headerText(c: Column): string {
  return c.unit ? `${c.label} (${c.unit})` : c.label;
}

export function cellText(c: Column, v: number | string | undefined): string {
  if (v === undefined) return '';
  return typeof v === 'number' ? formatNumber(v, c.format) : v;
}

export function createDataTable(columns: Column[], opts: { caption?: string; onChange?: () => void } = {}): DataTable {
  const data: Row[] = [];
  const tbody = h('tbody');
  const empty = h('p', { className: 'table-empty' }, t('table.empty'));
  const table = h('table', { className: 'data-table' },
    opts.caption ? h('caption', {}, opts.caption) : null,
    h('thead', {}, h('tr', {}, ...columns.map((c) => h('th', { scope: 'col' }, headerText(c))))),
    tbody,
  );
  const el = h('div', { className: 'table-wrap' }, table, empty);

  function render(): void {
    tbody.replaceChildren(...data.map((row) => h('tr', {}, ...columns.map((c) => h('td', {}, cellText(c, row[c.key]))))));
    empty.hidden = data.length > 0;
    opts.onChange?.();
  }
  render();

  return {
    el,
    columns,
    add(row) {
      data.push(row);
      render();
      el.scrollTop = el.scrollHeight;
    },
    clear() {
      data.length = 0;
      render();
    },
    restore(rows) {
      data.splice(0, data.length, ...rows);
      render();
    },
    rows: () => data.slice(),
    highlight(match) {
      const trs = Array.from(tbody.rows);
      const hits = trs.filter((tr, i) => {
        const hit = match(data[i]);
        tr.classList.toggle('evidence', hit);
        return hit;
      });
      hits[0]?.scrollIntoView({ block: 'center' });
      return hits.length;
    },
    toCSV() {
      const esc = (s: string) => (/[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s);
      const lines = [columns.map((c) => esc(headerText(c))).join(',')];
      // Raw numbers (not display-formatted) so Google Sheets can graph them.
      for (const row of data) lines.push(columns.map((c) => esc(String(row[c.key] ?? ''))).join(','));
      return lines.join('\r\n');
    },
  };
}
