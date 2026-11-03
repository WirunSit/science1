// Weather Station station 6 — Forecast Room (PLAN §10.6): four made-up weather maps of Thailand drawn
// from a pressure field (isobars, H/L, wind arrows from high to low). For the pinned region on each map,
// students record the pressure there and choose the forecast. Teacher tools: the class weather log (CSV).
import { formatNumber, h, mountStation, s, type QuizItem, type StationAsk } from '@shared/index';
import quiz from '@content/quiz/U6C1-L6.json';
import { FORECAST_CHOICES, PRESSURE_CHOICES, scenarioPressure } from './answers';
import { MAP_H, MAP_W, SCENARIOS, SEA_LABELS, THAILAND, isobars, px, py, windAt } from './weather-map';
import { mountClassLog } from './class-log';

export const FORECAST_ROOM = { id: 'forecast-room', title: 'การพยากรณ์อากาศ', lesson: 'U6C1-L6' };

export function mountForecastRoom(root: HTMLElement, lab: string, home: string): void {
  mountStation<{ map: number }>({
    ...FORECAST_ROOM,
    storeKey: 'ws:forecast-room:v1',
    quiz: quiz.items as unknown as QuizItem[],
    modelNote: 'แผนที่อากาศทั้ง 4 ฉบับเป็นแผนที่สมมติที่วาดขึ้นเพื่อการเรียนรู้ (ไม่ใช่แผนที่ของกรมอุตุนิยมวิทยา) เส้นขอบประเทศเป็นภาพย่อโดยประมาณ ไอโซบาร์คือเส้นที่ลากผ่านจุดที่มีความกดอากาศเท่ากัน ลูกศรลมชี้จากความกดอากาศสูงไปต่ำตรง ๆ ตามระดับ ม.1 ของจริงลมจะเบี่ยงเพราะการหมุนของโลก ดูแผนที่อากาศจริงได้ที่เว็บไซต์กรมอุตุนิยมวิทยา tmd.go.th',
    tables: [{
      key: 'maps', caption: 'ตารางบันทึกผล บริเวณที่ปักหมุด', rowHead: 'แผนที่',
      rows: SCENARIOS.map((sc) => ({ id: sc.id, name: `${sc.name} (${sc.month})` })),
      columns: [{ key: 'pressure', label: 'ความกดอากาศ' }, { key: 'weather', label: 'คำพยากรณ์' }],
    }],
    initial: () => ({ map: 0 }),
    build(ctx) {
      const title = h('p', { className: 'scene-title' });
      const svg = s('svg', { viewBox: `0 0 ${MAP_W} ${MAP_H}`, class: 'scene-svg map-svg', role: 'img' });
      const btn = h('button', { type: 'button', className: 'btn warn small', onclick: () => { ctx.st.map += 1; ctx.save(); ctx.refresh(); } }, '▶ แผนที่ถัดไป');
      const legend = h('p', { className: 'clock' }, 'เส้น = ไอโซบาร์ (hPa) · ลูกศร = ลม · 📍 = บริเวณที่พยากรณ์');
      const bench = h('section', { className: 'bench xbench', 'aria-label': 'แผนที่อากาศ' }, title, h('div', { className: 'scene-stage' }, svg), h('div', { className: 'bench-controls' }, btn, legend));
      const mapDone = (i: number) => ctx.has('maps', SCENARIOS[i].id, 'weather');

      const asks: StationAsk[] = SCENARIOS.flatMap((sc, i): StationAsk[] => [
        {
          table: 'maps', row: sc.id, col: 'pressure', label: `ความกดอากาศบริเวณหมุด ${sc.name}`,
          choices: () => PRESSURE_CHOICES, answer: () => scenarioPressure(i), ready: () => ctx.st.map === i,
          todo: `${sc.name}: ดูตัวอักษร H หรือ L และไอโซบาร์รอบหมุด 📍 (${sc.pin.name}) บริเวณนี้ความกดอากาศสูงหรือต่ำ`,
          wait: () => `กด "▶ แผนที่ถัดไป" ดู${sc.name}`,
          waitCue: () => btn,
        },
        {
          table: 'maps', row: sc.id, col: 'weather', label: `คำพยากรณ์ ${sc.name}`,
          choices: () => FORECAST_CHOICES, answer: () => sc.forecast, ready: () => ctx.st.map === i,
          todo: `ใช้เดือน ความกดอากาศ ทิศลม ${sc.storm ? 'และพายุ ' : ''}เลือกคำพยากรณ์ของบริเวณหมุด`,
          wait: '',
        },
      ]);

      if (ctx.steps.teacherTools) mountClassLog(ctx.steps.teacherTools);

      return {
        bench,
        asks,
        chips: () => SCENARIOS.map((sc, i) => ({ name: sc.name, done: mapDone(i), now: ctx.st.map === i })),
        allDoneLabel: 'พยากรณ์ครบ 4 แผนที่แล้ว',
        doneText: 'พยากรณ์ครบแล้ว ✓ กด "ไปตอบคำถาม" — ดูแผนที่อากาศจริงได้ที่ tmd.go.th',
        render() {
          const i = Math.min(ctx.st.map, SCENARIOS.length - 1);
          const sc = SCENARIOS[i];
          title.textContent = `${sc.name} ${sc.month} (แผนที่สมมติ)`;
          const parts: SVGElement[] = [s('rect', { x: 0, y: 0, width: MAP_W, height: MAP_H, fill: '#dcecf3' })];
          parts.push(s('polygon', { points: THAILAND.map(([lon, lat]) => `${px(lon)},${py(lat)}`).join(' '), fill: '#efe3c4', stroke: '#8a7650', 'stroke-width': 1.2 }));
          for (const l of SEA_LABELS) parts.push(s('text', { x: px(l.lon), y: py(l.lat), 'text-anchor': 'middle', 'font-size': 10, fill: '#3d6478' }, l.text));
          for (const iso of isobars(sc)) {
            for (const [x1, y1, x2, y2] of iso.segments) parts.push(s('line', { x1, y1, x2, y2, stroke: '#56646a', 'stroke-width': 1 }));
            const mid = iso.segments[Math.floor(iso.segments.length / 3)];
            parts.push(s('text', { x: mid[0], y: mid[1], 'font-size': 8, fill: '#56646a' }, formatNumber(iso.value)));
          }
          for (const sys of sc.systems) {
            const at = sys.labelAt ?? sys;
            parts.push(s('text', { x: px(at.lon), y: py(at.lat) + 9, 'text-anchor': 'middle', 'font-size': 26, 'font-weight': 700, fill: sys.kind === 'H' ? '#0e6b70' : '#b4441c' }, sys.kind));
          }
          if (sc.storm) {
            parts.push(s('text', { x: px(sc.storm.lon), y: py(sc.storm.lat) - 18, 'text-anchor': 'middle', 'font-size': 18 }, '🌀'));
            parts.push(s('text', { x: px(sc.storm.lon), y: py(sc.storm.lat) + 26, 'text-anchor': 'middle', 'font-size': 9, fill: '#b4441c' }, sc.storm.name));
          }
          // Wind arrows on a coarse grid, length by pressure gradient.
          for (let lon = 96; lon <= 108; lon += 3) {
            for (let lat = 6; lat <= 22; lat += 3) {
              const [u, v] = windAt(sc, lon, lat);
              const g = Math.hypot(u, v);
              if (g < 0.15) continue;
              const len = Math.min(26, 8 + 6 * g);
              const ang = Math.atan2(-v, u);
              const x1 = px(lon);
              const y1 = py(lat);
              const x2 = x1 + len * Math.cos(ang);
              const y2 = y1 + len * Math.sin(ang);
              parts.push(s('line', { x1, y1, x2, y2, stroke: '#6b4fa0', 'stroke-width': 2 }));
              parts.push(s('polygon', { points: `${x2},${y2} ${x2 - 6 * Math.cos(ang - 0.45)},${y2 - 6 * Math.sin(ang - 0.45)} ${x2 - 6 * Math.cos(ang + 0.45)},${y2 - 6 * Math.sin(ang + 0.45)}`, fill: '#6b4fa0' }));
            }
          }
          parts.push(s('text', { x: px(sc.pin.lon), y: py(sc.pin.lat), 'text-anchor': 'middle', 'font-size': 20 }, '📍'));
          parts.push(s('text', { x: MAP_W - 4, y: MAP_H - 4, 'text-anchor': 'end', 'font-size': 8, fill: '#56646a' }, 'ภาพย่อโดยประมาณ ไม่ใช่แผนที่จริง'));
          svg.replaceChildren(...parts);
          svg.setAttribute('aria-label', `${sc.name} ${sc.month} ${sc.systems.map((x) => (x.kind === 'H' ? 'ความกดอากาศสูง' : 'ความกดอากาศต่ำ')).join(' ')} หมุดที่${sc.pin.name}`);
          btn.disabled = ctx.st.map >= SCENARIOS.length - 1 || !mapDone(ctx.st.map);
          btn.textContent = ctx.st.map >= SCENARIOS.length - 1 ? 'ครบ 4 แผนที่' : '▶ แผนที่ถัดไป';
        },
      };
    },
  }, root, lab, home);
}
