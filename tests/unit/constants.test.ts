// Content lint for constants: every leaf value has a source and a verified flag.
import { describe, expect, it } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { collectPending } from '../../scripts/build-checklist';

const dir = resolve(__dirname, '../../content/constants');
const files = readdirSync(dir).filter((f) => f.endsWith('.json'));

function leaves(node: unknown, path: string[] = []): { path: string; node: Record<string, unknown> }[] {
  if (!node || typeof node !== 'object' || Array.isArray(node)) return [];
  const obj = node as Record<string, unknown>;
  if ('value' in obj || 'verified' in obj) return [{ path: path.join('.'), node: obj }];
  return Object.entries(obj)
    .filter(([k]) => !k.startsWith('$'))
    .flatMap(([k, v]) => leaves(v, [...path, k]));
}

describe.each(files)('%s', (file) => {
  const data = JSON.parse(readFileSync(resolve(dir, file), 'utf8'));
  const entries = leaves(data);

  it('has entries', () => {
    expect(entries.length).toBeGreaterThan(0);
  });

  it.each(entries.map((e) => [e.path, e.node] as const))('%s has source and verified flag', (_path, node) => {
    expect(typeof node.verified).toBe('boolean');
    expect(String(node.source ?? '')).not.toBe('');
  });
});

describe('teacher-confirmed values (2 Nov 2026)', () => {
  const heat = JSON.parse(readFileSync(resolve(dir, 'heat.json'), 'utf8'));

  it('c of water is 4200 and verified', () => {
    expect(heat.specificHeat.water).toMatchObject({ value: 4200, verified: true });
  });

  it('Kelvin offset is 273 and verified', () => {
    expect(heat.temperatureConversion.kelvinOffset).toMatchObject({ value: 273, verified: true });
  });

  it('checklist does not list confirmed values', () => {
    const paths = collectPending('heat.json', heat).map((p) => p.path);
    expect(paths).not.toContain('specificHeat.water');
    expect(paths).toContain('latentHeat.fusionWater');
  });
});
