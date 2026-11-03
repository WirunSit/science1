// Teacher tool in Forecast Room (PLAN §10.6 scene B): the class weather log (U6C1-LOG) as a CSV, read in
// the browser only (nothing is uploaded). Draws pressure and humidity over the days and gives one simple
// signal for the next day, clearly labelled as a learning rule, not a real forecast.
import { createLineChart, formatNumber, h } from '@shared/index';
import sample from '@content/worksheets/U6C1-LOG-sample.csv?raw';

export interface LogRow { date: string; time: string; temp: number; rh: number; pressure: number; wind: string; cloud: number; rain: number }

/** Columns in order, as in the paper log and the CSV template (the header row is skipped). */
export const LOG_COLUMNS = ['วันที่', 'เวลา', 'อุณหภูมิ (°C)', 'ความชื้นสัมพัทธ์ (%)', 'ความกดอากาศ (hPa)', 'ทิศที่ลมพัดมา', 'เมฆ (ส่วนใน 10)', 'ฝน (mm)'];
/** Learning rule (PLAN §10.6): pressure fell more than this in a day and the air is this humid → rain more likely. */
export const RULE = { pressureDrop: 2, humid: 80 };

export function parseLog(text: string): { rows: LogRow[]; errors: string[] } {
  const lines = text.replace(/^﻿/, '').split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  const rows: LogRow[] = [];
  const errors: string[] = [];
  if (!lines.length) return { rows, errors: ['ไฟล์ว่าง ไม่มีข้อมูล'] };
  const body = /\d/.test(lines[0].split(',')[2] ?? '') ? lines : lines.slice(1);
  body.forEach((line, i) => {
    const c = line.split(',').map((x) => x.trim());
    const n = i + (body === lines ? 1 : 2);
    if (c.length < LOG_COLUMNS.length) return errors.push(`แถวที่ ${n}: มี ${c.length} ช่อง ต้องมี ${LOG_COLUMNS.length} ช่อง (${LOG_COLUMNS.join(', ')})`);
    const num = (k: number, name: string, lo: number, hi: number) => {
      const v = Number(c[k]);
      if (c[k] === '' || !Number.isFinite(v)) { errors.push(`แถวที่ ${n}: ช่อง "${name}" ต้องเป็นตัวเลข (พบ "${c[k]}")`); return NaN; }
      if (v < lo || v > hi) errors.push(`แถวที่ ${n}: ช่อง "${name}" = ${v} ดูผิดปกติ (ควรอยู่ระหว่าง ${lo}–${hi})`);
      return v;
    };
    const row = { date: c[0], time: c[1], temp: num(2, LOG_COLUMNS[2], -5, 50), rh: num(3, LOG_COLUMNS[3], 0, 100), pressure: num(4, LOG_COLUMNS[4], 950, 1050), wind: c[5], cloud: num(6, LOG_COLUMNS[6], 0, 10), rain: num(7, LOG_COLUMNS[7], 0, 500) };
    if (![row.temp, row.rh, row.pressure, row.cloud, row.rain].some(Number.isNaN)) rows.push(row);
  });
  return { rows, errors };
}

/** The learning rule on the last two days: compares the last reading with the last one of the day before. */
export function rainSignal(rows: LogRow[]): string {
  if (rows.length < 2) return 'ข้อมูลยังน้อยเกินไป ต้องมีอย่างน้อย 2 วัน';
  const last = rows[rows.length - 1];
  const before = [...rows].reverse().find((r) => r.date !== last.date);
  if (!before) return 'ข้อมูลยังน้อยเกินไป ต้องมีอย่างน้อย 2 วัน';
  const drop = before.pressure - last.pressure;
  const text = `ความกดอากาศ ${drop >= 0 ? 'ลดลง' : 'เพิ่มขึ้น'} ${formatNumber(Math.abs(drop), { decimals: 1 })} hPa จาก ${before.date} · ความชื้นสัมพัทธ์ล่าสุด ${formatNumber(last.rh)}%`;
  const likely = drop > RULE.pressureDrop && last.rh > RULE.humid;
  return `${text} → ${likely ? 'โอกาสฝนตกเพิ่มขึ้น' : 'ยังไม่มีสัญญาณฝนชัดเจน'} (กฎอย่างง่ายเพื่อการเรียนรู้: ความกดอากาศลดลงเกิน ${RULE.pressureDrop} hPa และความชื้นสัมพัทธ์เกิน ${RULE.humid}%)`;
}

export function mountClassLog(tools: HTMLElement): void {
  const status = h('p', { className: 'hint', role: 'status' });
  const chart = createLineChart({ xLabel: 'ครั้งที่บันทึก', yLabel: 'ค่าที่วัด', yMin: 0, yMax: 100 });
  const chartBox = h('div', { className: 'log-chart', hidden: true }, chart.el);
  const show = (text: string, from: string) => {
    const { rows, errors } = parseLog(text);
    if (!rows.length) { status.textContent = `อ่านไฟล์ไม่ได้: ${errors.slice(0, 3).join(' · ') || 'ไม่พบข้อมูล'}`; chartBox.hidden = true; return; }
    chart.setSeries([
      { name: 'ความกดอากาศ − 950 (hPa)', points: rows.map((r, i): [number, number] => [i + 1, r.pressure - 950]), slot: 0 },
      { name: 'ความชื้นสัมพัทธ์ (%)', points: rows.map((r, i): [number, number] => [i + 1, r.rh]), slot: 1 },
      { name: 'อุณหภูมิ (°C)', points: rows.map((r, i): [number, number] => [i + 1, r.temp]), slot: 2 },
    ]);
    chartBox.hidden = false;
    status.textContent = `${from}: ${rows.length} แถว${errors.length ? ` (ข้ามแถวที่ผิด ${errors.length} แถว: ${errors.slice(0, 2).join(' · ')})` : ''} · ${rainSignal(rows)}`;
  };
  const file = h('input', { type: 'file', accept: '.csv,text/csv' }) as HTMLInputElement;
  file.addEventListener('change', async () => { const f = file.files?.[0]; if (f) show(await f.text(), f.name); });
  tools.append(
    h('fieldset', { className: 'log-tool' },
      h('legend', {}, 'นักพยากรณ์ห้องเรียน: ข้อมูลบันทึกลมฟ้าอากาศโรงเรียน'),
      h('p', { className: 'hint' }, `ไฟล์ CSV ตามแม่แบบ U6C1-LOG: ${LOG_COLUMNS.join(', ')} ข้อมูลอ่านในเครื่องนี้เท่านั้น ไม่ส่งขึ้นเว็บ`),
      h('label', { className: 'field' }, 'เลือกไฟล์ CSV', file),
      h('button', { type: 'button', className: 'btn ghost', onclick: () => show(sample, 'ข้อมูลตัวอย่าง') }, 'ใช้ข้อมูลตัวอย่าง'),
      status, chartBox));
}
