// Builds student + teacher .docx worksheets from content/worksheets/*.yaml (PLAN §6).
// Run: npm run worksheets [-- <file.yaml> ...]
import {
  AlignmentType, BorderStyle, Document, Footer, ImageRun, LeaderType, LineRuleType, Packer, PageNumber, Paragraph,
  ShadingType, Table, TableCell, TableRow, TabStopType, TextRun, VerticalAlign, WidthType,
} from 'docx';
import { mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { load as loadYaml } from 'js-yaml';
import { config, labUrl, lessonInfo, qrPng, resolvePlaceholders, root } from '../scripts/content';

interface Worksheet {
  id: string;
  lesson: string;
  /** A experiment, W with a Web Lab, P practice, R rubric, Q end-of-chapter test (PLAN §6.1). */
  type: 'A' | 'W' | 'P' | 'R' | 'Q';
  title: string;
  qr?: 'clip' | 'lab';
  labStation?: string;
  objectives: string[];
  inquiry?: { label: string; lines: number; answer: string }[];
  materials?: [string, string][];
  safety?: string[];
  procedure?: string[];
  table?: DataTableSpec;
  /** More results tables after `table` (e.g. two lab stations on one sheet); the graph sits beside the last one. */
  tables?: DataTableSpec[];
  /** Empty boxes to draw in (e.g. particle models), one per column × row, with captions. */
  draw?: { caption: string; columns: string[]; rows: string[]; answers?: string[][]; heightCm?: number };
  /** Draw boxes before the tables (design notebook: sketch first, then materials and test results). */
  drawFirst?: boolean;
  graph?: { x: string; y: string };
  /** `section` starts a new heading (e.g. "ระดับ 1 หาปริมาณความร้อน") from that question on. */
  questions?: { q: string; level: string; lines: number; answer: string; section?: string }[];
  conclusion?: { lines: number; answer: string };
  rubric?: [string, number][];
  /** A table with every cell filled in (e.g. a 4-level rubric); the first row is the header. */
  grid?: { caption: string; rows: string[][]; widths?: number[] };
  /** Multiple-choice items from content/quiz/<file>.json without a station (paper test), answer key in the teacher copy. */
  quizBank?: string;
}

interface DataTableSpec { caption: string; columns: string[]; rows: string[] }

const FONT = config.worksheetFont;
const SIZE = config.worksheetFontSizePt * 2; // half-points
const INK = '1F2A2E';
const ANSWER = 'B4441C';
const CM = 567; // twips per cm
const CONTENT_W = 21 * CM - 4 * CM; // A4 minus 2 cm margins each side

const run = (text: string, o: { bold?: boolean; size?: number; color?: string; italics?: boolean } = {}) =>
  new TextRun({ text: resolvePlaceholders(text), font: FONT, size: o.size ?? SIZE, bold: o.bold, color: o.color ?? INK, italics: o.italics });

const para = (children: TextRun[] | string, o: { before?: number; after?: number; align?: (typeof AlignmentType)[keyof typeof AlignmentType]; indent?: number } = {}) =>
  new Paragraph({
    children: typeof children === 'string' ? [run(children)] : children,
    spacing: { before: o.before ?? 0, after: o.after ?? 20, line: 240 },
    alignment: o.align,
    indent: o.indent ? { left: o.indent, hanging: o.indent > 360 ? 360 : 0 } : undefined,
  });

const heading = (text: string) => new Paragraph({ children: [run(text, { bold: true, size: SIZE + 4 })], spacing: { before: 80, after: 0, line: 240 }, keepNext: true });

/** Handwriting line height (exact) and a dotted leader to the right margin. */
const WRITE_LINE = Math.round(0.8 * CM);
const leaderLine = (children: TextRun[], indent = 360) => new Paragraph({
  children: [...children, new TextRun({ text: '\t', font: FONT, size: SIZE })],
  tabStops: [{ type: TabStopType.RIGHT, position: CONTENT_W, leader: LeaderType.DOT }],
  spacing: { before: 0, after: 0, line: WRITE_LINE, lineRule: LineRuleType.EXACT },
  indent: { left: indent },
});

/** Writing lines in the student copy; the model answer (red) in the teacher copy. */
function answerSpace(lines: number, answer: string, teacher: boolean, label?: string): Paragraph[] {
  const lead = label ? [run(`${label}  `, { bold: true })] : [];
  // Teacher answers 2 pt smaller than the text, so the teacher copy stays within the same 2 pages (PLAN §6.3).
  if (teacher) return [para([...lead, run('แนวคำตอบ: ', { bold: true, color: ANSWER, size: SIZE - 4 }), run(answer, { color: ANSWER, italics: true, size: SIZE - 4 })], { indent: 360, after: 40 })];
  return Array.from({ length: lines }, (_, i) => leaderLine(i === 0 ? lead : []));
}

const cellBorders = (color = 'B9B09D', size = 4) => ({
  top: { style: BorderStyle.SINGLE, size, color },
  bottom: { style: BorderStyle.SINGLE, size, color },
  left: { style: BorderStyle.SINGLE, size, color },
  right: { style: BorderStyle.SINGLE, size, color },
});

function cell(children: (Paragraph | Table)[], o: { width: number; fill?: string; borders?: ReturnType<typeof cellBorders> | 'none'; top?: boolean } = { width: 1000 }) {
  const none = { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' };
  return new TableCell({
    children,
    width: { size: o.width, type: WidthType.DXA },
    verticalAlign: o.top ? VerticalAlign.TOP : VerticalAlign.CENTER,
    shading: o.fill ? { type: ShadingType.CLEAR, color: 'auto', fill: o.fill } : undefined,
    borders: o.borders === 'none' ? { top: none, bottom: none, left: none, right: none } : o.borders ?? cellBorders(),
    margins: { top: 40, bottom: 40, left: 100, right: 100 },
  });
}

async function header(ws: Worksheet): Promise<Table> {
  const lesson = lessonInfo(ws.lesson);
  const url = ws.qr === 'lab' ? labUrl(lesson.chapter.app, ws.labStation) : lesson.clip ?? labUrl(lesson.chapter.app);
  const qr = await qrPng(url);
  const left = [
    para([run(config.schoolName, { bold: true })], { after: 0 }),
    para([run(ws.title, { bold: true, size: SIZE + 8 })], { after: 0 }),
    para([run(`รหัส ${ws.id}  ·  ${lesson.id} ${lesson.title}`, { size: SIZE - 4 })], { after: 0 }),
    para([run(`ตัวชี้วัด ${lesson.indicators.join(', ')}`, { size: SIZE - 4 })], { after: 80 }),
    para([run('ชื่อ–สกุล ......................................................... ชั้น ............ เลขที่ ........ กลุ่ม ........')], { after: 0 }),
  ];
  const qrW = Math.round(2.8 * CM);
  return new Table({
    width: { size: CONTENT_W, type: WidthType.DXA },
    columnWidths: [CONTENT_W - qrW - 200, qrW + 200],
    rows: [new TableRow({
      children: [
        cell(left, { width: CONTENT_W - qrW - 200, borders: 'none' }),
        cell([
          new Paragraph({ alignment: AlignmentType.CENTER, children: [new ImageRun({ type: 'png', data: qr, transformation: { width: 96, height: 96 } })] }),
          para([run(ws.qr === 'lab' ? 'สแกนเปิด Web Lab' : 'สแกนดูคลิปทบทวน', { size: SIZE - 8 })], { align: AlignmentType.CENTER, after: 0 }),
        ], { width: qrW + 200, borders: 'none' }),
      ],
    })],
  });
}

function dataTable(t: DataTableSpec, width = CONTENT_W): Table {
  const w = Math.floor(width / t.columns.length);
  const row = (cells: string[], head = false) => new TableRow({
    tableHeader: head,
    height: head ? undefined : { value: Math.round(0.85 * CM), rule: 'atLeast' },
    children: cells.map((c) => cell([para([run(c, { bold: head, size: head ? SIZE - 2 : SIZE })], { align: AlignmentType.CENTER, after: 0 })], { width: w, fill: head ? 'DCEFEE' : undefined, borders: cellBorders('56646A', 6) })),
  });
  return new Table({
    width: { size: w * t.columns.length, type: WidthType.DXA },
    columnWidths: t.columns.map(() => w),
    rows: [row(t.columns, true), ...t.rows.map((r) => row([r, ...t.columns.slice(1).map(() => '')]))],
  });
}

/** Drawing boxes: a header row of column names, then one tall empty box per cell (model answer in the teacher copy). */
function drawGrid(d: NonNullable<Worksheet['draw']>, teacher: boolean): Table {
  const headW = Math.round(2.6 * CM);
  const w = Math.floor((CONTENT_W - headW) / d.columns.length);
  const border = cellBorders('56646A', 6);
  return new Table({
    width: { size: headW + w * d.columns.length, type: WidthType.DXA },
    columnWidths: [headW, ...d.columns.map(() => w)],
    rows: [
      new TableRow({ tableHeader: true, children: [cell([para('')], { width: headW, borders: border, fill: 'DCEFEE' }),
        ...d.columns.map((c) => cell([para([run(c, { bold: true, size: SIZE - 2 })], { align: AlignmentType.CENTER, after: 0 })], { width: w, fill: 'DCEFEE', borders: border }))] }),
      ...d.rows.map((r, ri) => new TableRow({
        height: { value: Math.round((d.heightCm ?? 3.0) * CM), rule: 'exact' },
        children: [
          cell([para([run(r, { bold: true, size: SIZE - 2 })], { align: AlignmentType.CENTER, after: 0 })], { width: headW, borders: border }),
          ...d.columns.map((_, ci) => cell([para(teacher && d.answers ? [run(d.answers[ri]?.[ci] ?? '', { color: ANSWER, italics: true, size: SIZE - 4 })] : '', { after: 0 })], { width: w, borders: border, top: true })),
        ],
      })),
    ],
  });
}

/** A table with text in every cell; widths are relative (default equal). */
function fullTable(g: NonNullable<Worksheet['grid']>): Table {
  const rel = g.widths ?? g.rows[0].map(() => 1);
  const sum = rel.reduce((a, b) => a + b, 0);
  const widths = rel.map((r) => Math.floor((CONTENT_W * r) / sum));
  const border = cellBorders('56646A', 6);
  return new Table({
    width: { size: widths.reduce((a, b) => a + b, 0), type: WidthType.DXA },
    columnWidths: widths,
    rows: g.rows.map((r, ri) => new TableRow({
      tableHeader: ri === 0,
      children: r.map((c, ci) => cell([para([run(c, { bold: ri === 0 || ci === 0, size: SIZE - 4 })], { after: 0 })], { width: widths[ci], fill: ri === 0 ? 'DCEFEE' : undefined, borders: border, top: true })),
    })),
  });
}

interface BankItem { id: string; station?: string; indicator: string; level: string; stem: string; choices: string[]; answer: number; explanation: string }
const LETTERS = ['ก', 'ข', 'ค', 'ง'];

/** Paper multiple-choice test: items without a station (PLAN §6.4); the teacher copy adds the key and the reason. */
function quizItems(file: string, teacher: boolean): Paragraph[] {
  const items = (JSON.parse(readFileSync(resolve(root, 'content/quiz', `${file}.json`), 'utf8')).items as BankItem[]).filter((q) => !q.station);
  const out: Paragraph[] = [heading(`คำชี้แจง เลือกคำตอบที่ถูกที่สุดเพียงข้อเดียว (${items.length} ข้อ ข้อละ 1 คะแนน)`)];
  items.forEach((q, i) => {
    // {c:...} placeholders let a stem quote c values from constants instead of typing them.
    out.push(new Paragraph({ children: [run(`${i + 1}. ${resolvePlaceholders(q.stem)}`)], spacing: { before: 60, after: 0, line: 240 }, keepNext: true, indent: { left: 360, hanging: 360 } }));
    q.choices.forEach((c, ci) => out.push(new Paragraph({
      children: [run(`${LETTERS[ci]}. ${resolvePlaceholders(c)}`, { bold: teacher && ci === q.answer, color: teacher && ci === q.answer ? ANSWER : undefined })],
      spacing: { before: 0, after: 0, line: 240 }, keepNext: ci < q.choices.length - 1, indent: { left: 720 },
    })));
    if (teacher) out.push(para([run(`เฉลย ${LETTERS[q.answer]} · ${q.level} · ${q.indicator} — ${resolvePlaceholders(q.explanation)}`, { color: ANSWER, italics: true, size: SIZE - 6 })], { indent: 720, after: 20 }));
  });
  return out;
}

/** Graph paper as a fine table grid: prints crisply on any printer. */
function graphPaper(g: NonNullable<Worksheet['graph']>, width: number): (Paragraph | Table)[] {
  const cols = 16;
  const rows = 11;
  const w = Math.floor(width / cols);
  const grid = new Table({
    width: { size: w * cols, type: WidthType.DXA },
    columnWidths: Array.from({ length: cols }, () => w),
    rows: Array.from({ length: rows }, () => new TableRow({
      height: { value: w, rule: 'exact' },
      children: Array.from({ length: cols }, () => cell([new Paragraph({ children: [] })], { width: w, borders: cellBorders('9CC3D5', 4) })),
    })),
  });
  return [
    para([run(`↑ ${g.y}`, { size: SIZE - 4 })], { after: 0 }),
    grid,
    para([run(`${g.x} →`, { size: SIZE - 4 })], { align: AlignmentType.RIGHT, after: 0 }),
  ];
}

async function build(file: string, teacher: boolean): Promise<string> {
  const ws = loadYaml(readFileSync(resolve(root, 'content/worksheets', file), 'utf8')) as Worksheet;
  // A list item with an unquoted ": " becomes a YAML mapping and would print as [object Object].
  for (const key of ['objectives', 'procedure', 'safety'] as const) {
    const bad = ws[key]?.find((x) => typeof x !== 'string');
    if (bad) throw new Error(`${file}: ${key} มีรายการที่ไม่ใช่ข้อความ (ใส่เครื่องหมายคำพูดครอบข้อความที่มี ": ") — ${JSON.stringify(bad)}`);
  }
  const lesson = lessonInfo(ws.lesson);
  const body: (Paragraph | Table)[] = [await header(ws)];
  if (teacher) body.push(para([run('ฉบับครู (มีแนวคำตอบ)', { bold: true, color: ANSWER })], { before: 60 }));

  body.push(heading('จุดประสงค์ของกิจกรรม'), ...ws.objectives.map((o, i) => para(`${i + 1}. ${o}`, { indent: 360 })));
  if (ws.inquiry) {
    body.push(heading('คำถาม สมมติฐาน และตัวแปร'));
    for (const q of ws.inquiry) body.push(...answerSpace(q.lines, q.answer, teacher, q.label));
  }
  if (ws.materials) {
    const half = Math.ceil(ws.materials.length / 2);
    const col = (items: [string, string][]) => cell(items.map(([item, qty]) => para(`•  ${item}  ${qty}`, { after: 0 })), { width: CONTENT_W / 2, borders: 'none', top: true });
    body.push(heading('วัสดุอุปกรณ์ (ต่อกลุ่ม)'), new Table({
      width: { size: CONTENT_W, type: WidthType.DXA },
      columnWidths: [CONTENT_W / 2, CONTENT_W / 2],
      rows: [new TableRow({ children: [col(ws.materials.slice(0, half)), col(ws.materials.slice(half))] })],
    }));
  }
  if (ws.safety) {
    // Boxed so it stands out on a black-and-white print.
    body.push(new Table({
      width: { size: CONTENT_W, type: WidthType.DXA },
      columnWidths: [CONTENT_W],
      rows: [new TableRow({ children: [cell([
        para([run('⚠ ข้อควรระวังด้านความปลอดภัย', { bold: true, color: ANSWER })], { after: 20 }),
        ...ws.safety.map((s) => para(`•  ${s}`, { indent: 360, after: 0 })),
      ], { width: CONTENT_W, fill: 'F8E4D9', borders: cellBorders(ANSWER, 12) })] })],
    }));
  }
  if (ws.procedure) body.push(heading('วิธีการทดลอง'), ...ws.procedure.map((p, i) => para(`${i + 1}. ${p}`, { indent: 360 })));
  const drawing = () => (ws.draw ? [heading(ws.draw.caption), drawGrid(ws.draw, teacher)] : []);
  if (ws.drawFirst) body.push(...drawing());
  const tables = [...(ws.table ? [ws.table] : []), ...(ws.tables ?? [])];
  tables.forEach((t, i) => {
    if (ws.graph && i === tables.length - 1) {
      // Results table beside the graph paper keeps an experiment sheet within 2 pages; wide tables get more room.
      const tw = Math.round(CONTENT_W * (t.columns.length > 3 ? 0.56 : 0.42));
      const gw = CONTENT_W - tw - 300;
      body.push(heading(`${t.caption} และกราฟ`), new Table({
        width: { size: CONTENT_W, type: WidthType.DXA },
        columnWidths: [tw, CONTENT_W - tw],
        rows: [new TableRow({ children: [
          cell([dataTable(t, tw - 200), para('')], { width: tw, borders: 'none', top: true }),
          cell(graphPaper(ws.graph, gw), { width: CONTENT_W - tw, borders: 'none' }),
        ] })],
      }));
    } else {
      body.push(heading(t.caption), dataTable(t));
    }
  });
  if (!ws.drawFirst) body.push(...drawing());
  if (ws.questions) {
    if (!ws.questions[0].section) body.push(heading(ws.type === 'P' ? 'คำถาม' : 'คำถามท้ายกิจกรรม'));
    ws.questions.forEach((q, i) => {
      if (q.section) body.push(heading(q.section));
      body.push(para([run(`${i + 1}. ${q.q}`)], { indent: 360, before: 40, after: 0 }), ...answerSpace(q.lines, q.answer, teacher));
    });
  }
  if (ws.conclusion) body.push(heading('สรุปผลการทดลอง'), ...answerSpace(ws.conclusion.lines, ws.conclusion.answer, teacher));
  if (ws.grid) body.push(heading(ws.grid.caption), fullTable(ws.grid));
  if (ws.quizBank) body.push(...quizItems(ws.quizBank, teacher));
  if (ws.rubric) {
    const total = ws.rubric.reduce((s, [, p]) => s + p, 0);
    body.push(heading(`เกณฑ์การให้คะแนน (${total} คะแนน)`), para(ws.rubric.map(([c, p]) => `${c} (${p})`).join('  ·  '), { indent: 360 }));
  }

  const doc = new Document({
    creator: config.teacherName,
    title: `${ws.id} ${ws.title}`,
    styles: { default: { document: { run: { font: FONT, size: SIZE } } } },
    sections: [{
      properties: { page: { size: { width: 21 * CM, height: Math.round(29.7 * CM) }, margin: { top: 2 * CM, bottom: 2 * CM, left: 2 * CM, right: 2 * CM } } },
      footers: {
        default: new Footer({ children: [new Paragraph({
          alignment: AlignmentType.RIGHT,
          children: [run(`${ws.id}${teacher ? ' (ฉบับครู)' : ''} · ${lesson.indicators.join(', ')} · หน้า `, { size: SIZE - 6, color: '56646A' }),
            new TextRun({ children: [PageNumber.CURRENT], font: FONT, size: SIZE - 6, color: '56646A' })],
        })] }),
      },
      children: body,
    }],
  });

  const outDir = resolve(root, 'worksheets/out');
  mkdirSync(outDir, { recursive: true });
  const out = resolve(outDir, `${ws.id}-${teacher ? 'teacher' : 'student'}.docx`);
  writeFileSync(out, await Packer.toBuffer(doc));
  return out;
}


const args = process.argv.slice(2);
const files = args.length ? args : readdirSync(resolve(root, 'content/worksheets')).filter((f) => f.endsWith('.yaml'));
for (const f of files) {
  for (const teacher of [false, true]) console.log(`สร้าง ${await build(f, teacher)}`);
}
