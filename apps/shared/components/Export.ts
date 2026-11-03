// Score card image (PLAN §4.2 step 3, §4.4). Nothing leaves the device by itself:
// the PNG opens in the phone's share sheet (LINE, Classroom) or downloads on a computer.
import { h } from '../dom';
import { t } from '../i18n';
import type { Student } from '../student';

export interface ScoreCard {
  lab: string;
  title: string;
  student: Student;
  score: number;
  total: number;
  /** Right (true) or wrong (false) for each question, in order. */
  marks: boolean[];
  tables?: { head: string[]; rows: string[][] }[];
  attempt: number;
  when: Date;
}

const W = 1080;
const M = 56;
const FONT = "'IBM Plex Sans Thai Looped', 'Leelawadee UI', sans-serif";
const INK = '#1f2a2e';
const INK2 = '#56646a';
const GLASS = '#0e6b70';

export async function renderScoreCard(c: ScoreCard): Promise<Blob> {
  await document.fonts?.ready;
  const draw = (ctx: CanvasRenderingContext2D, paint: boolean): number => {
    let y = 0;
    const text = (s: string, size: number, weight = 400, color = INK, x = M) => {
      ctx.font = `${weight} ${size}px ${FONT}`;
      ctx.fillStyle = color;
      y += size * 1.5;
      if (paint) ctx.fillText(s, x, y, W - x - M);
    };

    // band with the lab name
    if (paint) {
      ctx.fillStyle = GLASS;
      ctx.fillRect(0, 0, W, 76);
      ctx.font = `600 26px ${FONT}`;
      ctx.fillStyle = '#ffffff';
      ctx.fillText(`${c.lab} · บัตรคะแนน`, M, 48);
    }
    y = 84;
    text(c.title, 38, 600);
    text(`${c.student.name}   ชั้น ${c.student.className || '–'}   เลขที่ ${c.student.number}`, 30);
    y += 20;

    // score
    if (paint) {
      ctx.fillStyle = '#dcefee';
      ctx.fillRect(M, y, W - 2 * M, 150);
      ctx.fillStyle = GLASS;
      ctx.font = `600 96px ${FONT}`;
      ctx.fillText(`${c.score} / ${c.total}`, M + 32, y + 112);
      ctx.font = `400 28px ${FONT}`;
      ctx.fillStyle = INK;
      ctx.fillText('คะแนน', M + 360, y + 70);
      ctx.fillStyle = INK2;
      ctx.font = `400 24px ${FONT}`;
      ctx.fillText(`ทำครั้งที่ ${c.attempt}`, M + 360, y + 110);
    }
    y += 172;

    // ✓ / ✗ per question
    const chipW = (W - 2 * M - (c.marks.length - 1) * 12) / c.marks.length;
    if (paint) {
      c.marks.forEach((ok, i) => {
        const x = M + i * (chipW + 12);
        ctx.fillStyle = ok ? '#dfeedd' : '#f8e4d9';
        ctx.fillRect(x, y, chipW, 56);
        ctx.fillStyle = ok ? '#2f6b3a' : '#b4441c';
        ctx.font = `600 24px ${FONT}`;
        ctx.fillText(`ข้อ ${i + 1} ${ok ? '✓' : '✗'}`, x + 16, y + 37, chipW - 24);
      });
    }
    y += 76;
    // results tables
    for (const [ti, table] of (c.tables ?? []).entries()) {
      if (ti === 0) text('ผลการทดลองของฉัน', 26, 600);
      y += 12;
      const cols = table.head.length;
      const colW = (W - 2 * M) / cols;
      const headLines = Math.max(...table.head.map((s) => s.split('\n').length));
      const headH = 16 + headLines * 31;
      if (paint) {
        ctx.fillStyle = '#dcefee';
        ctx.fillRect(M, y, W - 2 * M, headH);
        ctx.fillStyle = INK;
        ctx.font = `600 21px ${FONT}`;
        table.head.forEach((s, ci) => s.split('\n').forEach((ln, li) => ctx.fillText(ln, M + ci * colW + 12, y + 33 + li * 31, colW - 20)));
      }
      y += headH;
      const rowH = 44;
      table.rows.forEach((cells, ri) => {
        if (paint) {
          ctx.fillStyle = ri % 2 ? '#f5f2ea' : '#ffffff';
          ctx.fillRect(M, y, W - 2 * M, rowH);
          ctx.fillStyle = INK;
          ctx.font = `400 24px ${FONT}`;
          cells.forEach((cell, ci) => ctx.fillText(cell, M + ci * colW + 12, y + 30, colW - 20));
        }
        y += rowH;
      });
      y += 12;
    }
    text(c.when.toLocaleString('th-TH', { dateStyle: 'long', timeStyle: 'short' }), 22, 400, INK2);
    return y + M;
  };

  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = draw(canvas.getContext('2d')!, false);
  const ctx = canvas.getContext('2d')!;
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, W, canvas.height);
  draw(ctx, true);
  return new Promise((resolve, reject) => canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('toBlob failed'))), 'image/png'));
}

function download(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = h('a', { href: url, download: filename });
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 5000);
}

export function safeName(s: string): string {
  return s.replace(/[\\/:*?"<>|\s]+/g, '-').slice(0, 60);
}

/** Short message at the bottom of the screen (the layout has no room for a status line). */
export function toast(message: string): void {
  document.querySelector('.toast')?.remove();
  const el = h('div', { className: 'toast', role: 'status' }, message);
  document.body.append(el);
  setTimeout(() => el.remove(), 4000);
}

/** Phones: open the share sheet so the student can send straight to LINE / Classroom. Otherwise download. */
export async function shareImage(blob: Blob, filename: string, title: string): Promise<void> {
  const file = new File([blob], filename, { type: 'image/png' });
  if (navigator.canShare?.({ files: [file] })) {
    try {
      await navigator.share({ files: [file], title });
      toast(t('score.shared'));
      return;
    } catch (e) {
      if ((e as Error).name === 'AbortError') return; // the student closed the share sheet
      /* sharing failed: fall back to download */
    }
  }
  download(blob, filename);
  toast(t('score.saved'));
}
