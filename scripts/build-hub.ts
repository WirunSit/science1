// Course page dist/index.html (PLAN §13 Phase 6): every lab, slide deck and worksheet in one place,
// arranged unit → chapter → lesson from content/curriculum.yaml. Run after the labs: npm run build
// Files come from materials/ (npm run materials). materials/teacher is only on the teacher's computer and
// git-ignored, so the published page has student files only; set PUBLIC=1 to leave it out locally too.
import { cpSync, existsSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { EXTRAS, WORKSHEET_KIND, decks, studentMayHave, worksheets, type Worksheet } from './catalog';
import QRCode from 'qrcode';
import { config, curriculum, labUrl, root } from './content';

const dist = resolve(root, 'dist');
const materials = resolve(root, 'materials');
const withTeacher = process.env.PUBLIC !== '1' && existsSync(resolve(materials, 'teacher'));

// Copy what exists into dist/files/; the page links only files that are really there.
const published = new Set<string>();
for (const dir of ['slides', 'worksheets', ...(withTeacher ? ['teacher'] : [])]) {
  const from = resolve(materials, dir);
  if (!existsSync(from)) continue;
  cpSync(from, resolve(dist, 'files', dir), { recursive: true });
  for (const f of readdirSync(from)) published.add(`files/${dir}/${f}`);
}

/** Station titles, read from each station's `{ id, title, lesson }` export in apps/<lab>/*.ts. */
const stationTitle = new Map<string, string>();
for (const lab of readdirSync(resolve(root, 'apps'))) {
  if (lab === 'shared' || !existsSync(resolve(root, 'apps', lab, 'main.ts'))) continue;
  for (const f of readdirSync(resolve(root, 'apps', lab)).filter((x) => x.endsWith('.ts'))) {
    const src = readFileSync(resolve(root, 'apps', lab, f), 'utf8');
    for (const m of src.matchAll(/\{ id: '([\w-]+)', title: '([^']+)', lesson: '[\w-]+' \}/g)) stationTitle.set(m[1], m[2]);
  }
}

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const has = (path: string) => published.has(path);
const link = (href: string, icon: string, text: string, opts: { tag?: string; external?: boolean; cls?: string } = {}) =>
  `<a class="res${opts.cls ? ` ${opts.cls}` : ''}" href="${esc(href)}"${opts.external ? ' target="_blank" rel="noopener"' : ''}>` +
  `<span class="res-icon" aria-hidden="true">${icon}</span><span class="res-text">${esc(text)}` +
  `${opts.tag ? `<small>${esc(opts.tag)}</small>` : ''}</span></a>`;

const allDecks = decks();
const allSheets = worksheets();
const missing: string[] = [];
const need = (path: string) => {
  if (has(path)) return true;
  if (!path.startsWith('files/teacher/') || withTeacher) missing.push(path);
  return false;
};

function lessonBlock(lesson: (typeof curriculum.units)[number]['chapters'][number]['lessons'][number] & { weeks?: number[] },
  app: string, appName: string, appBuilt: boolean, n: number): string {
  const student: string[] = [];
  const teacher: string[] = [];
  // A name that only repeats the lesson title says what the thing is instead.
  const named = (title: string, instead: string) => (title === lesson.title ? instead : title);
  for (const st of lesson.stations) {
    if (appBuilt && stationTitle.has(st)) {
      student.push(link(`${app}/index.html#${st}`, '🧪', named(stationTitle.get(st)!, `ทดลองใน ${appName}`), { tag: `แล็บ ${appName}`, cls: 'lab' }));
    }
  }
  for (const d of allDecks.filter((x) => x.lesson === lesson.id)) {
    if (need(`files/slides/${d.file}.pdf`)) student.push(link(`files/slides/${d.file}.pdf`, '📊', named(d.title, 'สไลด์ประกอบการสอน'), { tag: 'สไลด์ (PDF)', external: true }));
    if (withTeacher && need(`files/teacher/${d.file}.pptx`)) teacher.push(link(`files/teacher/${d.file}.pptx`, '📊', d.title, { tag: 'สไลด์ PowerPoint มีบันทึกผู้สอน' }));
  }
  for (const w of allSheets.filter((x) => x.lesson === lesson.id && x.type !== 'Q')) sheetLinks(w, student, teacher);
  for (const x of EXTRAS.filter((e) => e.lesson === lesson.id)) {
    if (need(`files/worksheets/${x.file}`)) student.push(link(`files/worksheets/${x.file}`, '📄', x.title, { tag: x.tag }));
  }
  if (lesson.clip) student.push(link(lesson.clip, '🎬', 'คลิปประกอบบทเรียน สสวท.', { tag: 'เปิดเว็บภายนอก', external: true }));
  const weeks = lesson.weeks?.length ? ` · สัปดาห์ที่ ${lesson.weeks.join(', ')}` : '';
  return `<li class="lesson"><h4><span class="no">${n}</span>${esc(lesson.title)}</h4>` +
    `<p class="meta">${lesson.hours} ชั่วโมง${weeks}</p>` +
    (student.length ? `<div class="res-list">${student.join('')}</div>` : '<p class="soon">กำลังจัดทำสื่อ</p>') +
    (teacher.length ? `<details class="teacher"><summary>สำหรับครู (ไม่เผยแพร่)</summary><div class="res-list">${teacher.join('')}</div></details>` : '') +
    '</li>';
}

function sheetLinks(w: Worksheet, student: string[], teacher: string[]): void {
  const kind = `ใบงาน · ${WORKSHEET_KIND[w.type]}`;
  if (studentMayHave(w) && need(`files/worksheets/${w.id}-student.pdf`)) student.push(link(`files/worksheets/${w.id}-student.pdf`, '📝', w.title, { tag: `${kind} (PDF)`, external: true }));
  if (!withTeacher) return;
  if (!studentMayHave(w) && need(`files/teacher/${w.id}-student.pdf`)) teacher.push(link(`files/teacher/${w.id}-student.pdf`, '📝', w.title, { tag: `${kind} ฉบับนักเรียน (PDF)`, external: true }));
  if (need(`files/teacher/${w.id}-teacher.pdf`)) teacher.push(link(`files/teacher/${w.id}-teacher.pdf`, '🔑', w.title, { tag: `${kind} ฉบับครู มีเฉลย (PDF)`, external: true }));
  if (need(`files/teacher/${w.id}-student.docx`)) teacher.push(link(`files/teacher/${w.id}-student.docx`, '✏️', w.title, { tag: `${kind} ไฟล์ Word แก้ไขได้` }));
}

let lessonNo = 0;
const unitsHtml = curriculum.units.map((unit) => {
  const unitNo = unit.id.replace(/^U/, '');
  const chapters = unit.chapters.map((ch, ci) => {
    const appBuilt = existsSync(resolve(dist, ch.app, 'index.html'));
    const appName = ch.appTitle.match(/^[A-Za-z& ]+/)?.[0].trim() ?? ch.appTitle;
    const lessons = ch.lessons.map((l) => lessonBlock(l, ch.app, appName, appBuilt, ++lessonNo)).join('');
    const tests = allSheets.filter((w) => w.type === 'Q' && ch.lessons.some((l) => l.id === w.lesson));
    const teacher: string[] = [];
    for (const w of tests) sheetLinks(w, [], teacher);
    return `<article class="chapter" id="${esc(ch.id)}">` +
      `<header class="ch-head"><p class="kicker">บทที่ ${ci + 1}</p><h3>${esc(ch.title)}</h3>` +
      (appBuilt
        ? `<a class="btn" href="${esc(ch.app)}/index.html">เปิด ${esc(ch.appTitle)}&nbsp;›</a>`
        : `<span class="btn off" aria-disabled="true">${esc(ch.appTitle)} · กำลังจัดทำ</span>`) +
      '</header>' +
      `<ol class="lessons">${lessons}</ol>` +
      (teacher.length ? `<details class="teacher ch-teacher"><summary>แบบทดสอบท้ายบท (สำหรับครู ไม่เผยแพร่)</summary><div class="res-list">${teacher.join('')}</div></details>` : '') +
      '</article>';
  }).join('');
  return `<section class="unit" id="${esc(unit.id)}" aria-labelledby="${esc(unit.id)}-h">` +
    `<h2 id="${esc(unit.id)}-h"><span class="kicker">หน่วยการเรียนรู้ที่ ${unitNo}</span>${esc(unit.title)}</h2>${chapters}</section>`;
}).join('');

const nav = curriculum.units.flatMap((u) => u.chapters.map((ch) => `<a href="#${esc(ch.id)}">${esc(ch.title)}</a>`)).join('');
const tokens = readFileSync(resolve(root, 'apps/shared/tokens.css'), 'utf8');

const page = `<!doctype html>
<html lang="th">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>วิทยาศาสตร์ ม.1 เทอม 2</title>
<meta name="description" content="แล็บ สไลด์ และใบงานวิชา ${esc(config.courseCode)} ${esc(config.courseName)}">
<style>
${tokens}
*, *::before, *::after { box-sizing: border-box; }
html { -webkit-text-size-adjust: 100%; scroll-behavior: smooth; }
body { margin: 0; background: var(--paper); color: var(--ink); font-family: var(--font-body); font-size: 17px; line-height: 1.6; }
h1, h2, h3, h4 { font-family: var(--font-head); font-weight: 600; line-height: 1.35; margin: 0; }
a { color: inherit; }
:focus-visible { outline: 3px solid var(--glass); outline-offset: 2px; }
.wrap { max-width: 760px; margin: 0 auto; padding: 0 16px; }
.top { background: var(--card); border-bottom: 1px solid var(--rule); padding: 20px 0 14px; }
.top .kicker, .kicker { display: block; font-size: 14px; color: var(--ink-2); font-weight: 400; }
.top h1 { font-size: 26px; margin-top: 2px; }
.top .who { margin: 4px 0 0; color: var(--ink-2); font-size: 15px; }
.how { margin: 12px 0 0; font-size: 15px; }
nav.jump { display: flex; gap: 8px; overflow-x: auto; padding: 12px 0 4px; scrollbar-width: thin; }
nav.jump a { flex: none; padding: 6px 12px; border: 1.5px solid var(--rule); border-radius: 999px; text-decoration: none; font-size: 15px; background: var(--paper); }
nav.jump a:hover { border-color: var(--glass); }
.unit { margin: 28px 0; }
.unit > h2 { font-size: 22px; margin-bottom: 12px; }
.chapter { background: var(--card); border: 1.5px solid var(--rule); border-radius: var(--radius); margin: 0 0 18px; overflow: hidden; scroll-margin-top: 12px; }
.ch-head { padding: 14px 16px; border-bottom: 1px solid var(--rule); display: grid; gap: 8px; }
.ch-head h3 { font-size: 20px; }
.btn { display: inline-flex; align-items: center; justify-content: center; min-height: 48px; padding: 8px 18px; border-radius: 999px; background: var(--glass); color: var(--glass-ink); font-weight: 600; text-decoration: none; justify-self: start; }
.btn.off { background: var(--rule); color: var(--ink-2); }
.lessons { list-style: none; margin: 0; padding: 0; }
.lesson { padding: 14px 16px; border-top: 1px solid var(--rule); }
.lesson:first-child { border-top: 0; }
.lesson h4 { font-size: 18px; display: flex; gap: 10px; align-items: baseline; }
.lesson .no { flex: none; display: inline-grid; place-items: center; width: 28px; height: 28px; border-radius: 50%; background: var(--paper); border: 1.5px solid var(--rule); font-size: 14px; }
.meta { margin: 2px 0 10px 38px; color: var(--ink-2); font-size: 14px; }
.soon { margin: 0 0 0 38px; color: var(--ink-2); font-size: 15px; }
.res-list { display: grid; gap: 8px; margin-left: 38px; }
.res { display: flex; gap: 10px; align-items: center; min-height: 52px; padding: 8px 12px; border: 1.5px solid var(--rule); border-radius: 12px; text-decoration: none; background: var(--paper); }
.res:hover { border-color: var(--glass); }
.res.lab { border-color: var(--glass); }
.res-icon { flex: none; font-size: 22px; width: 28px; text-align: center; }
.res-text { min-width: 0; overflow-wrap: anywhere; }
.res-text small { display: block; color: var(--ink-2); font-size: 13px; line-height: 1.4; }
details.teacher { margin: 10px 0 0 38px; }
details.teacher summary { cursor: pointer; color: var(--warn); font-weight: 600; font-size: 15px; min-height: 36px; display: flex; align-items: center; }
details.teacher .res-list { margin-left: 0; }
details.ch-teacher { margin: 0; padding: 10px 16px 14px; border-top: 1px solid var(--rule); }
footer { color: var(--ink-2); font-size: 14px; padding: 8px 0 32px; }
@media (min-width: 720px) {
  .res-list { grid-template-columns: 1fr 1fr; }
  .ch-head { grid-template-columns: 1fr auto; align-items: end; }
  .ch-head .btn { grid-row: 1 / span 2; grid-column: 2; }
}
@media (max-width: 400px) {
  .res-list, details.teacher, .meta, .soon { margin-left: 0; }
}
</style>
</head>
<body>
<header class="top"><div class="wrap">
<span class="kicker">${esc(config.courseCode)} ${esc(config.courseName)} · ม.1 ภาคเรียนที่ ${config.semester}/${esc(config.academicYear)}</span>
<h1>สื่อการเรียนวิทยาศาสตร์ ม.1 เทอม ${config.semester}</h1>
<p class="who">${esc(config.schoolName)} · ${esc(config.teacherName)}</p>
<p class="how">🧪 แล็บ เปิดทดลองในโทรศัพท์ได้ทันที · 📊 สไลด์ และ 📝 ใบงาน เปิดเป็น PDF</p>
<nav class="jump" aria-label="ไปยังบท">${nav}</nav>
</div></header>
<main class="wrap">${unitsHtml}</main>
<footer class="wrap"><a href="qr.html">แผ่นสรุป QR ทุกแล็บ (พิมพ์ติดห้องเรียน)</a> · เนื้อหา ภาพ และแบบจำลองจัดทำขึ้นใหม่ทั้งหมดสำหรับรายวิชานี้ คลิปประกอบเป็นลิงก์ไปยังเว็บไซต์ สสวท. ข้อมูลภูมิอากาศจาก NOAA และ NASA</footer>
</body>
</html>
`;

writeFileSync(resolve(dist, 'index.html'), page);

// QR summary sheet (PLAN §13 Phase 6): one QR per experiment, A4, to print and put up in the classroom.
const cards: string[] = [];
for (const unit of curriculum.units) {
  for (const ch of unit.chapters) {
    if (!existsSync(resolve(dist, ch.app, 'index.html'))) continue;
    for (const l of ch.lessons) {
      for (const st of l.stations) {
        if (!stationTitle.has(st)) continue;
        const url = labUrl(ch.app, st);
        const svg = await QRCode.toString(url, { type: 'svg', margin: 1, errorCorrectionLevel: 'M' });
        cards.push(`<figure class="qr">${svg}<figcaption><strong>${esc(stationTitle.get(st)!)}</strong><span>${esc(ch.appTitle)} · ${esc(l.title)}</span></figcaption></figure>`);
      }
    }
  }
}
writeFileSync(resolve(dist, 'qr.html'), `<!doctype html>
<html lang="th"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>QR แล็บวิทยาศาสตร์ ม.1</title>
<style>
@page { size: A4; margin: 12mm; }
body { margin: 0; padding: 12px; font-family: 'Sarabun', 'Leelawadee UI', 'Noto Sans Thai', sans-serif; color: #1f2a2e; background: #fff; }
h1 { font-size: 20px; margin: 0 0 4px; }
p { margin: 0 0 12px; font-size: 13px; color: #56646a; }
.grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(150px, 1fr)); gap: 10px; }
.qr { margin: 0; border: 1px solid #d8d0bf; border-radius: 8px; padding: 8px; text-align: center; break-inside: avoid; }
.qr svg { width: 100%; height: auto; display: block; }
.qr strong { display: block; font-size: 14px; margin-top: 4px; }
.qr span { display: block; font-size: 11px; color: #56646a; }
@media print { body { padding: 0; } .grid { grid-template-columns: repeat(4, 1fr); } }
</style></head><body>
<h1>สแกนเปิดการทดลอง · ${esc(config.courseCode)} ${esc(config.courseName)}</h1>
<p>${esc(config.schoolName)} · ${esc(config.teacherName)} · ลิงก์ ${esc(config.baseUrl)}</p>
<div class="grid">${cards.join('')}</div>
</body></html>
`);
if (missing.length) console.warn(`ยังไม่มีไฟล์ (รัน npm run materials): ${missing.join(', ')}`);
console.log(`dist/index.html (${withTeacher ? 'มีส่วนสำหรับครู' : 'เฉพาะไฟล์ของนักเรียน'}) · dist/qr.html (${cards.length} QR)`);
