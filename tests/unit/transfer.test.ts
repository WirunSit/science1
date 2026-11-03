// Heat transfer models (PLAN §9.1, §9.2, §9.4 acceptance criteria).
import { describe, expect, it } from 'vitest';
import { boxHeatIn, canRate, makeRod, meltMinutes, rodTempAt, stepRod, wallResistance, type RodMaterial } from '@shared/physics/transfer';
import { heat } from '@shared/constants';

const WAX = [0.03, 0.06, 0.09, 0.12, 0.15];
function firstDrop(m: RodMaterial): number {
  const rod = makeRod(m, 30);
  for (let s = 1; s <= 600; s++) {
    stepRod(rod, 1, heat.phasePoints.waterBoiling.value, 30);
    if (rodTempAt(rod, WAX[0]) >= heat.phasePoints.waxDrop.value) return s;
  }
  return Infinity;
}

describe('Conduction Rod (PLAN §9.1)', () => {
  it('first wax drops in the order copper < aluminium < iron < stainless steel', () => {
    const t = (['copper', 'aluminium', 'iron', 'stainlessSteel'] as RodMaterial[]).map(firstDrop);
    expect(t.every((x, i) => i === 0 || x > t[i - 1])).toBe(true);
    expect(t.every(Number.isFinite)).toBe(true);
  });
  it('glass and wood drop no wax within 10 minutes', () => {
    expect(firstDrop('glass')).toBe(Infinity);
    expect(firstDrop('wood')).toBe(Infinity);
  });
  it('the hot end stays at the source temperature and nothing gets hotter than it', () => {
    const rod = makeRod('copper', 30);
    stepRod(rod, 300, 100, 30);
    expect(rod.t[0]).toBe(100);
    expect(Math.max(...rod.t)).toBeLessThanOrEqual(100);
  });
});

describe('Radiation Cans (PLAN §9.2)', () => {
  const surfaces = ['matteBlack', 'red', 'white', 'polishedSilver'] as const;
  const run = (i: number, t0: number, irradiance: number) => {
    let t = t0;
    const x = surfaces[i];
    for (let s = 0; s < 600; s++) t += canRate(t, heat.absorptivity[x].value, heat.emissivity[x].value, irradiance, 30);
    return t;
  };
  it('under the lamp: black > red > white > silver', () => {
    const t = surfaces.map((_, i) => run(i, 30, 600));
    expect(t[0] > t[1] && t[1] > t[2] && t[2] > t[3]).toBe(true);
  });
  it('hot water, lamp off: painted cans cool about alike, polished silver clearly slowest', () => {
    const drop = surfaces.map((_, i) => 80 - run(i, 80, 0));
    expect(Math.max(...drop.slice(0, 3)) - Math.min(...drop.slice(0, 3))).toBeLessThan(1);
    expect(Math.min(...drop.slice(0, 3)) - drop[3]).toBeGreaterThan(2);
  });
});

describe('Cool Box (PLAN §9.4)', () => {
  const minutes = (layers: Parameters<typeof wallResistance>[0], abs = 0.6, sun = true) => meltMinutes(boxHeatIn(wallResistance(layers), 32, 0, abs, sun));
  const card = { material: 'cardboard' as const, thickness: 0.005 };
  it('thicker foam keeps ice longer', () => {
    expect(minutes([card, { material: 'eps', thickness: 0.04 }])).toBeGreaterThan(minutes([card, { material: 'eps', thickness: 0.02 }]));
  });
  it('a closed air gap helps', () => {
    expect(minutes([card, { material: 'stillAir', thickness: 0.01 }])).toBeGreaterThan(minutes([card]));
  });
  it('foil (low absorptivity) helps a lot in the sun', () => {
    const plain = minutes([card], 0.6);
    const foil = minutes([card], heat.absorptivity.polishedSilver.value);
    expect(foil / plain).toBeGreaterThan(1.3);
  });
  it('one layer of cardboard is worse than 2 cm of foam', () => {
    expect(minutes([card])).toBeLessThan(minutes([{ material: 'eps', thickness: 0.02 }]));
  });
});
