// Choices for the "บันทึกผล" dropdown (PLAN §4.2 step 1): the right reading plus readings students
// commonly get wrong — the previous row, one numbered mark (5 °C) off, one small tick (1 °C) off.

/** What a liquid-in-glass thermometer with 1 °C ticks reads: the nearest whole degree. */
export function thermometerReading(tC: number): number {
  return Math.round(tC);
}

/** Four distinct values in ascending order, exactly one of them `correct`. */
export function readingOptions(correct: number, previous?: number): number[] {
  const out = new Set([correct]);
  for (const v of [previous, correct - 5, correct + 5, correct + 1, correct - 1]) {
    if (out.size === 4) break;
    if (v !== undefined && v >= 0) out.add(v);
  }
  return [...out].sort((a, b) => a - b);
}
