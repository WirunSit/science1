// Synthetic weather maps for Forecast Room and Wind Maker (PLAN §10.6): drawn here, never copied from the
// Thai Meteorological Department. Pressure is a smooth field (a base value plus bumps for each system),
// so isobars are its contour lines and can never cross; H and L sit where the field really peaks.

export interface PressureSystem {
  kind: 'H' | 'L';
  lon: number;
  lat: number;
  /** hPa above (H) or below (L) the base value at the centre. */
  amount: number;
  /** Spread in degrees, east–west and north–south. */
  spreadLon: number;
  spreadLat: number;
  /** Draw the letter here instead (a system whose centre is off the map). */
  labelAt?: { lon: number; lat: number };
}

export interface Scenario {
  id: string;
  name: string;
  month: string;
  base: number;
  /** Isobar spacing, hPa. */
  step: number;
  systems: PressureSystem[];
  pin: { lon: number; lat: number; name: string };
  forecast: string;
  storm?: { lon: number; lat: number; name: string };
}

/** Four situations from PLAN §10.6; the storm's name is made up. */
export const SCENARIOS: Scenario[] = [
  {
    id: 's1', name: 'แผนที่ 1', month: 'เดือนธันวาคม', base: 1010, step: 2, forecast: 'อากาศเย็น ท้องฟ้าโปร่ง',
    systems: [{ kind: 'H', lon: 108, lat: 28, amount: 18, spreadLon: 9, spreadLat: 7, labelAt: { lon: 106, lat: 23 } }],
    pin: { lon: 99.0, lat: 18.8, name: 'ภาคเหนือ' },
  },
  {
    id: 's2', name: 'แผนที่ 2', month: 'เดือนสิงหาคม', base: 1008, step: 2, forecast: 'ฝนตกชุกเกือบทั่วไป',
    systems: [
      { kind: 'L', lon: 102, lat: 16.5, amount: 6, spreadLon: 12, spreadLat: 1.8 },
      { kind: 'H', lon: 92, lat: 2, amount: 8, spreadLon: 8, spreadLat: 6, labelAt: { lon: 95.5, lat: 5.5 } },
    ],
    pin: { lon: 102.8, lat: 16.4, name: 'ภาคตะวันออกเฉียงเหนือ' },
  },
  {
    id: 's3', name: 'แผนที่ 3', month: 'เดือนตุลาคม', base: 1008, step: 4, forecast: 'ฝนตกหนักมาก ลมแรง',
    systems: [{ kind: 'L', lon: 106.5, lat: 15, amount: 26, spreadLon: 1.6, spreadLat: 1.6 }],
    pin: { lon: 104.9, lat: 15.2, name: 'ภาคตะวันออกเฉียงเหนือตอนล่าง' },
    storm: { lon: 106.5, lat: 15, name: 'พายุสมมติ "ฟ้าใส"' },
  },
  {
    id: 's4', name: 'แผนที่ 4', month: 'เดือนเมษายน', base: 1008, step: 2, forecast: 'อากาศร้อนอบอ้าว อาจมีพายุฤดูร้อน',
    systems: [{ kind: 'L', lon: 101, lat: 16, amount: 6, spreadLon: 4, spreadLat: 4 }],
    pin: { lon: 100.1, lat: 15.7, name: 'ภาคกลางตอนบน' },
  },
];

export function pressureAt(s: Scenario, lon: number, lat: number): number {
  let p = s.base;
  for (const sys of s.systems) {
    const g = Math.exp(-(((lon - sys.lon) / sys.spreadLon) ** 2 + ((lat - sys.lat) / sys.spreadLat) ** 2) / 2);
    p += (sys.kind === 'H' ? 1 : -1) * sys.amount * g;
  }
  return p;
}

// ── Map frame: longitude 94–110 °E, latitude 4–24 °N ───────
export const MAP = { lon0: 94, lon1: 110, lat0: 4, lat1: 24, scale: 18 };
export const MAP_W = (MAP.lon1 - MAP.lon0) * MAP.scale;
export const MAP_H = (MAP.lat1 - MAP.lat0) * MAP.scale;
export const px = (lon: number) => (lon - MAP.lon0) * MAP.scale;
export const py = (lat: number) => (MAP.lat1 - lat) * MAP.scale;

/** A rough outline of Thailand (simplified by hand from longitude/latitude; not an official map). */
export const THAILAND: [number, number][] = [
  [99.9, 20.4], [99.0, 19.9], [98.0, 19.7], [97.4, 18.5], [97.8, 17.5], [98.6, 16.3], [98.2, 15.2], [99.2, 13.8],
  [99.1, 12.0], [98.6, 10.2], [98.3, 8.9], [98.6, 7.8], [99.4, 7.2], [99.8, 6.5], [100.3, 6.5], [101.1, 6.2], [102.1, 6.2],
  [101.3, 6.9], [100.4, 7.6], [100.0, 8.5], [99.9, 9.3], [99.2, 10.3], [99.6, 11.8], [99.95, 12.6], [100.0, 13.4],
  [100.5, 13.5], [100.9, 13.4], [100.9, 12.7], [101.5, 12.6], [102.3, 12.2], [102.6, 12.0], [102.9, 11.6], [102.4, 13.6],
  [103.0, 14.3], [104.5, 14.4], [105.2, 14.3], [105.6, 15.5], [105.4, 16.0], [104.8, 17.0], [104.7, 17.5], [103.9, 18.3],
  [102.6, 17.9], [101.2, 17.6], [101.0, 18.2], [101.2, 19.5], [100.5, 19.6], [100.5, 20.3],
];
export const SEA_LABELS = [
  { text: 'อ่าวไทย', lon: 101.3, lat: 10.3 },
  { text: 'ทะเลอันดามัน', lon: 96.2, lat: 11 },
  { text: 'ทะเลจีนใต้', lon: 108, lat: 12.5 },
  { text: 'จีน', lon: 104, lat: 23 },
];

/**
 * Isobars: contour lines of the pressure field at every `step` hPa, by marching squares on a grid.
 * Each returned line is a list of short segments in map pixels.
 */
export function isobars(s: Scenario, cells = 48): { value: number; segments: [number, number, number, number][] }[] {
  const nx = cells;
  const ny = Math.round((cells * MAP_H) / MAP_W);
  const lonAt = (i: number) => MAP.lon0 + ((MAP.lon1 - MAP.lon0) * i) / nx;
  const latAt = (j: number) => MAP.lat1 - ((MAP.lat1 - MAP.lat0) * j) / ny;
  const grid: number[][] = [];
  let lo = Infinity;
  let hi = -Infinity;
  for (let j = 0; j <= ny; j++) {
    grid.push([]);
    for (let i = 0; i <= nx; i++) {
      const p = pressureAt(s, lonAt(i), latAt(j));
      grid[j].push(p);
      lo = Math.min(lo, p);
      hi = Math.max(hi, p);
    }
  }
  const out: { value: number; segments: [number, number, number, number][] }[] = [];
  for (let v = Math.ceil(lo / s.step) * s.step; v <= hi; v += s.step) {
    const segments: [number, number, number, number][] = [];
    const cross = (a: number, b: number) => (v - a) / (b - a);
    for (let j = 0; j < ny; j++) {
      for (let i = 0; i < nx; i++) {
        const c = [grid[j][i], grid[j][i + 1], grid[j + 1][i + 1], grid[j + 1][i]];
        const pts: [number, number][] = [];
        const edge = (k: number) => {
          const a = c[k];
          const b = c[(k + 1) % 4];
          if ((a < v) === (b < v)) return;
          const f = cross(a, b);
          const corners: [number, number][] = [[i, j], [i + 1, j], [i + 1, j + 1], [i, j + 1]];
          const [x0, y0] = corners[k];
          const [x1, y1] = corners[(k + 1) % 4];
          pts.push([((x0 + (x1 - x0) * f) * MAP_W) / nx, ((y0 + (y1 - y0) * f) * MAP_H) / ny]);
        };
        for (let k = 0; k < 4; k++) edge(k);
        if (pts.length >= 2) segments.push([pts[0][0], pts[0][1], pts[1][0], pts[1][1]]);
        if (pts.length === 4) segments.push([pts[2][0], pts[2][1], pts[3][0], pts[3][1]]);
      }
    }
    if (segments.length) out.push({ value: v, segments });
  }
  return out;
}

/** Surface wind at a point (PLAN §10.3: drawn straight from high to low, ม.1 level): east and north parts, hPa per degree. */
export function windAt(s: Scenario, lon: number, lat: number): [number, number] {
  const d = 0.05;
  const dx = (pressureAt(s, lon + d, lat) - pressureAt(s, lon - d, lat)) / (2 * d);
  const dy = (pressureAt(s, lon, lat + d) - pressureAt(s, lon, lat - d)) / (2 * d);
  return [-dx, -dy];
}
