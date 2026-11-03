// Results table with every row and column laid out from the start (PLAN §4.2 step 1). Cells hold
// numbers (readings) or short text (observations such as "สั่นอยู่กับที่"):
// empty cells show "–" until the student records them. The cell to record next becomes a dropdown
// of readings; a right pick fills it (green), a wrong one turns it orange and asks again (D-029).
import { h } from '../dom';
import { formatNumber } from '../format';

export interface ResultColumn {
  key: string;
  label: string;
  /** Columns that share a group get one header cell above them, e.g. "อุณหภูมิ (°C)". */
  group?: string;
  decimals?: number;
}

export type CellValue = number | string;

export interface ResultTable {
  el: HTMLElement;
  set(row: number, key: string, value: CellValue): void;
  get(row: number, key: string): CellValue | undefined;
  /**
   * Turn one cell into a dropdown of `choices`. `onPick` says whether the pick is right;
   * a right pick is written into the cell, a wrong one keeps the dropdown open for another try.
   */
  ask(row: number, key: string, choices: CellValue[], label: string, onPick: (value: CellValue) => boolean): void;
  /** Remove the dropdown (if any) and show the cell's value again. */
  cancelAsk(): void;
  clearColumn(key: string): void;
  /** Every recorded value keyed "<row>:<column key>", for saving and restoring. */
  values(): Record<string, CellValue>;
  restore(values: Record<string, CellValue>): void;
  /** Plain text for the score card image; grouped headers are "group\ncolumn". */
  text(): { head: string[]; rows: string[][] };
}

/** Row labels are numbers (times) or text (e.g. "ของแข็ง"). */
export function createResultTable(o: { caption: string; rowHead: string; rows: (number | string)[]; columns: ResultColumn[] }): ResultTable {
  const values: Record<string, CellValue> = {};
  const label = (v: CellValue) => (typeof v === 'string' ? v : formatNumber(v));
  const cells = new Map<string, HTMLTableCellElement>();
  const id = (row: number, key: string) => `${row}:${key}`;
  let asking: { row: number; key: string } | null = null;

  // Two header rows when some columns are grouped; ungrouped headers span both.
  const grouped = o.columns.some((c) => c.group);
  const top = h('tr', {}, h('th', { scope: 'col', rowSpan: grouped ? 2 : 1 }, o.rowHead));
  const sub = h('tr');
  let lastGroup: string | undefined;
  for (const c of o.columns) {
    if (!c.group) {
      top.append(h('th', { scope: 'col', rowSpan: grouped ? 2 : 1 }, c.label));
    } else {
      if (c.group !== lastGroup) top.append(h('th', { scope: 'colgroup', colSpan: o.columns.filter((x) => x.group === c.group).length }, c.group));
      sub.append(h('th', { scope: 'col' }, c.label));
    }
    lastGroup = c.group;
  }
  const body = h('tbody', {}, ...o.rows.map((r, ri) =>
    h('tr', {}, h('th', { scope: 'row' }, label(r)), ...o.columns.map((c) => {
      const td = h('td', {}, '–');
      cells.set(id(ri, c.key), td);
      return td;
    }))));
  // Focusable because it may scroll on small screens (axe: scrollable-region-focusable).
  const el = h('div', { className: 'result-table-wrap', tabIndex: 0 },
    h('table', { className: 'result-table' },
      h('caption', {}, o.caption),
      h('thead', {}, top, grouped ? sub : null),
      body));

  const text = (row: number, key: string) => {
    const v = values[id(row, key)];
    const col = o.columns.find((c) => c.key === key)!;
    return v === undefined ? '–' : typeof v === 'string' ? v : formatNumber(v, { decimals: col.decimals ?? 0 });
  };
  const show = (row: number, key: string) => {
    const td = cells.get(id(row, key))!;
    td.classList.remove('asking', 'wrong');
    td.textContent = text(row, key);
  };
  const flash = (td: HTMLElement) => {
    td.classList.remove('just-filled');
    void td.offsetWidth; // restart the fill animation
    td.classList.add('just-filled');
  };

  const table: ResultTable = {
    el,
    set(row, key, value) {
      values[id(row, key)] = value;
      if (asking?.row === row && asking.key === key) asking = null;
      show(row, key);
      flash(cells.get(id(row, key))!);
    },
    get: (row, key) => values[id(row, key)],
    ask(row, key, choices, name, onPick) {
      table.cancelAsk();
      asking = { row, key };
      const td = cells.get(id(row, key))!;
      const select = h('select', {
        'aria-label': name,
        onchange: () => {
          const v = choices[Number(select.value)];
          if (onPick(v)) return; // the caller writes the value with set()
          td.classList.remove('wrong');
          void td.offsetWidth;
          td.classList.add('wrong');
          select.value = '';
        },
      },
      h('option', { value: '', disabled: true, selected: true }, 'เลือก ▾'),
      ...choices.map((v, i) => h('option', { value: String(i) }, label(v))));
      td.classList.add('asking');
      td.replaceChildren(select);
    },
    cancelAsk() {
      if (!asking) return;
      const { row, key } = asking;
      asking = null;
      show(row, key);
    },
    clearColumn(key) {
      o.rows.forEach((_, ri) => {
        delete values[id(ri, key)];
        show(ri, key);
      });
      if (asking?.key === key) asking = null;
    },
    values: () => ({ ...values }),
    restore(saved) {
      Object.assign(values, saved);
      o.rows.forEach((_, ri) => o.columns.forEach((c) => show(ri, c.key)));
    },
    text: () => ({
      head: [o.rowHead, ...o.columns.map((c) => (c.group ? `${c.group}\n${c.label}` : c.label))],
      rows: o.rows.map((r, ri) => [label(r), ...o.columns.map((c) => text(ri, c.key))]),
    }),
  };
  return table;
}
