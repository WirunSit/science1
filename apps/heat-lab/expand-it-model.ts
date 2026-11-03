// Expand It data with no DOM, so unit tests can check the answers the lab accepts (PLAN §8.3, D-041).
import { heat } from '@shared/constants';

export type Scene = 'ball' | 'bimetal' | 'gap' | 'liquid' | 'gas';
export type Temp = 'hot' | 'cold';

/** The bimetal strip: brass on top, steel underneath. */
export const BIMETAL = { top: 'ทองเหลือง', bottom: 'เหล็ก' };

/**
 * Which way the strip bends when hot: the metal that expands more ends up on the outside of the curve,
 * so the strip bends toward the other metal. Taken from the expansion constants, never assumed.
 */
export function bimetalBendsToward(t: Temp): string {
  const topMore = heat.linearExpansion.brass.value > heat.linearExpansion.steel.value;
  const towardBottom = t === 'hot' ? topMore : !topMore;
  return towardBottom ? BIMETAL.bottom : BIMETAL.top;
}

export const ROWS: { scene: Scene; name: string; choices: string[]; answer: Record<Temp, string> }[] = [
  { scene: 'ball', name: 'ลูกโลหะกับห่วง', choices: ['ลอดได้', 'ลอดไม่ได้'], answer: { hot: 'ลอดไม่ได้', cold: 'ลอดได้' } },
  {
    scene: 'bimetal', name: 'แถบโลหะคู่',
    choices: [`โค้งไปทาง${BIMETAL.bottom}`, `โค้งไปทาง${BIMETAL.top}`, 'ไม่โค้ง'],
    answer: { hot: `โค้งไปทาง${bimetalBendsToward('hot')}`, cold: `โค้งไปทาง${bimetalBendsToward('cold')}` },
  },
  { scene: 'gap', name: 'ช่องว่างที่รอยต่อราง', choices: ['แคบลง', 'กว้างขึ้น', 'เท่าเดิม'], answer: { hot: 'แคบลง', cold: 'กว้างขึ้น' } },
  { scene: 'liquid', name: 'ระดับน้ำสีในหลอดแก้ว', choices: ['สูงขึ้น', 'ต่ำลง', 'เท่าเดิม'], answer: { hot: 'สูงขึ้น', cold: 'ต่ำลง' } },
  { scene: 'gas', name: 'ลูกโป่งบนปากขวด', choices: ['พองขึ้น', 'แฟบลง', 'เท่าเดิม'], answer: { hot: 'พองขึ้น', cold: 'แฟบลง' } },
];

export const TEMPS: { id: Temp; name: string }[] = [
  { id: 'hot', name: 'เมื่อร้อนขึ้น' },
  { id: 'cold', name: 'เมื่อเย็นลง' },
];

/** Every answer cell a quiz item may quote: "obs/<scene>/<hot|cold>" → the right value. */
export function answerCells(): Record<string, string> {
  const out: Record<string, string> = {};
  for (const r of ROWS) for (const t of TEMPS) out[`obs/${r.scene}/${t.id}`] = r.answer[t.id];
  return out;
}
