// Generates docs/verification-checklist.md from every `verified: false` entry in
// content/constants/*.json and content/curriculum.yaml. Run: npm run checklist
import { readFileSync, writeFileSync, readdirSync } from 'node:fs';
import { resolve, basename } from 'node:path';
import { fileURLToPath } from 'node:url';
import { load as loadYaml } from 'js-yaml';

const root = resolve(fileURLToPath(new URL('..', import.meta.url)));

export interface PendingItem {
  file: string;
  path: string;
  name: string;
  value: string;
  source: string;
  note?: string;
}

function describeValue(node: Record<string, unknown>): string {
  if ('value' in node) {
    const v = node.value;
    if (v === null) return '— ยังไม่มีค่า —';
    return `${typeof v === 'object' ? JSON.stringify(v) : String(v)}${node.unit ? ` ${node.unit}` : ''}`;
  }
  if (Array.isArray(node.items)) return `${node.items.length} รายการ`;
  if (Array.isArray(node.points)) return `${node.points.length} จุดข้อมูล`;
  if (Array.isArray(node.layers)) return `${node.layers.length} ชั้น`;
  return 'ดูในไฟล์';
}

export function collectPending(file: string, data: unknown, path: string[] = []): PendingItem[] {
  if (!data || typeof data !== 'object') return [];
  const node = data as Record<string, unknown>;
  const found: PendingItem[] = [];
  if (node.verified === false) {
    found.push({
      file,
      path: path.join('.'),
      name: String(node.name ?? path[path.length - 1] ?? ''),
      value: describeValue(node),
      source: String(node.source ?? ''),
      note: node.note ? String(node.note) : undefined,
    });
  }
  for (const [key, child] of Object.entries(node)) {
    if (key.startsWith('$') || Array.isArray(child)) continue;
    found.push(...collectPending(file, child, [...path, key]));
  }
  return found;
}

export function loadAllPending(): PendingItem[] {
  const dir = resolve(root, 'content/constants');
  const items: PendingItem[] = [];
  for (const f of readdirSync(dir).filter((n) => n.endsWith('.json')).sort()) {
    items.push(...collectPending(`constants/${f}`, JSON.parse(readFileSync(resolve(dir, f), 'utf8'))));
  }
  const curriculum = loadYaml(readFileSync(resolve(root, 'content/curriculum.yaml'), 'utf8'));
  items.push(...collectPending('curriculum.yaml', curriculum));
  return items;
}

function render(items: PendingItem[]): string {
  const lines = [
    '# รายการรอครูตรวจยืนยัน',
    '',
    '> ไฟล์นี้สร้างอัตโนมัติด้วย `npm run checklist` จากทุกค่าที่มี `verified: false` ห้ามแก้ไฟล์นี้โดยตรง',
    '> วิธียืนยัน: ครูบอกค่าที่ถูกต้องตามหนังสือเรียน แล้วแก้ค่าในไฟล์ constants เป็นค่านั้นพร้อมตั้ง `verified: true` และระบุ `source`',
    '',
    `รวม **${items.length}** รายการ`,
    '',
  ];
  const byFile = new Map<string, PendingItem[]>();
  for (const it of items) byFile.set(it.file, [...(byFile.get(it.file) ?? []), it]);
  for (const [file, list] of byFile) {
    lines.push(`## ${basename(file)}`, '', '| ✓ | รายการ | ค่าปัจจุบัน | แหล่ง | หมายเหตุ | ตำแหน่งในไฟล์ |', '|---|---|---|---|---|---|');
    for (const it of list) {
      lines.push(`| ☐ | ${it.name} | ${it.value} | ${it.source} | ${it.note ?? ''} | \`${it.path}\` |`);
    }
    lines.push('');
  }
  return lines.join('\n');
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const items = loadAllPending();
  writeFileSync(resolve(root, 'docs/verification-checklist.md'), render(items), 'utf8');
  console.log(`docs/verification-checklist.md: ${items.length} รายการรอตรวจ`);
}
