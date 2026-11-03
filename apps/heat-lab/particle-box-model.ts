// Particle Box data with no DOM, so unit tests can check the answers the lab accepts (PLAN §8.1, D-033).

/** Real examples, so each box is in that state across the whole 10–90 °C range of the lab. */
export const STATES = [
  { id: 'solid', name: 'ของแข็ง', example: 'เช่น โลหะ' },
  { id: 'liquid', name: 'ของเหลว', example: 'เช่น น้ำ' },
  { id: 'gas', name: 'แก๊ส', example: 'เช่น อากาศ' },
] as const;
export type StateId = (typeof STATES)[number]['id'];

/** Dropdown choices; the wrong ones are common misconceptions (PLAN §8.1). */
export const ARRANGEMENT = ['ชิดกัน เป็นระเบียบ', 'ชิดกัน ไม่เป็นระเบียบ', 'ห่างกันมาก'];
export const MOTION = ['อยู่นิ่ง', 'สั่นอยู่กับที่', 'เลื่อนผ่านกันได้', 'เคลื่อนที่อิสระ'];
export const CHANGE = ['เร็วขึ้น', 'ช้าลง', 'เท่าเดิม'];
export const SIZE = ['ใหญ่ขึ้น', 'เท่าเดิม', 'เล็กลง'];

/** Table 1: what each state looks like (row = state). */
export const STATE_ANSWERS: Record<StateId, { arrangement: string; motion: string }> = {
  solid: { arrangement: 'ชิดกัน เป็นระเบียบ', motion: 'สั่นอยู่กับที่' },
  liquid: { arrangement: 'ชิดกัน ไม่เป็นระเบียบ', motion: 'เลื่อนผ่านกันได้' },
  gas: { arrangement: 'ห่างกันมาก', motion: 'เคลื่อนที่อิสระ' },
};

/** Table 2 rows: start at room temperature, after heating, after cooling. */
export const TEMP_ROWS = [
  { id: 'start', name: 'ตอนเริ่ม' },
  { id: 'heated', name: 'ให้ความร้อน' },
  { id: 'cooled', name: 'ทำให้เย็นลง' },
] as const;
export type TempRowId = (typeof TEMP_ROWS)[number]['id'];
/** Particles compared with the start: faster when heated, slower when cooled; never a different size. */
export const TEMP_ANSWERS: Record<Exclude<TempRowId, 'start'>, { motion: string; size: string }> = {
  heated: { motion: 'เร็วขึ้น', size: 'เท่าเดิม' },
  cooled: { motion: 'ช้าลง', size: 'เท่าเดิม' },
};

export const T_START = 30;
export const T_MIN = 10;
export const T_MAX = 90;
export const T_STEP = 20;

/**
 * Speed factor drawn on screen. The real mean speed goes as √T (kelvin): only about 13 % faster at 90 °C
 * than at 10 °C, too little to see, so the picture spreads it from 1× to 3× (said in the model note, D-033).
 */
export function visualSpeed(tC: number): number {
  return 1 + (tC - T_MIN) / 40;
}

/** Every answer cell a quiz item may quote: "<table>/<row>/<column>" → the right value. */
export function answerCells(): Record<string, string> {
  const out: Record<string, string> = {};
  for (const s of STATES) {
    out[`states/${s.id}/arrangement`] = STATE_ANSWERS[s.id].arrangement;
    out[`states/${s.id}/motion`] = STATE_ANSWERS[s.id].motion;
  }
  for (const [row, a] of Object.entries(TEMP_ANSWERS)) {
    out[`temps/${row}/motion`] = a.motion;
    out[`temps/${row}/size`] = a.size;
  }
  return out;
}
