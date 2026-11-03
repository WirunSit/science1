// docs/coverage.md (PLAN §13 Phase 6): for every indicator, the lessons, Web Lab stations, quiz items and
// worksheets that cover it, read from content/ (curriculum.yaml, quiz/*.json, worksheets/*.yaml).
// Run: npm run coverage — fails if an indicator has no lesson, no station or fewer than 5 quiz items.
import { readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { worksheets } from './catalog';
import { curriculum, root } from './content';

interface Item { id: string; lesson: string; indicator: string; level: string; station?: string }
const items: Item[] = readdirSync(resolve(root, 'content/quiz')).filter((f) => f.endsWith('.json'))
  .flatMap((f) => JSON.parse(readFileSync(resolve(root, 'content/quiz', f), 'utf8')).items as Item[]);
const sheets = worksheets();
const lessons = curriculum.units.flatMap((u) => u.chapters.flatMap((ch) => ch.lessons.map((l) => ({ ...l, chapter: ch }))));

const lines: string[] = [
  '# ความครอบคลุมตัวชี้วัด',
  '',
  'สร้างอัตโนมัติด้วย `npm run coverage` จาก content/ อย่าแก้ไฟล์นี้ด้วยมือ',
  '',
  '| ตัวชี้วัด | เรื่อง | สถานี Web Lab | คำถาม (ในแล็บ / ข้อสอบ) | ระดับ จำ·เข้าใจ·นำไปใช้/วิเคราะห์ | ใบงาน |',
  '|---|---|---|---|---|---|',
];
const problems: string[] = [];
for (const ind of curriculum.indicators.items) {
  const ls = lessons.filter((l) => l.indicators.includes(ind.id));
  const st = [...new Set(ls.flatMap((l) => l.stations.map((s) => `${l.chapter.app}/${s}`)))];
  const qs = items.filter((i) => i.indicator === ind.id);
  const inLab = qs.filter((i) => i.station).length;
  const level = (re: RegExp) => qs.filter((i) => re.test(i.level)).length;
  const ws = sheets.filter((w) => ls.some((l) => l.id === w.lesson)).map((w) => w.id);
  lines.push(`| ${ind.id} | ${ls.map((l) => l.id).join(', ') || '—'} | ${st.join(', ') || '—'} | ${inLab} / ${qs.length - inLab} | ${level(/^จำ/)}·${level(/เข้าใจ/)}·${level(/นำไปใช้|วิเคราะห์/)} | ${ws.length} ชุด |`);
  if (!ls.length) problems.push(`${ind.id}: ไม่มีเรื่องใดสอน`);
  if (!st.length) problems.push(`${ind.id}: ไม่มีสถานี Web Lab`);
  if (qs.length < 5) problems.push(`${ind.id}: มีคำถามเพียง ${qs.length} ข้อ`);
}
lines.push('', `รวม ${lessons.length} เรื่อง · ${items.length} คำถาม · ${sheets.length} ใบงาน/แบบทดสอบ`, '');
if (problems.length) lines.push('## ต้องเพิ่ม', '', ...problems.map((p) => `- ${p}`), '');
writeFileSync(resolve(root, 'docs/coverage.md'), lines.join('\n'));
console.log(`docs/coverage.md: ${curriculum.indicators.items.length} ตัวชี้วัด${problems.length ? ` — ต้องเพิ่ม ${problems.length} รายการ` : ' ครบทุกตัว'}`);
if (problems.length) process.exitCode = 1;
