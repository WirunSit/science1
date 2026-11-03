// Storm & Climate station 1 — Storm Builder (PLAN §11.1): (A) a thunderstorm through its three stages;
// (B) a tropical cyclone over a 25 °C and a 29 °C sea, growing through the wind categories in the
// constants, then moving onto land. One main button moves on when the step's cells are recorded.
import { formatNumber, h, mountStation, s, type QuizItem, type StationAsk } from '@shared/index';
import { weather } from '@shared/constants';
import quiz from '@content/quiz/U6C2-L1.json';
import {
  AIR_CHOICES, CATEGORY_CHOICES, FACT_ROWS, FORM_CHOICES, RAIN_CHOICES, SEA_TRIALS, STAGES, STAGE_ANSWERS, WIND_STOPS, categoryAnswer, formAnswer,
} from './answers';

export const STORM_BUILDER = { id: 'storm-builder', title: 'พายุ', lesson: 'U6C2-L1' };
const SPEED = Number(new URLSearchParams(location.search).get('speed')) || 1;
const PLAY = 3; // seconds per step on screen
/** The steps in order; each needs its cells recorded before the button moves on. */
const STEPS = [...STAGES.map((st) => `t:${st.id}`), ...SEA_TRIALS.map((t) => `c:${t.id}`), ...WIND_STOPS.map((w) => `w:${w}`), 'land'] as const;
const WIND_START = 35;
/** "พายุดีเปรสชัน < 63 · พายุโซนร้อน 63–117 · พายุไต้ฝุ่น ≥ 118" from the constants. */
const CATEGORY_LIMITS = weather.storms.tropicalCycloneCategories.items
  .map((c) => `${c.name.replace('พายุ', '')} ${c.maxKmhExclusive === null ? `≥ ${c.minKmh}` : c.minKmh === 0 ? `< ${c.maxKmhExclusive}` : `${c.minKmh}–${c.maxKmhExclusive - 1}`}`)
  .join(' · ');
const WIND_LAND = 55;

export function mountStormBuilder(root: HTMLElement, lab: string, home: string): void {
  mountStation<{ phase: number }>({
    ...STORM_BUILDER,
    storeKey: 'sc:storm-builder:v1',
    quiz: quiz.items as unknown as QuizItem[],
    modelNote: `ภาพพายุเป็นภาพจำลองเพื่ออธิบายกระบวนการ ไม่ได้คำนวณการไหลของอากาศจริง เงื่อนไขการเกิดพายุหมุนเขตร้อน (ผิวน้ำอุ่นอย่างน้อย ${weather.storms.minSeaSurfaceTempC.value} °C อยู่ห่างเส้นศูนย์สูตรอย่างน้อย ${weather.storms.minLatitudeDeg.value}°) และเกณฑ์ความเร็วลมแต่ละระดับมาจาก constants ความเร็วลมระหว่างพายุเพิ่มกำลังเป็นค่าตัวอย่าง พายุจริงแต่ละลูกต่างกันมาก`,
    tables: [
      { key: 'thunder', caption: 'ฉาก 1 พายุฝนฟ้าคะนอง', rowHead: 'ระยะ', rows: STAGES.map((st) => ({ id: st.id, name: st.name })), columns: [{ key: 'air', label: 'การเคลื่อนที่ของอากาศ' }, { key: 'rain', label: 'ฝนและลม' }] },
      { key: 'cyclone', caption: 'ฉาก 2 พายุหมุนเขตร้อน', rowHead: 'ผิวน้ำทะเล', rows: SEA_TRIALS.map((t) => ({ id: t.id, name: t.name })), columns: [{ key: 'forms', label: 'ผล' }] },
      { key: 'growth', caption: 'ระดับพายุตามความเร็วลมสูงสุด', rowHead: 'ลมสูงสุด', rows: WIND_STOPS.map((w) => ({ id: `w${w}`, name: `${w} km/h` })), columns: [{ key: 'cat', label: 'เรียกว่า' }] },
      { key: 'facts', caption: 'สิ่งที่สังเกต', rowHead: 'เรื่อง', rows: FACT_ROWS.map((f) => ({ id: f.id, name: f.name })), columns: [{ key: 'value', label: 'ผล' }] },
    ],
    initial: () => ({ phase: -1 }),
    build(ctx) {
      let playing = false;
      let t = 0;
      const title = h('p', { className: 'scene-title' });
      const svg = s('svg', { viewBox: '0 0 340 210', class: 'scene-svg', role: 'img' });
      const btn = h('button', { type: 'button', className: 'btn warn small', onclick: () => { ctx.st.phase += 1; playing = true; t = 0; ctx.save(); ctx.refresh(); } });
      const clock = h('p', { className: 'clock' });
      const bench = h('section', { className: 'bench xbench', 'aria-label': 'โต๊ะทดลอง' }, title, h('div', { className: 'scene-stage' }, svg), h('div', { className: 'bench-controls' }, btn, clock));
      const cellsOf = (k: string): [string, string, string][] => {
        if (k.startsWith('t:')) return [['thunder', k.slice(2), 'air'], ['thunder', k.slice(2), 'rain']];
        if (k.startsWith('c:')) return [['cyclone', k.slice(2), 'forms']];
        if (k.startsWith('w:')) return [['growth', `w${k.slice(2)}`, 'cat']];
        return FACT_ROWS.map((f): [string, string, string] => ['facts', f.id, 'value']);
      };
      const stepDone = (i: number) => i >= 0 && cellsOf(STEPS[i]).every(([a, b, c]) => ctx.has(a, b, c));
      const at = (k: string) => () => ctx.st.phase === STEPS.indexOf(k as (typeof STEPS)[number]) && !playing;
      const wait = () => (playing ? 'กำลังเปลี่ยน… ดูภาพ' : `กด "${btn.textContent}"`);

      const asks: StationAsk[] = [
        ...STAGES.flatMap((st, i): StationAsk[] => [
          { table: 'thunder', row: st.id, col: 'air', label: `การเคลื่อนที่ของอากาศ ${st.name}`, choices: () => AIR_CHOICES, answer: () => STAGE_ANSWERS[i].air, ready: at(`t:${st.id}`),
            todo: `${st.name}: ดูลูกศรในเมฆ (ขึ้น = ยกตัว ลง = จมตัว) อากาศเคลื่อนที่อย่างไร`, wait, waitCue: () => (playing ? null : btn) },
          { table: 'thunder', row: st.id, col: 'rain', label: `ฝนและลม ${st.name}`, choices: () => RAIN_CHOICES, answer: () => STAGE_ANSWERS[i].rain, ready: at(`t:${st.id}`),
            todo: `${st.name}: ฝน ฟ้าแลบ และลมเป็นอย่างไร เลือกในตาราง`, wait: '' },
        ]),
        ...SEA_TRIALS.map((tr): StationAsk => ({ table: 'cyclone', row: tr.id, col: 'forms', label: `${tr.name} เกิดพายุหรือไม่`, choices: () => FORM_CHOICES, answer: () => formAnswer(tr.sst), ready: at(`c:${tr.id}`),
          todo: `${tr.name}: อากาศเหนือทะเลก่อตัวเป็นพายุหมุนหรือไม่ เลือกในตาราง`, wait, waitCue: () => (playing ? null : btn) })),
        ...WIND_STOPS.map((w): StationAsk => ({ table: 'growth', row: `w${w}`, col: 'cat', label: `ลมสูงสุด ${w} km/h เรียกว่า`, choices: () => CATEGORY_CHOICES, answer: () => categoryAnswer(w), ready: at(`w:${w}`),
          todo: `ลมสูงสุดใกล้ศูนย์กลาง ${w} km/h ดูตารางเกณฑ์ใต้ภาพ พายุระดับนี้เรียกว่าอะไร`, wait, waitCue: () => (playing ? null : btn) })),
        ...FACT_ROWS.map((f): StationAsk => ({ table: 'facts', row: f.id, col: 'value', label: f.name, choices: () => f.choices, answer: () => f.answer, ready: at('land'),
          todo: f.id === 'land' ? 'พายุขึ้นฝั่งแล้ว ดูความเร็วลม พายุแรงขึ้นหรืออ่อนลง' : f.id === 'spin' ? 'ดูลูกศรรอบพายุ ลมพัดเวียนทางใด' : 'ดูป้ายที่ศูนย์กลางพายุ ตาพายุเป็นอย่างไร',
          wait, waitCue: () => (playing ? null : btn) })),
      ];

      const wind = (): number => {
        const k = STEPS[ctx.st.phase] ?? '';
        const f = playing ? Math.min(1, t / PLAY) : 1;
        if (k.startsWith('w:')) {
          const i = WIND_STOPS.indexOf(Number(k.slice(2)));
          const from = i === 0 ? WIND_START : WIND_STOPS[i - 1];
          return from + (WIND_STOPS[i] - from) * f;
        }
        if (k === 'land') return WIND_STOPS[WIND_STOPS.length - 1] + (WIND_LAND - WIND_STOPS[WIND_STOPS.length - 1]) * f;
        return WIND_START;
      };

      function thunder(i: number, f: number): SVGElement[] {
        const parts: SVGElement[] = [s('rect', { x: 0, y: 0, width: 340, height: 210, fill: '#dbeef6' }), s('rect', { x: 0, y: 186, width: 340, height: 24, fill: '#8fae6f' })];
        const top = [110, 22, 60][i] + (1 - f) * 30;
        const wide = [70, 150, 160][i];
        parts.push(s('path', { d: `M${170 - wide / 2},150 q-10,-40 30,-50 q10,${top - 100} ${wide / 2 - 30},${top - 100} q${wide / 2 - 20},0 ${wide / 2},${100 - top} q40,10 30,50 z`, fill: i === 2 ? '#d7dde2' : '#eef1f4', stroke: '#9aa5a9' }));
        if (i === 1) parts.push(s('rect', { x: 100, y: top - 6, width: 140, height: 12, rx: 6, fill: '#eef1f4', stroke: '#9aa5a9' }));
        const arrow = (x: number, y1: number, y2: number, c: string) => {
          const d = y2 > y1 ? 1 : -1;
          return [s('line', { x1: x, y1, x2: x, y2, stroke: c, 'stroke-width': 3 }), s('polygon', { points: `${x},${y2} ${x - 6},${y2 - 9 * d} ${x + 6},${y2 - 9 * d}`, fill: c })];
        };
        if (i < 2) parts.push(...arrow(150, 170, top + 30, '#b4441c'), ...arrow(175, 175, top + 40, '#b4441c'));
        if (i >= 1) parts.push(...arrow(i === 1 ? 210 : 160, top + 40, 175, '#0e6b70'));
        if (i === 2) parts.push(...arrow(195, top + 40, 175, '#0e6b70'));
        if (i >= 1) for (let k = 0; k < (i === 1 ? 14 : 5); k++) parts.push(s('line', { x1: 120 + k * 8, y1: 155 + (k % 3) * 6, x2: 116 + k * 8, y2: 167 + (k % 3) * 6, stroke: '#2e6e94', 'stroke-width': 2 }));
        if (i === 1) parts.push(s('polyline', { points: '230,90 218,120 232,120 216,152', fill: 'none', stroke: '#e5b51c', 'stroke-width': 3 }));
        if (i === 1) parts.push(s('text', { x: 40, y: 178, 'font-size': 11, fill: '#1f2a2e' }, '💨 ลมกระโชกแรง'));
        return parts;
      }

      function cyclone(k: string, f: number): SVGElement[] {
        const parts: SVGElement[] = [s('rect', { x: 0, y: 0, width: 340, height: 210, fill: '#4f8fb8' }), s('path', { d: 'M0,0 h70 q20,60 -5,110 q-20,50 10,100 h-75 z', fill: '#b99a6b' })];
        parts.push(s('text', { x: 8, y: 200, 'font-size': 11, fill: '#1f2a2e', 'font-weight': 600 }, 'แผ่นดิน'));
        const tr = SEA_TRIALS.find((x) => k === `c:${x.id}`);
        const sst = tr ? tr.sst : 29;
        parts.push(s('text', { x: 334, y: 16, 'text-anchor': 'end', 'font-size': 12, fill: '#fff', 'font-weight': 600 }, `ผิวน้ำทะเล ${sst} °C`));
        const forms = formAnswer(sst) === FORM_CHOICES[0];
        if (tr && !forms) {
          parts.push(s('text', { x: 200, y: 110, 'text-anchor': 'middle', 'font-size': 13, fill: '#fff' }, '☁ เมฆกระจัดกระจาย ไม่ก่อตัวเป็นพายุ'));
          return parts;
        }
        const grow = tr ? f * 0.5 : 1;
        const kmh = wind();
        const size = (18 + Math.min(1, kmh / 140) * 46) * (tr ? grow + 0.3 : 1);
        const cx = k === 'land' ? 205 - 145 * f : 205;
        const cy = 122;
        // Spiral rain bands turning anticlockwise (northern hemisphere), and the calm eye.
        for (let b = 0; b < 3; b++) {
          const r = size * (0.55 + b * 0.25);
          parts.push(s('path', { d: `M${cx + r},${cy} A${r},${r} 0 1 1 ${cx},${cy - r}`, fill: 'none', stroke: '#ffffff', 'stroke-width': 9 - b * 2, opacity: 0.8 }));
          parts.push(s('polygon', { points: `${cx - 6},${cy - r - 5} ${cx - 6},${cy - r + 5} ${cx - 14},${cy - r}`, fill: '#ffffff' }));
        }
        if (size > 30) {
          parts.push(s('circle', { cx, cy, r: 7, fill: '#4f8fb8', stroke: '#fff', 'stroke-width': 2 }));
          parts.push(s('text', { x: cx, y: cy + size + 14, 'text-anchor': 'middle', 'font-size': 10, fill: '#fff' }, 'ตาพายุ: ลมสงบ · กำแพงตาพายุ: ลมแรงที่สุด'));
        }
        return parts;
      }

      return {
        bench,
        asks,
        chips: () => [
          { name: 'พายุฝนฟ้าคะนอง', done: [0, 1, 2].every(stepDone), now: ctx.st.phase <= 2 },
          { name: 'พายุหมุนเขตร้อน', done: stepDone(STEPS.length - 1), now: ctx.st.phase > 2 },
        ],
        allDoneLabel: 'บันทึกครบ 2 ฉากแล้ว',
        doneText: 'บันทึกครบแล้ว ✓ กด "ไปตอบคำถาม"',
        tick(dt) {
          if (!playing) return false;
          t += dt * SPEED;
          if (t >= PLAY) playing = false;
          return true;
        },
        render() {
          const i = ctx.st.phase;
          const k = STEPS[Math.max(0, i)];
          const f = playing ? Math.min(1, t / PLAY) : 1;
          let parts: SVGElement[];
          if (i < 0 || k.startsWith('t:')) {
            const si = Math.max(0, STAGES.findIndex((st) => k === `t:${st.id}`));
            title.textContent = i < 0 ? 'ฉากที่ 1: บ่ายวันร้อนชื้น พื้นดินร้อนจัด' : `ฉากที่ 1: พายุฝนฟ้าคะนอง ${STAGES[si].name}`;
            parts = i < 0 ? thunder(0, 0).slice(0, 2) : thunder(si, f);
            clock.textContent = '';
          } else {
            title.textContent = 'ฉากที่ 2: พายุหมุนเขตร้อนเหนือมหาสมุทร (มองจากด้านบน)';
            parts = cyclone(k, f);
            const kmh = wind();
            const tr = SEA_TRIALS.find((x) => k === `c:${x.id}`);
            clock.textContent = tr ? (formAnswer(tr.sst) === FORM_CHOICES[0] ? 'อากาศร้อนชื้นยกตัว เริ่มหมุน' : '') : `ลมสูงสุด ${formatNumber(Math.round(kmh))} km/h`;
            if (!tr) parts.push(s('text', { x: 334, y: 32, 'text-anchor': 'end', 'font-size': 10, fill: '#fff' }, `เกณฑ์ (km/h): ${CATEGORY_LIMITS}`));
          }
          svg.replaceChildren(...parts);
          svg.setAttribute('aria-label', title.textContent ?? '');
          const next = STEPS[i + 1];
          btn.textContent = !next ? 'ดูครบแล้ว'
            : next.startsWith('t:') ? (i < 0 ? '▶ ให้อากาศร้อนชื้นยกตัว' : '▶ ระยะต่อไป')
              : next.startsWith('c:') ? `🌊 ${SEA_TRIALS.find((x) => next === `c:${x.id}`)!.name}`
                : next.startsWith('w:') ? '▶ ให้พายุเพิ่มกำลัง' : '▶ พายุเคลื่อนขึ้นฝั่ง';
          btn.disabled = playing || !next || (i >= 0 && !stepDone(i));
        },
      };
    },
  }, root, lab, home);
}
