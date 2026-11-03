// What teaching material exists, read from content/ (the single source): one slide deck per lesson file and
// a student + teacher copy per worksheet. Shared by build-materials.ts and build-hub.ts.
import { readFileSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { load as loadYaml } from 'js-yaml';
import { root } from './content';

export interface Deck {
  lesson: string;
  /** File name without extension, as slides/build-slides.ts writes it. */
  file: string;
  title: string;
}

export interface Worksheet {
  id: string;
  lesson: string;
  type: 'A' | 'W' | 'P' | 'R' | 'Q';
  title: string;
}

export const WORKSHEET_KIND: Record<Worksheet['type'], string> = {
  A: 'การทดลองจริง',
  W: 'ใช้คู่กับแล็บ',
  P: 'ฝึกทักษะ',
  R: 'เกณฑ์การประเมิน',
  Q: 'แบบทดสอบ',
};

/** Other files students use, kept in content/worksheets and published as they are (e.g. a CSV template). */
export const EXTRAS = [
  { lesson: 'U6C1-L6', file: 'U6C1-LOG-template.csv', title: 'แม่แบบบันทึกลมฟ้าอากาศโรงเรียน (CSV)', tag: 'เปิดด้วย Google Sheets หรือ Excel แล้วกรอกข้อมูล' },
];

/** A chapter test is kept from students until the teacher hands it out, so both its copies are teacher-only. */
export const studentMayHave = (w: Worksheet) => w.type !== 'Q';

export function decks(): Deck[] {
  return readdirSync(resolve(root, 'content/lessons'))
    .filter((f) => f.endsWith('.md'))
    .map((f) => {
      const head = readFileSync(resolve(root, 'content/lessons', f), 'utf8').match(/^---\n([\s\S]*?)\n---/);
      const meta = (head ? loadYaml(head[1]) : {}) as { id: string; deck?: number; deckTitle?: string };
      const title = readFileSync(resolve(root, 'content/lessons', f), 'utf8').match(/^## title \| (.+)$/m)?.[1] ?? meta.id;
      return { lesson: meta.id, file: `${meta.id}${meta.deck ? `-${meta.deck}` : ''}`, title: meta.deckTitle ?? title };
    })
    .sort((a, b) => a.file.localeCompare(b.file));
}

export function worksheets(): Worksheet[] {
  return readdirSync(resolve(root, 'content/worksheets'))
    .filter((f) => f.endsWith('.yaml'))
    .map((f) => {
      const y = loadYaml(readFileSync(resolve(root, 'content/worksheets', f), 'utf8')) as Worksheet;
      return { id: y.id, lesson: y.lesson, type: y.type, title: y.title };
    })
    .sort((a, b) => a.id.localeCompare(b.id));
}
