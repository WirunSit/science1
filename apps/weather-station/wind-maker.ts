// Weather Station station 3 — Wind Maker (PLAN §10.3): (A) a coast at 14:00 and at 04:00 — land and sea
// temperatures from the same surface model as Sun Angle, the warmer side gets low pressure, air rises there
// and the surface wind blows towards it; (B) a blank map with H and L, isobars, wind arrows and a wind vane.
import { formatNumber, h, mountStation, s, type QuizItem, type StationAsk } from '@shared/index';
import quiz from '@content/quiz/U6C1-L3.json';
import { COAST_HOURS, MAP_ROWS, NAME_CHOICES, WHERE_CHOICES, WIND_CHOICES, coastAnswers, coastTemps, type Time } from './answers';
import { MAP_H, MAP_W, isobars, px, py, windAt, type Scenario } from './weather-map';

export const WIND_MAKER = { id: 'wind-maker', title: 'ความกดอากาศและลม', lesson: 'U6C1-L3' };
const SPEED = Number(new URLSearchParams(location.search).get('speed')) || 1;
const SHOW = 3; // seconds the picture takes to settle
const TIMES: Time[] = ['day', 'night'];
const TIME_NAME: Record<Time, string> = { day: 'กลางวัน (14:00 น.)', night: 'กลางคืน (04:00 น.)' };
const COAST_COLS = [
  { key: 'warmer', label: 'พื้นที่ร้อนกว่า', choices: WHERE_CHOICES },
  { key: 'low', label: 'ความกดอากาศต่ำ (L) อยู่เหนือ', choices: WHERE_CHOICES },
  { key: 'wind', label: 'ลมผิวพื้นพัด', choices: WIND_CHOICES },
  { key: 'name', label: 'ชื่อลม', choices: NAME_CHOICES },
] as const;
/** Blank map for scene B: one high and one low, closer isobars on the low's side. */
const MAP: Scenario = {
  id: 'blank', name: '', month: '', base: 1008, step: 2, forecast: '', pin: { lon: 0, lat: 0, name: '' },
  systems: [
    { kind: 'H', lon: 98, lat: 15, amount: 10, spreadLon: 4, spreadLat: 5 },
    { kind: 'L', lon: 106, lat: 13, amount: 10, spreadLon: 2.4, spreadLat: 2.6 },
  ],
};

export function mountWindMaker(root: HTMLElement, lab: string, home: string): void {
  mountStation<{ shown: number }>({
    ...WIND_MAKER,
    storeKey: 'ws:wind-maker:v1',
    quiz: quiz.items as unknown as QuizItem[],
    modelNote: 'อุณหภูมิพื้นดินและพื้นน้ำคิดจากแบบจำลองเดียวกับการทดลองอุณหภูมิอากาศ (น้ำมีความจุความร้อนสูงและผสมกันลึก จึงร้อนช้าเย็นช้า) ในแผนที่ ลูกศรลมชี้จากความกดอากาศสูงไปต่ำตรง ๆ ตามระดับ ม.1 ของจริงลมจะเบี่ยงไปเพราะการหมุนของโลก',
    tables: [
      { key: 'coast', caption: 'ฉาก 1 ชายฝั่ง', rowHead: 'เวลา', rows: TIMES.map((id) => ({ id, name: TIME_NAME[id] })), columns: COAST_COLS.map((c) => ({ key: c.key, label: c.label })) },
      { key: 'map', caption: 'ฉาก 2 แผนที่ความกดอากาศ', rowHead: 'สิ่งที่สังเกต', rows: MAP_ROWS.map((r) => ({ id: r.id, name: r.name })), columns: [{ key: 'value', label: 'ผล' }] },
    ],
    initial: () => ({ shown: 0 }),
    build(ctx) {
      let running = false;
      let t = 0;
      const title = h('p', { className: 'scene-title' });
      const svg = s('svg', { viewBox: '0 0 340 210', class: 'scene-svg', role: 'img' });
      const btn = h('button', { type: 'button', className: 'btn warn small', onclick: () => { running = true; t = 0; ctx.refresh(); } });
      const clock = h('p', { className: 'clock' });
      const bench = h('section', { className: 'bench xbench', 'aria-label': 'โต๊ะทดลอง' }, title, h('div', { className: 'scene-stage' }, svg), h('div', { className: 'bench-controls' }, btn, clock));
      const coastDone = (time: Time) => COAST_COLS.every((c) => ctx.has('coast', time, c.key));
      // 0 = nothing shown yet, 1 = day shown, 2 = night shown, 3 = map shown.
      const showing = () => Math.min(ctx.st.shown, 3);
      const next = () => (ctx.st.shown === 0 ? 1 : ctx.st.shown === 1 && coastDone('day') ? 2 : ctx.st.shown === 2 && coastDone('night') ? 3 : 0);

      const asks: StationAsk[] = [
        ...TIMES.flatMap((time, ti) => COAST_COLS.map((c): StationAsk => ({
          table: 'coast', row: time, col: c.key, label: `${c.label} ${TIME_NAME[time]}`,
          choices: () => [...c.choices], answer: () => coastAnswers(time)[c.key], ready: () => ctx.st.shown === ti + 1 && !running,
          todo: c.key === 'warmer' ? `${TIME_NAME[time]}: ดูเทอร์โมมิเตอร์ พื้นดินหรือพื้นน้ำร้อนกว่า เลือกในตาราง`
            : c.key === 'low' ? 'อากาศเหนือพื้นที่ร้อนกว่าลอยตัวขึ้น ความกดอากาศต่ำ (L) อยู่เหนือพื้นใด'
              : c.key === 'wind' ? 'ดูลูกศรลมที่ผิวพื้นและธงบนชายหาด ลมพัดไปทางใด' : 'ลมนี้เรียกว่าอะไร เลือกในตาราง',
          wait: () => (running ? 'กำลังเปลี่ยนเวลา… ดูอุณหภูมิ ลูกศร และธง' : `กด "${btn.textContent}"`),
          waitCue: () => (running ? null : btn),
        }))),
        ...MAP_ROWS.map((r): StationAsk => ({
          table: 'map', row: r.id, col: 'value', label: r.name,
          choices: () => r.choices, answer: () => r.answer, ready: () => ctx.st.shown === 3 && !running,
          todo: r.id === 'flow' ? 'ดูลูกศรลมบนแผนที่: ลมพัดจากความกดอากาศใดไปความกดอากาศใด'
            : r.id === 'isobar' ? 'ดูไอโซบาร์ (เส้นความกดอากาศเท่า) ด้าน L ที่เส้นชิดกัน ลูกศรลมยาวกว่าหรือสั้นกว่า'
              : 'ดูศรลมมุมล่างซ้าย ลมพัดจาก H มาทางขวา หัวลูกศรของศรลมชี้ไปทางใด',
          wait: () => (running ? 'กำลังวาดแผนที่…' : `กด "${btn.textContent}"`),
          waitCue: () => (running ? null : btn),
        })),
      ];

      function coast(time: Time, f: number): SVGElement[] {
        const temps = coastTemps(time);
        const a = coastAnswers(time);
        const landWarm = a.warmer === WHERE_CHOICES[0];
        const parts: SVGElement[] = [
          s('rect', { x: 0, y: 0, width: 340, height: 150, fill: time === 'day' ? '#dbeef6' : '#2b3a55' }),
          s('rect', { x: 0, y: 150, width: 170, height: 60, fill: '#b99a6b' }),
          s('rect', { x: 170, y: 150, width: 170, height: 60, fill: '#4f8fb8' }),
          s('text', { x: 85, y: 200, 'text-anchor': 'middle', 'font-size': 13, fill: '#1f2a2e', 'font-weight': 600 }, 'พื้นดิน'),
          s('text', { x: 255, y: 200, 'text-anchor': 'middle', 'font-size': 13, fill: '#fff', 'font-weight': 600 }, 'ทะเล'),
          time === 'day' ? s('circle', { cx: 300, cy: 24, r: 14, fill: '#f4d35e' }) : s('circle', { cx: 300, cy: 24, r: 10, fill: '#e8e4d8' }),
        ];
        // Thermometer readings.
        const box = (x: number, v: number) => [
          s('rect', { x: x - 30, y: 156, width: 60, height: 20, rx: 4, fill: 'var(--card)', stroke: 'var(--ink-2)' }),
          s('text', { x, y: 171, 'text-anchor': 'middle', 'font-size': 13, 'font-weight': 600, fill: 'var(--ink)' }, `${formatNumber(v, { decimals: 0 })} °C`),
        ];
        parts.push(...box(85, temps.land), ...box(255, temps.sea));
        if (f > 0) {
          const op = Math.min(1, f);
          const warmX = landWarm ? 85 : 255;
          const coolX = landWarm ? 255 : 85;
          const ink = time === 'day' ? '#1f2a2e' : '#f3efe5';
          parts.push(s('text', { x: warmX, y: 120, 'text-anchor': 'middle', 'font-size': 22, 'font-weight': 700, fill: '#b4441c', opacity: op }, 'L'));
          parts.push(s('text', { x: coolX, y: 120, 'text-anchor': 'middle', 'font-size': 22, 'font-weight': 700, fill: '#0e6b70', opacity: op }, 'H'));
          // Circulation: up over the warm side, back along the top, down over the cool side, along the surface.
          const dir = landWarm ? -1 : 1; // surface wind direction in x (−1 = towards land)
          const arrow = (x1: number, y1: number, x2: number, y2: number) => {
            const ang = Math.atan2(y2 - y1, x2 - x1);
            return [
              s('line', { x1, y1, x2, y2, stroke: ink, 'stroke-width': 2.5, opacity: op }),
              s('polygon', { points: `${x2},${y2} ${x2 - 9 * Math.cos(ang - 0.4)},${y2 - 9 * Math.sin(ang - 0.4)} ${x2 - 9 * Math.cos(ang + 0.4)},${y2 - 9 * Math.sin(ang + 0.4)}`, fill: ink, opacity: op }),
            ];
          };
          parts.push(...arrow(warmX, 100, warmX, 50));
          parts.push(...arrow(warmX, 40, coolX, 40));
          parts.push(...arrow(coolX, 50, coolX, 100));
          parts.push(...arrow(170 - dir * 70, 138, 170 + dir * 70, 138));
          // Beach flag blows the way the wind goes.
          parts.push(s('line', { x1: 170, y1: 150, x2: 170, y2: 108, stroke: ink, 'stroke-width': 2 }));
          parts.push(s('polygon', { points: `170,108 ${170 + dir * 26},114 170,120`, fill: '#b4441c' }));
        }
        return parts;
      }

      function map(f: number): SVGElement[] {
        const sx = 340 / MAP_W;
        const sy = 210 / MAP_H;
        const parts: SVGElement[] = [s('rect', { x: 0, y: 0, width: 340, height: 210, fill: 'var(--card)' })];
        for (const iso of isobars(MAP, 40)) {
          for (const [x1, y1, x2, y2] of iso.segments) parts.push(s('line', { x1: x1 * sx, y1: y1 * sy, x2: x2 * sx, y2: y2 * sy, stroke: 'var(--ink-2)', 'stroke-width': 1, opacity: f }));
        }
        for (const sys of MAP.systems) {
          parts.push(s('text', { x: px(sys.lon) * sx, y: py(sys.lat) * sy + 8, 'text-anchor': 'middle', 'font-size': 22, 'font-weight': 700, fill: sys.kind === 'H' ? '#0e6b70' : '#b4441c' }, sys.kind));
        }
        // Wind arrows between the two systems; longer where the isobars are closer.
        if (f >= 1) {
          for (const [lon, lat] of [[100.5, 14.5], [102.5, 14], [104.3, 13.4], [101.5, 16.5], [103.5, 11.5]]) {
            const [u, v] = windAt(MAP, lon, lat);
            const len = Math.min(34, 10 + 9 * Math.hypot(u, v));
            const ang = Math.atan2(-v, u);
            const x1 = px(lon) * sx;
            const y1 = py(lat) * sy;
            const x2 = x1 + len * Math.cos(ang);
            const y2 = y1 + len * Math.sin(ang);
            parts.push(s('line', { x1, y1, x2, y2, stroke: '#6b4fa0', 'stroke-width': 2.5 }));
            parts.push(s('polygon', { points: `${x2},${y2} ${x2 - 8 * Math.cos(ang - 0.45)},${y2 - 8 * Math.sin(ang - 0.45)} ${x2 - 8 * Math.cos(ang + 0.45)},${y2 - 8 * Math.sin(ang + 0.45)}`, fill: '#6b4fa0' }));
          }
          // A wind vane: its arrow head turns into the wind (points where the wind comes from).
          parts.push(s('circle', { cx: 46, cy: 176, r: 26, fill: 'none', stroke: 'var(--rule)' }));
          parts.push(s('line', { x1: 66, y1: 176, x2: 26, y2: 176, stroke: 'var(--ink)', 'stroke-width': 3 }));
          parts.push(s('polygon', { points: '22,176 32,170 32,182', fill: 'var(--ink)' }));
          parts.push(s('polygon', { points: '66,176 76,168 76,184', fill: 'none', stroke: 'var(--ink)', 'stroke-width': 2 }));
          parts.push(s('text', { x: 46, y: 146, 'text-anchor': 'middle', 'font-size': 10, fill: 'var(--ink-2)' }, 'ศรลม'));
          parts.push(s('text', { x: 92, y: 180, 'font-size': 10, fill: 'var(--ink-2)' }, 'ลม →'));
        }
        return parts;
      }

      return {
        bench,
        asks,
        chips: () => [
          { name: 'กลางวัน', done: coastDone('day'), now: showing() <= 1 },
          { name: 'กลางคืน', done: coastDone('night'), now: showing() === 2 },
          { name: 'แผนที่', done: MAP_ROWS.every((r) => ctx.has('map', r.id, 'value')), now: showing() === 3 },
        ],
        allDoneLabel: 'บันทึกครบ 3 ฉากแล้ว',
        doneText: 'บันทึกครบแล้ว ✓ กด "ไปตอบคำถาม"',
        tick(dt) {
          if (!running) return false;
          if (t === 0) { ctx.st.shown = next() || ctx.st.shown; ctx.save(); }
          t += dt * SPEED;
          if (t >= SHOW) running = false;
          return true;
        },
        render() {
          const sh = showing();
          const f = running ? Math.min(1, t / SHOW) : 1;
          let parts: SVGElement[];
          if (sh <= 2) {
            const time: Time = sh === 2 ? 'night' : 'day';
            title.textContent = sh === 0 ? 'ฉากที่ 1: ชายฝั่งทะเล' : `ฉากที่ 1: ชายฝั่งทะเล ${TIME_NAME[time]}`;
            parts = coast(time, sh === 0 ? 0 : f);
            clock.textContent = sh === 0 ? '' : `🕑 ${String(COAST_HOURS[time]).padStart(2, '0')}:00 น.`;
          } else {
            title.textContent = 'ฉากที่ 2: แผนที่ความกดอากาศ (H สูง, L ต่ำ)';
            parts = map(f);
            clock.textContent = 'เส้นในแผนที่ = ไอโซบาร์';
          }
          svg.replaceChildren(...parts);
          svg.setAttribute('aria-label', title.textContent ?? '');
          const n = next();
          btn.textContent = n === 1 ? '☀ ดูตอนกลางวัน' : n === 2 ? '🌙 ดูตอนกลางคืน' : n === 3 ? '🗺 ดูแผนที่ความกดอากาศ' : sh === 3 ? 'ดูครบแล้ว' : 'บันทึกให้ครบก่อน';
          btn.disabled = running || n === 0;
        },
      };
    },
  }, root, lab, home);
}
