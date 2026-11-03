// Builds 16:9 .pptx decks from content/lessons/*.md (PLAN §5). Run: npm run slides [-- <lesson.md> ...]
import PptxGenJS from 'pptxgenjs';
import { mkdirSync, readFileSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { config, labUrl, lessonInfo, loadLesson, qrPng, root, type SlideKind, type SlideSpec } from '../scripts/content';

const C = { paper: 'F5F2EA', card: 'FFFDF8', ink: '1F2A2E', ink2: '56646A', rule: 'D8D0BF', glass: '0E6B70', glassSoft: 'DCEFEE', warn: 'B4441C', warnSoft: 'F8E4D9' };
const FONT = config.slideFont;
const W = 13.333;

const PHASE: Partial<Record<SlideKind, { en: string; th: string; color: string }>> = {
  engage: { en: 'Engage', th: 'ขั้นสร้างความสนใจ', color: 'B4441C' },
  explore: { en: 'Explore', th: 'ขั้นสำรวจและค้นหา', color: '0E6B70' },
  explain: { en: 'Explain', th: 'ขั้นอธิบายและลงข้อสรุป', color: '6B4FA0' },
  example: { en: 'Explain', th: 'ขั้นอธิบายและลงข้อสรุป', color: '6B4FA0' },
  summary: { en: 'Explain', th: 'ขั้นอธิบายและลงข้อสรุป', color: '6B4FA0' },
  elaborate: { en: 'Elaborate', th: 'ขั้นขยายความรู้', color: '8A6D1F' },
  check: { en: 'Evaluate', th: 'ขั้นประเมิน', color: '2F6B3A' },
  evaluate: { en: 'Evaluate', th: 'ขั้นประเมิน', color: '2F6B3A' },
};

const LETTERS = ['ก', 'ข', 'ค', 'ง'];

function svgData(name: string): string {
  return `image/svg+xml;base64,${readFileSync(resolve(root, 'slides/diagrams', `${name}.svg`)).toString('base64')}`;
}

/** Width ÷ height from the SVG's viewBox, so diagrams are never stretched. */
function svgAspect(name: string): number {
  const m = readFileSync(resolve(root, 'slides/diagrams', `${name}.svg`), 'utf8').match(/viewBox="[\d.-]+ [\d.-]+ ([\d.]+) ([\d.]+)"/);
  return m ? Number(m[1]) / Number(m[2]) : 1;
}
/** Wide diagrams go under the text across the slide; others sit on the right. */
const isWide = (name: string) => svgAspect(name) > 1.8;

async function buildDeck(file: string): Promise<string> {
  const { meta, slides } = loadLesson(file);
  const lesson = lessonInfo(String(meta.id));
  const footer = `${lesson.id}${meta.deck ? ` ชุดที่ ${meta.deck}` : ''} · ${lesson.indicators.join(', ')}`;
  const pptx = new PptxGenJS();
  pptx.layout = 'LAYOUT_WIDE';
  pptx.title = `${lesson.title}${meta.deckTitle ? ` — ${meta.deckTitle}` : ''}`;
  pptx.author = config.teacherName;
  pptx.company = config.schoolName;
  pptx.theme = { headFontFace: FONT, bodyFontFace: FONT };

  const labQr = `image/png;base64,${(await qrPng(labUrl(String(meta.lab ?? lesson.chapter.app), String(meta.labStation ?? '')))).toString('base64')}`;
  const clipQr = lesson.clip ? `image/png;base64,${(await qrPng(lesson.clip)).toString('base64')}` : null;

  for (const spec of slides) {
    const sl = pptx.addSlide();
    sl.background = { color: C.paper };
    if (spec.notes) sl.addNotes(spec.notes);
    sl.addText(footer, { x: 0.5, y: 7.0, w: 8, h: 0.35, fontFace: FONT, fontSize: 14, color: C.ink2 });
    sl.addText(config.schoolName, { x: W - 5.5, y: 7.0, w: 5, h: 0.35, fontFace: FONT, fontSize: 14, color: C.ink2, align: 'right' });

    if (spec.kind === 'title') {
      titleSlide(sl, spec, lesson.unit.title, lesson.chapter.title, String(meta.deckTitle ?? ''));
      continue;
    }

    const phase = PHASE[spec.kind];
    if (phase) {
      sl.addShape('roundRect', { x: W - 3.9, y: 0.35, w: 3.4, h: 0.5, fill: { color: phase.color }, rectRadius: 0.25, line: { color: phase.color } });
      sl.addText(`${phase.en} · ${phase.th}`, { x: W - 3.9, y: 0.35, w: 3.4, h: 0.5, fontFace: FONT, fontSize: 14, bold: true, color: 'FFFFFF', align: 'center', valign: 'middle' });
    }
    sl.addText(spec.title, { x: 0.5, y: 0.35, w: phase ? W - 4.7 : W - 1, h: 1.0, fontFace: FONT, fontSize: 38, bold: true, color: C.ink, valign: 'middle', fit: 'shrink' });
    sl.addShape('line', { x: 0.5, y: 1.45, w: 2.2, h: 0, line: { color: C.glass, width: 4 } });

    const qr = spec.qr === 'lab' ? labQr : spec.qr === 'clip' ? clipQr : null;
    const sideDiagram = Boolean(spec.diagram && !isWide(spec.diagram));
    const bodyW = qr || sideDiagram ? W - 4.8 : W - 1;
    let y = 1.75;
    // Room kept at the bottom for a wide diagram.
    const bottom = spec.diagram && !sideDiagram ? 6.7 - Math.min(2.9, (W - 1) / svgAspect(spec.diagram)) - 0.1 : 6.7;

    if (spec.equation) {
      // Box as wide as the equation needs (about 0.3 in per character at 40 pt), never wider than the text column.
      const ew = Math.min(bodyW, Math.max(5.4, 0.3 * spec.equation.length + 1));
      sl.addShape('roundRect', { x: 0.5, y, w: ew, h: 1.5, fill: { color: C.card }, line: { color: C.glass, width: 2 }, rectRadius: 0.15 });
      sl.addText(spec.equation, { x: 0.5, y, w: ew, h: 1.5, fontFace: FONT, fontSize: 40, bold: true, color: C.glass, align: 'center', valign: 'middle', fit: 'shrink' });
      y += 1.8;
    }
    if (spec.bullets.length) {
      const h = Math.min(bottom - y - (spec.safety ? 1.2 : 0) - (spec.choices.length ? 1.9 : 0), 0.62 * spec.bullets.length + 0.2);
      sl.addText(spec.bullets.map((b) => ({ text: b, options: { bullet: { indent: 24 }, breakLine: true } })), {
        x: 0.5, y, w: bodyW, h, fontFace: FONT, fontSize: 26, color: C.ink, valign: 'top', paraSpaceAfter: 6, fit: 'shrink',
      });
      y += h + 0.2;
    }
    if (spec.choices.length) {
      const cw = (bodyW - 0.3 * (spec.choices.length - 1)) / spec.choices.length;
      spec.choices.forEach((c, i) => {
        const x = 0.5 + i * (cw + 0.3);
        sl.addShape('roundRect', { x, y, w: cw, h: 1.6, fill: { color: C.card }, line: { color: C.rule, width: 1.5 }, rectRadius: 0.12 });
        sl.addText([{ text: `${LETTERS[i]}  `, options: { bold: true, color: C.glass } }, { text: c }], { x: x + 0.1, y, w: cw - 0.2, h: 1.6, fontFace: FONT, fontSize: 24, color: C.ink, valign: 'middle', fit: 'shrink' });
      });
      y += 1.9;
    }
    if (spec.safety) {
      sl.addShape('rect', { x: 0.5, y: Math.min(y, 5.6), w: bodyW, h: 1.0, fill: { color: C.warnSoft }, line: { color: C.warnSoft } });
      sl.addShape('rect', { x: 0.5, y: Math.min(y, 5.6), w: 0.1, h: 1.0, fill: { color: C.warn }, line: { color: C.warn } });
      sl.addText([{ text: '⚠ ความปลอดภัย  ', options: { bold: true, color: C.warn } }, { text: spec.safety }], { x: 0.75, y: Math.min(y, 5.6), w: bodyW - 0.35, h: 1.0, fontFace: FONT, fontSize: 22, color: C.ink, valign: 'middle', fit: 'shrink' });
    }
    if (spec.diagram) {
      const a = svgAspect(spec.diagram);
      if (sideDiagram) {
        const w = Math.min(3.8, 4.6 * a);
        sl.addImage({ data: svgData(spec.diagram), x: W - 0.5 - w, y: 1.8, w, h: w / a });
      } else {
        const h = Math.min(2.9, (W - 1) / a);
        sl.addImage({ data: svgData(spec.diagram), x: (W - h * a) / 2, y: 6.7 - h, w: h * a, h });
      }
    }
    if (qr) {
      sl.addShape('roundRect', { x: W - 3.9, y: 1.8, w: 3.4, h: 4.2, fill: { color: C.card }, line: { color: C.rule, width: 1.5 }, rectRadius: 0.12 });
      sl.addImage({ data: qr, x: W - 3.55, y: 2.0, w: 2.7, h: 2.7 });
      sl.addText(spec.qr === 'lab' ? `สแกนเปิด ${lesson.chapter.appTitle}` : 'สแกนดูคลิปทบทวน Project 14 (สสวท.)', {
        x: W - 3.8, y: 4.75, w: 3.2, h: 1.1, fontFace: FONT, fontSize: 18, color: C.ink2, align: 'center', valign: 'top', fit: 'shrink',
      });
    }
  }

  const outDir = resolve(root, 'slides/out');
  mkdirSync(outDir, { recursive: true });
  const out = resolve(outDir, `${lesson.id}${meta.deck ? `-${meta.deck}` : ''}.pptx`);
  await pptx.writeFile({ fileName: out });
  return out;
}

function titleSlide(sl: PptxGenJS.Slide, spec: SlideSpec, unit: string, chapter: string, deckTitle: string): void {
  sl.addShape('rect', { x: 0, y: 0, w: 0.25, h: 7.5, fill: { color: C.glass }, line: { color: C.glass } });
  sl.addText(`หน่วย: ${unit}\nบท: ${chapter}`, { x: 0.8, y: 0.8, w: 8, h: 1.0, fontFace: FONT, fontSize: 20, color: C.glass, bold: true, valign: 'bottom' });
  // Narrower title when a picture sits on the right, so they never overlap.
  const titleW = spec.diagram ? 7.2 : 8;
  sl.addText(spec.title, { x: 0.8, y: 1.9, w: titleW, h: 2.2, fontFace: FONT, fontSize: spec.diagram ? 40 : 44, bold: true, color: C.ink, valign: 'top', fit: 'shrink' });
  if (deckTitle) sl.addText(deckTitle, { x: 0.8, y: 4.1, w: 8, h: 0.8, fontFace: FONT, fontSize: 28, color: C.ink2 });
  sl.addText(`${config.courseCode} ${config.courseName} ม.1 ภาคเรียนที่ ${config.semester}/${config.academicYear}\n${config.teacherName}`, {
    x: 0.8, y: 5.2, w: 8, h: 1.2, fontFace: FONT, fontSize: 20, color: C.ink2, valign: 'top',
  });
  if (spec.diagram) {
    const a = svgAspect(spec.diagram);
    const w = Math.min(4.2, 4.4 * a);
    sl.addImage({ data: svgData(spec.diagram), x: W - 0.6 - w, y: 1.2 + (4.4 - w / a) / 2, w, h: w / a });
  }
}

const args = process.argv.slice(2);
const files = args.length ? args : readdirSync(resolve(root, 'content/lessons')).filter((f) => f.endsWith('.md'));
for (const f of files) console.log(`สร้าง ${await buildDeck(f)}`);
