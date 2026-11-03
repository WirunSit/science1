// Number display rules from PLAN §4.6: thousands separators, sensible significant figures,
// very large/small numbers as "2.26 × 10⁶".

const SUPERSCRIPT: Record<string, string> = {
  '-': '⁻', '0': '⁰', '1': '¹', '2': '²', '3': '³', '4': '⁴', '5': '⁵', '6': '⁶', '7': '⁷', '8': '⁸', '9': '⁹',
};

export function superscript(n: number | string): string {
  return String(n).split('').map((ch) => SUPERSCRIPT[ch] ?? ch).join('');
}

/** Round to `sig` significant figures (returns a number). */
export function roundSig(x: number, sig = 4): number {
  if (x === 0 || !Number.isFinite(x)) return x;
  const p = sig - 1 - Math.floor(Math.log10(Math.abs(x)));
  const f = 10 ** p;
  return Math.round(x * f) / f;
}

export interface FormatOptions {
  /** Significant figures (default 4). Ignored when `decimals` is set. */
  sig?: number;
  /** Fixed number of decimals. */
  decimals?: number;
  /** Switch to scientific notation at or above this magnitude (default 1e6). */
  sciAbove?: number;
  /** Switch to scientific notation below this magnitude (default 1e-3). */
  sciBelow?: number;
}

/** Format for display with Thai/English thousands separators, e.g. 125,580 or 2.26 × 10⁶. */
export function formatNumber(x: number, opts: FormatOptions = {}): string {
  if (!Number.isFinite(x)) return '–';
  const { sig = 4, decimals, sciAbove = 1e6, sciBelow = 1e-3 } = opts;
  const abs = Math.abs(x);
  if (abs !== 0 && (abs >= sciAbove || abs < sciBelow)) {
    const exp = Math.floor(Math.log10(abs));
    const mantissa = roundSig(x / 10 ** exp, Math.min(sig, 3));
    return `${trimZeros(mantissa.toString())} × 10${superscript(exp)}`;
  }
  const v = decimals !== undefined ? x : roundSig(x, sig);
  const formatted = v.toLocaleString('en-US', {
    minimumFractionDigits: decimals ?? 0,
    maximumFractionDigits: decimals ?? 10,
  });
  // Negative numbers use the true minus sign.
  return formatted.replace(/^-/, '−');
}

function trimZeros(s: string): string {
  return s.includes('.') ? s.replace(/\.?0+$/, '') : s;
}

/** Number + unit separated by a thin no-break space, e.g. "125,580 J". */
export function withUnit(x: number, unit: string, opts?: FormatOptions): string {
  return unit ? `${formatNumber(x, opts)} ${unit}` : formatNumber(x, opts);
}

/** Mass shown both ways as in PLAN §8.2: "0.25 kg (250 g)". */
export function formatMass(kg: number): string {
  return `${formatNumber(kg, { sig: 3 })} kg (${formatNumber(kg * 1000, { sig: 4 })} g)`;
}
