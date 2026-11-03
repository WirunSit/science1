// Every calculation item in content/quiz must have its keyed answer equal to the physics function's result.
import { describe, expect, it } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';
import * as physics from '@shared/physics/heat';
import { heat, specificHeat, type SubstanceId } from '@shared/constants';
import { formatNumber } from '@shared/format';
import { thermometerReading } from '@shared/reading';
import * as particleBox from '../../apps/heat-lab/particle-box-model';
import * as expandIt from '../../apps/heat-lab/expand-it-model';
import * as phaseGraph from '../../apps/heat-lab/phase-graph-model';
import * as hts from '../../apps/heat-transfer-studio/answers';
import * as ws from '../../apps/weather-station/answers';
import * as sc from '../../apps/storm-climate/answers';

/** Stations whose questions quote observation cells: the cells (and right values) each lab accepts. */
const CELL_STATIONS: Record<string, () => Record<string, string>> = {
  ...Object.fromEntries(['conduction-rod', 'convection-pot', 'radiation-cans', 'thermal-mixer', 'cool-box']
    .map((id) => [`heat-transfer-studio/${id}`, () => hts.answerCells(id)])),
  ...Object.fromEntries(['atmosphere-elevator', 'sun-angle', 'wind-maker', 'humidity-box', 'cloud-lift', 'forecast-room']
    .map((id) => [`weather-station/${id}`, () => ws.answerCells(id)])),
  ...Object.fromEntries(['storm-builder', 'greenhouse-earth', 'my-footprint'].map((id) => [`storm-climate/${id}`, () => sc.answerCells(id)])),
  'heat-lab/particle-box': particleBox.answerCells,
  'heat-lab/expand-it': expandIt.answerCells,
  'heat-lab/phase-graph': phaseGraph.answerCells,
};

interface CellEvidence {
  cell: { table: string; row: string; col: string };
  expect: string;
}

const dir = resolve(__dirname, '../../content/quiz');
type Arg = number | { c: SubstanceId } | { L: keyof Omit<typeof heat.latentHeat, '$unit'> };
interface Evidence {
  preset: Record<string, number | string>;
  time: number;
  expect: { temp: number; q: number };
}
interface Item {
  id: string;
  station?: string;
  choices: string[];
  answer: number;
  indicator: string;
  calc?: { fn: keyof typeof physics; args: Arg[] };
  evidence?: Evidence | Evidence[];
}

const items: [string, Item][] = readdirSync(dir)
  .filter((f) => f.endsWith('.json'))
  .flatMap((f) => (JSON.parse(readFileSync(resolve(dir, f), 'utf8')).items as Item[]).map((it) => [f, it] as [string, Item]));

describe.each(items)('%s', (_file, item) => {
  it(`${item.id} is well-formed`, () => {
    expect(item.choices.length).toBe(4);
    expect(item.answer).toBeGreaterThanOrEqual(0);
    expect(item.answer).toBeLessThan(4);
    expect(item.indicator).toMatch(/^ว [23]\.[23] ม\.1\/\d$/);
  });

  if (item.station === 'heat-lab/heater-bench') {
    it(`${item.id} quotes values that the heater mission really produces`, () => {
      const list = item.evidence ? (Array.isArray(item.evidence) ? item.evidence : [item.evidence]) : [];
      expect(list.length).toBeGreaterThan(0);
      for (const ev of list) {
        const p = ev.preset as { substance: SubstanceId; mass: number; t0: number; power: number };
        const temp = physics.temperatureAfterHeating(p.t0, p.power, ev.time, p.mass, specificHeat(p.substance));
        // expect.temp is what the student reads off the 1 °C thermometer, i.e. the right dropdown choice.
        expect(thermometerReading(temp)).toBe(ev.expect.temp);
        expect(p.power * ev.time).toBe(ev.expect.q);
        // The table logs every 30 s, so the quoted time must be a row that exists.
        expect(ev.time % 30).toBe(0);
      }
    });
  }

  if (item.station && CELL_STATIONS[item.station]) {
    it(`${item.id} quotes cells that ${item.station} accepts`, () => {
      const list = item.evidence ? (Array.isArray(item.evidence) ? item.evidence : [item.evidence]) : [];
      expect(list.length).toBeGreaterThan(0);
      const cells = CELL_STATIONS[item.station!]();
      for (const ev of list as unknown as CellEvidence[]) {
        expect(cells[`${ev.cell.table}/${ev.cell.row}/${ev.cell.col}`]).toBe(ev.expect);
      }
    });
  }

  if (item.calc) {
    it(`${item.id} keyed answer matches ${item.calc.fn}`, () => {
      const args = item.calc!.args.map((a) => (typeof a === 'number' ? a : 'c' in a ? specificHeat(a.c) : heat.latentHeat[a.L].value));
      const fn = physics[item.calc!.fn] as (...a: number[]) => number;
      const value = fn(...args);
      expect(item.choices[item.answer].replace(/\s.*$/, '')).toBe(formatNumber(value, { sig: 3, sciAbove: 1e7 }));
    });
  }
});
