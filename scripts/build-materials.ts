// Builds every slide deck and worksheet, converts them to PDF with Microsoft Office, and copies them into
// materials/ for the course page (dist/index.html, scripts/build-hub.ts). Run on the teacher's computer:
//   npm run materials
// materials/slides and materials/worksheets (student copies) are committed and published.
// materials/teacher (editable .pptx/.docx, teacher copies with answers, chapter tests) is git-ignored,
// so answer keys never reach the public site; it only shows up when the page is built on this computer.
import { execFileSync, execSync } from 'node:child_process';
import { copyFileSync, existsSync, mkdirSync, rmSync } from 'node:fs';
import { resolve } from 'node:path';
import { EXTRAS, decks, studentMayHave, worksheets } from './catalog';
import { root } from './content';

const run = (cmd: string) => execSync(cmd, { cwd: root, stdio: 'inherit' });
run('npm run slides');
run('npm run worksheets');

const slide = (f: string, ext: string) => resolve(root, 'slides/out', `${f}.${ext}`);
const sheet = (id: string, copy: 'student' | 'teacher', ext: string) => resolve(root, 'worksheets/out', `${id}-${copy}.${ext}`);
const sources = [
  ...decks().map((d) => slide(d.file, 'pptx')),
  ...worksheets().flatMap((w) => [sheet(w.id, 'student', 'docx'), sheet(w.id, 'teacher', 'docx')]),
];
execFileSync('powershell', ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', resolve(root, 'scripts/office-export.ps1'), '-NoPng', ...sources], {
  cwd: root, stdio: 'inherit',
});

const out = (dir: string) => {
  const p = resolve(root, 'materials', dir);
  rmSync(p, { recursive: true, force: true });
  mkdirSync(p, { recursive: true });
  return p;
};
const slidesDir = out('slides');
const sheetsDir = out('worksheets');
const teacherDir = out('teacher');
const put = (from: string, dir: string, name: string) => {
  if (!existsSync(from)) throw new Error(`ไม่พบไฟล์ ${from}`);
  copyFileSync(from, resolve(dir, name));
};

for (const d of decks()) {
  put(slide(d.file, 'pdf'), slidesDir, `${d.file}.pdf`);
  put(slide(d.file, 'pptx'), teacherDir, `${d.file}.pptx`);
}
for (const w of worksheets()) {
  put(sheet(w.id, 'student', 'pdf'), studentMayHave(w) ? sheetsDir : teacherDir, `${w.id}-student.pdf`);
  put(sheet(w.id, 'student', 'docx'), teacherDir, `${w.id}-student.docx`);
  put(sheet(w.id, 'teacher', 'pdf'), teacherDir, `${w.id}-teacher.pdf`);
  put(sheet(w.id, 'teacher', 'docx'), teacherDir, `${w.id}-teacher.docx`);
}
for (const x of EXTRAS) put(resolve(root, 'content/worksheets', x.file), sheetsDir, x.file);
console.log(`materials/: สไลด์ ${decks().length} ชุด ใบงาน ${worksheets().length} ชุด`);
