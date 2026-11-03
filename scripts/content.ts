// Shared loaders for build scripts (slides, worksheets): config, curriculum, lesson files,
// and resolution of {c:...} / {calc:...} placeholders against constants.
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { load as loadYaml } from 'js-yaml';
import QRCode from 'qrcode';
import * as heatPhysics from '../apps/shared/physics/heat';
import * as weatherPhysics from '../apps/shared/physics/weather';

/** Functions a {calc:...} placeholder may call. */
const physics = { ...heatPhysics, ...weatherPhysics };
import { climate, heat, specificHeat, weather, type SubstanceId } from '../apps/shared/constants';
import { formatNumber } from '../apps/shared/format';

export const root = resolve(fileURLToPath(new URL('..', import.meta.url)));

export interface Config {
  schoolName: string;
  teacherName: string;
  courseCode: string;
  courseName: string;
  academicYear: string;
  semester: number;
  baseUrl: string;
  slideFont: string;
  slideFontFallback: string;
  worksheetFont: string;
  worksheetFontSizePt: number;
}

export interface LessonInfo {
  id: string;
  title: string;
  hours: number;
  indicators: string[];
  clip: string | null;
  stations: string[];
  chapter: { id: string; title: string; app: string; appTitle: string };
  unit: { id: string; title: string };
}

export const config: Config = JSON.parse(readFileSync(resolve(root, 'config.json'), 'utf8'));

interface CurriculumYaml {
  indicators: { items: { id: string; text: string }[] };
  units: { id: string; title: string; chapters: (LessonInfo['chapter'] & { lessons: Omit<LessonInfo, 'chapter' | 'unit'>[] })[] }[];
}
export const curriculum = loadYaml(readFileSync(resolve(root, 'content/curriculum.yaml'), 'utf8')) as CurriculumYaml;

export function lessonInfo(id: string): LessonInfo {
  for (const unit of curriculum.units) {
    for (const ch of unit.chapters) {
      const l = ch.lessons.find((x) => x.id === id);
      if (l) return { ...l, chapter: ch, unit: { id: unit.id, title: unit.title } };
    }
  }
  throw new Error(`ไม่พบบทเรียน ${id} ใน curriculum.yaml`);
}

export function indicatorText(id: string): string {
  return curriculum.indicators.items.find((i) => i.id === id)?.text ?? '';
}

/** Public URL of a lab (optionally a station) on GitHub Pages. */
export function labUrl(app: string, station?: string): string {
  return `${config.baseUrl}${app}/${station ? `#${station}` : ''}`;
}

export async function qrPng(url: string): Promise<Buffer> {
  return QRCode.toBuffer(url, { margin: 1, width: 600, errorCorrectionLevel: 'M' });
}

function constArg(a: string): number {
  if (a.startsWith('c.')) return specificHeat(a.slice(2) as SubstanceId);
  // L.fusionWater / L.vaporizationWater: latent heats from content/constants/heat.json
  if (a.startsWith('L.')) {
    const e = (heat.latentHeat as Record<string, { value: number } | string>)[a.slice(2)];
    if (typeof e !== 'object') throw new Error(`ไม่รู้จักค่าความร้อนแฝง ${a}`);
    return e.value;
  }
  const n = Number(a);
  if (Number.isNaN(n)) throw new Error(`อาร์กิวเมนต์ไม่ถูกต้อง: ${a}`);
  return n;
}

/**
 * Replaces {c:water} with the textbook c value (with unit; {cv:water} without) and {calc:fn:arg:arg|unit} with a computed answer,
 * so no constant is ever typed into lesson text.
 */
export function resolvePlaceholders(text: string): string {
  return text
    .replace(/\{c:(\w+)\}/g, (_m, id: string) => `${formatNumber(specificHeat(id as SubstanceId))} J/(kg·°C)`)
    // {cv:water}: the bare number, for substituting into an equation ("Q = 0.5 × 4,200 × 60").
    .replace(/\{cv:(\w+)\}/g, (_m, id: string) => formatNumber(specificHeat(id as SubstanceId)))
    // {k:climate.co2Current}: any constant's value by its path in content/constants/<file>.json.
    .replace(/\{k:(heat|weather|climate)\.([\w.]+)\}/g, (_m, file: string, path: string) => {
      const v = path.split('.').reduce<unknown>((o, k) => (o as Record<string, unknown>)?.[k], ({ heat, weather, climate } as Record<string, unknown>)[file]);
      const value = (v as { value?: unknown })?.value ?? v;
      if (typeof value !== 'number') throw new Error(`ไม่พบค่าคงที่ ${file}.${path}`);
      return formatNumber(value, { sig: 6 });
    })
    .replace(/\{calc:([^}|]+)(?:\|([^}]*))?\}/g, (_m, expr: string, unit?: string) => {
      const [fn, ...args] = expr.split(':');
      const f = physics[fn as keyof typeof physics] as ((...a: number[]) => number) | undefined;
      if (!f) throw new Error(`ไม่รู้จักฟังก์ชัน ${fn}`);
      const v = f(...args.map(constArg));
      // Whole numbers stay whole; anything else is rounded to one decimal place, as students would write it.
      const whole = Math.abs(v - Math.round(v)) < 1e-9;
      return `${whole ? formatNumber(v, { sig: 6 }) : formatNumber(Math.round(v * 10) / 10, { sig: 6 })}${unit ? ` ${unit}` : ''}`;
    });
}

export type SlideKind = 'title' | 'objectives' | 'engage' | 'explore' | 'explain' | 'example' | 'elaborate' | 'check' | 'summary' | 'evaluate';

export interface SlideSpec {
  kind: SlideKind;
  title: string;
  bullets: string[];
  choices: string[];
  diagram?: string;
  qr?: 'lab' | 'clip';
  equation?: string;
  safety?: string;
  notes: string;
}

export interface LessonDoc {
  meta: Record<string, string | number | boolean>;
  slides: SlideSpec[];
}

export function loadLesson(file: string): LessonDoc {
  const raw = readFileSync(resolve(root, 'content/lessons', file), 'utf8').replace(/\r\n/g, '\n');
  const fm = raw.match(/^---\n([\s\S]*?)\n---\n/);
  const meta = fm ? (loadYaml(fm[1]) as LessonDoc['meta']) : {};
  const body = (fm ? raw.slice(fm[0].length) : raw).replace(/<!--[\s\S]*?-->/g, '');
  const slides: SlideSpec[] = [];
  for (const chunk of body.split(/^## /m).slice(1)) {
    const [head, ...lines] = chunk.split('\n');
    const [kind, title = ''] = head.split('|').map((x) => x.trim());
    const spec: SlideSpec = { kind: kind as SlideKind, title: resolvePlaceholders(title), bullets: [], choices: [], notes: '' };
    let inNotes = false;
    for (const line of lines) {
      if (inNotes) { spec.notes += `${line}\n`; continue; }
      const m = line.match(/^(diagram|qr|equation|safety|choice):\s*(.*)$/);
      if (line.startsWith('Notes:')) { inNotes = true; spec.notes = line.slice(6).trim() ? `${line.slice(6).trim()}\n` : ''; }
      else if (line.startsWith('- ')) spec.bullets.push(resolvePlaceholders(line.slice(2)));
      else if (m) {
        const [, key, value] = m;
        if (key === 'choice') spec.choices.push(resolvePlaceholders(value));
        else (spec as unknown as Record<string, string>)[key] = resolvePlaceholders(value);
      }
    }
    spec.notes = resolvePlaceholders(spec.notes.trim());
    slides.push(spec);
  }
  return { meta, slides };
}
