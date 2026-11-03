// Heat Transfer Studio station 3 — Radiation Cans (PLAN §9.2, D-045): four cans (matte black, red,
// white, polished silver). First under a lamp (absorbing radiation), then filled with 80 °C water with
// the lamp off (giving off radiation). Students rank which got hottest, then sort which cooled fast.
import { formatNumber, h, mountStation, s, type QuizItem, type StationAsk } from '@shared/index';
import { canRate } from '@shared/physics/transfer';
import quiz from '@content/quiz/U5C2-L2b.json';
import { CAN_RUN, CANS, COOL_CHOICES, RANK_CHOICES, canCooling, canRanks } from './answers';

export const RADIATION_CANS = { id: 'radiation-cans', title: 'การแผ่รังสีความร้อน', lesson: 'U5C2-L2' };
const SPEED = Number(new URLSearchParams(location.search).get('speed')) || 30;
type Mode = 'absorb' | 'emit';

export function mountRadiationCans(root: HTMLElement, lab: string, home: string): void {
  const answers = { absorb: canRanks(), emit: canCooling() };
  mountStation<Record<string, never>>({
    ...RADIATION_CANS,
    storeKey: 'hts:radiation-cans:v2',
    quiz: quiz.items as unknown as QuizItem[],
    modelNote: `แบบจำลองนี้ใช้ค่าการดูดกลืนแสงและค่าการคายรังสีความร้อนของผิวแต่ละแบบจาก constants (ค่าโดยประมาณ) สีที่ตาเห็นบอกว่าผิวดูดกลืนแสงได้มากหรือน้อย แต่ผิวที่ทาสีทุกสี (ดำ แดง ขาว) คายรังสีความร้อนได้ดีใกล้เคียงกัน มีเพียงผิวโลหะมันวาวที่คายได้น้อย เวลาเร็วกว่าจริง ${SPEED} เท่า ของจริงอุณหภูมิขึ้นกับขนาดกระป๋อง ปริมาณน้ำ และลมรอบ ๆ ด้วย`,
    tables: [{
      key: 'cans', caption: 'ตารางบันทึกผล', rowHead: 'ผิวกระป๋อง',
      rows: CANS.map((c) => ({ id: c.id, name: c.name })),
      columns: [{ key: 'absorb', label: 'เปิดไฟ: ร้อนขึ้นลำดับที่' }, { key: 'emit', label: 'ปิดไฟ: เย็นลง' }],
    }],
    initial: () => ({}),
    build(ctx) {
      let mode: Mode | null = null;
      let seconds = 0;
      let temps: number[] = CANS.map(() => CAN_RUN.tAir);
      const start = (m: Mode) => {
        mode = m;
        seconds = 0;
        temps = CANS.map(() => (m === 'absorb' ? CAN_RUN.tAir : CAN_RUN.hot));
        ctx.refresh();
      };
      const lampBtn = h('button', { type: 'button', className: 'btn warn small', onclick: () => start('absorb') }, '💡 เปิดหลอดไฟ');
      const hotBtn = h('button', { type: 'button', className: 'btn small', onclick: () => start('emit') }, '♨ ใส่น้ำร้อน ปิดไฟ');
      const clock = h('p', { className: 'clock' });
      const svg = s('svg', { viewBox: '0 0 320 220', class: 'scene-svg', role: 'img' });
      const bench = h('section', { className: 'bench xbench', 'aria-label': 'โต๊ะทดลอง' },
        h('p', { className: 'scene-title' }, 'กระป๋อง 4 ใบ ใส่น้ำเท่ากัน มีเทอร์โมมิเตอร์ทุกใบ'),
        h('div', { className: 'scene-stage' }, svg),
        h('div', { className: 'bench-controls' }, lampBtn, hotBtn, clock));
      const done = (m: Mode) => mode === m && seconds >= CAN_RUN.seconds;

      const asks: StationAsk[] = (['absorb', 'emit'] as Mode[]).flatMap((m) => CANS.map((c, i): StationAsk => ({
        table: 'cans', row: c.id, col: m,
        label: `${c.name} ${m === 'absorb' ? 'ร้อนขึ้นมากเป็นลำดับที่' : 'เย็นลงเร็วหรือช้า'}`,
        choices: () => (m === 'absorb' ? RANK_CHOICES : COOL_CHOICES), answer: () => answers[m][i], ready: () => done(m),
        todo: m === 'absorb'
          ? `ครบ ${CAN_RUN.seconds / 60} นาที: กระป๋อง${c.name}ร้อนขึ้นมากเป็นลำดับที่เท่าไร (1 = ร้อนที่สุด) ดูเทอร์โมมิเตอร์`
          : `ครบ ${CAN_RUN.seconds / 60} นาที: กระป๋อง${c.name}เย็นลงจาก ${CAN_RUN.hot} °C เร็วหรือช้า เทียบกับใบอื่น ดูเทอร์โมมิเตอร์`,
        wait: () => (mode === m ? 'กำลังทดลอง… ดูเทอร์โมมิเตอร์ของกระป๋องทั้ง 4 ใบ'
          : m === 'absorb' ? 'กด "💡 เปิดหลอดไฟ" ให้แสงส่องกระป๋องทั้ง 4 ใบ' : 'กด "♨ ใส่น้ำร้อน ปิดไฟ" แล้วดูว่ากระป๋องใดเย็นลงเร็ว'),
        waitCue: () => (mode === m ? null : m === 'absorb' ? lampBtn : hotBtn),
      })));

      return {
        bench,
        asks,
        chips: () => [
          { name: 'ดูดกลืนรังสี (เปิดไฟ)', done: CANS.every((c) => ctx.has('cans', c.id, 'absorb')), now: mode === 'absorb' },
          { name: 'คายรังสี (ปิดไฟ)', done: CANS.every((c) => ctx.has('cans', c.id, 'emit')), now: mode === 'emit' },
        ],
        allDoneLabel: 'บันทึกครบทั้ง 2 การทดลองแล้ว',
        doneText: 'บันทึกครบแล้ว ✓ กด "ไปตอบคำถาม"',
        tick(dt) {
          if (!mode || seconds >= CAN_RUN.seconds) return false;
          const steps = Math.ceil(dt * SPEED);
          for (let k = 0; k < steps && seconds < CAN_RUN.seconds; k++) {
            temps = temps.map((t, i) => t + canRate(t, CANS[i].abs, CANS[i].emit, mode === 'absorb' ? CAN_RUN.lamp : 0, CAN_RUN.tAir));
            seconds += 1;
          }
          return true;
        },
        render() {
          const parts: SVGElement[] = [];
          const lampOn = mode === 'absorb' && seconds < CAN_RUN.seconds;
          parts.push(s('rect', { x: 120, y: 4, width: 80, height: 14, rx: 4, fill: lampOn ? '#e5c04a' : 'var(--rule)', stroke: 'var(--ink)' }));
          CANS.forEach((c, i) => {
            const x = 18 + i * 76;
            if (mode === 'absorb') {
              // Arrows: light reaching the can; the reflected part bounces back, longer for shinier cans.
              parts.push(s('line', { x1: 160, y1: 20, x2: x + 26, y2: 78, stroke: '#e5c04a', 'stroke-width': 2 }));
              parts.push(s('line', { x1: x + 26, y1: 78, x2: x + 26 + 30 * (1 - c.abs), y2: 78 - 40 * (1 - c.abs), stroke: '#e5c04a', 'stroke-width': 2, 'stroke-dasharray': '4 3' }));
            }
            parts.push(s('rect', { x, y: 80, width: 52, height: 90, rx: 5, fill: c.fill, stroke: 'var(--ink)', 'stroke-width': 1.5 }));
            parts.push(s('text', { x: x + 26, y: 188, 'text-anchor': 'middle', 'font-size': 12, fill: 'var(--ink)' }, c.name));
            parts.push(s('rect', { x: x + 4, y: 194, width: 44, height: 20, rx: 4, fill: 'var(--card)', stroke: 'var(--ink-2)' }));
            parts.push(s('text', { x: x + 26, y: 209, 'text-anchor': 'middle', 'font-size': 13, 'font-weight': 600, fill: 'var(--ink)' }, `${formatNumber(temps[i], { decimals: 1 })} °C`));
          });
          svg.replaceChildren(...parts);
          svg.setAttribute('aria-label', `กระป๋อง 4 ใบ ${CANS.map((c, i) => `${c.name} ${formatNumber(temps[i], { decimals: 1 })} องศาเซลเซียส`).join(' ')}`);
          clock.textContent = `⏱ ${formatNumber(Math.floor(seconds / 60))} นาที (เร็วกว่าจริง ${SPEED} เท่า)`;
          lampBtn.disabled = mode === 'absorb' && seconds < CAN_RUN.seconds;
          hotBtn.disabled = !CANS.every((c) => ctx.has('cans', c.id, 'absorb')) || (mode === 'emit' && seconds < CAN_RUN.seconds);
        },
      };
    },
  }, root, lab, home);
}
