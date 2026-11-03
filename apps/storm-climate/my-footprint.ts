// Storm & Climate station 3 — My Footprint (PLAN §11.2): one week of a made-up student's routine turned
// into kgCO₂e with the TGO emission factors in climate.json (students work out each line: activity ×
// factor), then a pledge. After recording, students try their own routine (not recorded). Activities
// whose factor is still null (food, waste) are left out, as the plan requires.
import { formatNumber, h, mountStation, s, type QuizItem, type StationAsk } from '@shared/index';
import { climate } from '@shared/constants';
import { applianceWeekKg, travelWeekKg, type TravelMode } from '@shared/physics/climate';
import quiz from '@content/quiz/U6C2-L2b.json';
import { EXAMPLE, FOOT_ROWS, KG_CHOICES, exampleKg } from './answers';

export const MY_FOOTPRINT = { id: 'my-footprint', title: 'รอยเท้าคาร์บอนของฉัน', lesson: 'U6C2-L2' };
const EF = climate.emissionFactors;
const AP = climate.appliances;
const MODES: { id: TravelMode; name: string }[] = [
  { id: 'walk', name: 'เดิน' }, { id: 'bicycle', name: 'ปั่นจักรยาน' }, { id: 'motorcycle', name: 'รถจักรยานยนต์' }, { id: 'car', name: 'รถยนต์' },
];
const f1 = (x: number) => formatNumber(x, { decimals: 1 });
const f3 = (x: number) => formatNumber(x, { decimals: 3 });

export function mountMyFootprint(root: HTMLElement, lab: string, home: string): void {
  const e = exampleKg();
  mountStation<{ ac: number; fan: number; mode: TravelMode; km: number }>({
    ...MY_FOOTPRINT,
    storeKey: 'sc:my-footprint:v1',
    quiz: quiz.items as unknown as QuizItem[],
    modelNote: `ค่าการปล่อยก๊าซเรือนกระจก (Emission Factor) จาก อบก. ใน constants: ไฟฟ้า ${f3(EF.electricity.value!)} kgCO₂e/kWh, แก๊สโซฮอล์ ${f3(EF.gasohol.value!)} kgCO₂e/ลิตร กำลังไฟฟ้าของเครื่องใช้และอัตราสิ้นเปลืองน้ำมันของรถเป็นค่าโดยประมาณ ซ้อนรถคิดเป็นน้ำมันทั้งคัน (ถ้านั่งไปด้วยกันหลายคน แต่ละคนปล่อยน้อยลง) ยังไม่รวมอาหารและขยะ เพราะยังไม่มีค่าจาก อบก. ที่ตรวจแล้ว`,
    tables: [{
      key: 'foot', caption: 'ตารางบันทึกผล 1 สัปดาห์ของ "น้องฟ้า"', rowHead: 'กิจกรรม',
      rows: FOOT_ROWS.map((r) => ({ id: r.id, name: r.name })), columns: [{ key: 'kg', label: 'kgCO₂e ต่อสัปดาห์' }],
    }],
    initial: () => ({ ac: 2, fan: 4, mode: 'walk', km: 4 }),
    build(ctx) {
      const work = h('div', { className: 'foot-work' });
      const bars = h('div', { className: 'foot-bars' });
      const mine = h('div', { className: 'foot-mine', hidden: true });
      const bench = h('section', { className: 'bench xbench', 'aria-label': 'โต๊ะทดลอง' },
        h('p', { className: 'scene-title' }, 'แต่ละกิจกรรม: ปริมาณที่ใช้ × ค่าการปล่อยก๊าซเรือนกระจก = kgCO₂e'),
        h('div', { className: 'scene-stage foot-stage' }, work, bars, mine),
        h('div', { className: 'bench-controls' }, h('p', { className: 'clock' }, 'ค่าจาก อบก. (ดูหมายเหตุแบบจำลองในขั้นที่ 2)')));
      const kwh = { ac: AP.airConditioner.value * EXAMPLE.acHours * 7, fan: AP.fan.value * EXAMPLE.fanHours * 7 };
      const litres = (EXAMPLE.km * 5) / climate.vehicles[EXAMPLE.mode].value;
      const WORK: Record<string, string> = {
        ac: `${f1(AP.airConditioner.value)} kW × ${EXAMPLE.acHours} ชม. × 7 วัน = ${f1(kwh.ac)} kWh → × ${f3(EF.electricity.value!)}`,
        fan: `${formatNumber(AP.fan.value, { decimals: 2 })} kW × ${EXAMPLE.fanHours} ชม. × 7 วัน = ${f1(kwh.fan)} kWh → × ${f3(EF.electricity.value!)}`,
        travel: `${EXAMPLE.km} km × 5 วัน ÷ ${climate.vehicles[EXAMPLE.mode].value} km/ลิตร = ${formatNumber(litres, { decimals: 2 })} ลิตร → × ${f3(EF.gasohol.value!)}`,
        total: 'บวกทั้ง 3 กิจกรรม',
        pledge: `ลด 1 ชม. ต่อวัน: ${f1(AP.airConditioner.value)} kW × 1 ชม. × 7 วัน × ${f3(EF.electricity.value!)}`,
      };
      const asks: StationAsk[] = FOOT_ROWS.map((r): StationAsk => ({
        table: 'foot', row: r.id, col: 'kg', label: `kgCO₂e ${r.name}`,
        choices: KG_CHOICES, answer: () => e[r.id].toFixed(1), ready: () => true,
        todo: `${r.name}: ${WORK[r.id]} ได้กี่ kgCO₂e (ทศนิยม 1 ตำแหน่ง) เลือกในตาราง`,
        wait: '',
      }));

      // "ของฉัน": shown once the example is recorded — the student's own week, not recorded.
      const sel = (label: string, opts: [string, string][], value: string, on: (v: string) => void) => {
        const el = h('select', { onchange: () => { on(el.value); ctx.save(); ctx.refresh(); } }, ...opts.map(([v, t]) => h('option', { value: v, selected: v === value }, t))) as HTMLSelectElement;
        return h('label', { className: 'field mini' }, label, el);
      };
      const hours = (n: number) => Array.from({ length: n + 1 }, (_, i): [string, string] => [String(i), `${i} ชม.`]);
      mine.append(
        h('p', { className: 'scene-title' }, 'ลองกับกิจวัตรของฉัน (ไม่ต้องบันทึก)'),
        sel('เครื่องปรับอากาศ ต่อวัน', hours(12), String(ctx.st.ac), (v) => { ctx.st.ac = Number(v); }),
        sel('พัดลม ต่อวัน', hours(12), String(ctx.st.fan), (v) => { ctx.st.fan = Number(v); }),
        sel('ไปโรงเรียนด้วย', MODES.map((m): [string, string] => [m.id, m.name]), ctx.st.mode, (v) => { ctx.st.mode = v as TravelMode; }),
        sel('ระยะทางไปกลับ', [2, 4, 6, 10, 20].map((k): [string, string] => [String(k), `${k} km`]), String(ctx.st.km), (v) => { ctx.st.km = Number(v); }));
      const mineOut = h('p', { className: 'foot-total', role: 'status' });
      mine.append(mineOut);

      const bar = (name: string, kg: number, max: number) => h('div', { className: 'qbar' },
        h('span', {}, name), h('span', { className: 'qbar-track' }, h('span', { className: 'qbar-fill lost', style: `width:${Math.min(100, (kg / max) * 100)}%` })), h('span', {}, `${f1(kg)} kg`));

      return {
        bench,
        asks,
        chips: () => [{ name: 'น้องฟ้า', done: FOOT_ROWS.every((r) => ctx.has('foot', r.id, 'kg')), now: true }],
        allDoneLabel: 'บันทึกครบแล้ว',
        doneText: 'บันทึกครบแล้ว ✓ ลองกิจวัตรของฉันด้านบน หรือกด "ไปตอบคำถาม"',
        teacher(tools) {
          const hidden = Object.entries(EF).filter(([k, v]) => !k.startsWith('$') && typeof v === 'object' && v.value === null).map(([, v]) => (v as { name: string }).name);
          tools.append(h('p', { className: 'hint' }, `กิจกรรมที่ซ่อนเพราะยังไม่มีค่า Emission Factor ใน constants: ${hidden.join(', ') || 'ไม่มี'}`));
        },
        render() {
          const done = FOOT_ROWS.every((r) => ctx.has('foot', r.id, 'kg'));
          const next = FOOT_ROWS.find((r) => !ctx.has('foot', r.id, 'kg'));
          work.textContent = next ? `น้องฟ้า: ${WORK[next.id]}` : `น้องฟ้า ปล่อยรวม ${f1(e.total)} kgCO₂e ต่อสัปดาห์`;
          const recorded = FOOT_ROWS.filter((r) => r.id !== 'total' && r.id !== 'pledge' && ctx.has('foot', r.id, 'kg'));
          bars.replaceChildren(...recorded.map((r) => bar(r.id === 'ac' ? 'แอร์' : r.id === 'fan' ? 'พัดลม' : 'เดินทาง', e[r.id], e.total)));
          mine.hidden = !done;
          if (done) {
            const ac = applianceWeekKg(AP.airConditioner.value, ctx.st.ac) ?? 0;
            const fan = applianceWeekKg(AP.fan.value, ctx.st.fan) ?? 0;
            const tr = travelWeekKg(ctx.st.mode, ctx.st.km) ?? 0;
            mineOut.textContent = `ของฉัน ${f1(ac + fan + tr)} kgCO₂e ต่อสัปดาห์ (แอร์ ${f1(ac)} · พัดลม ${f1(fan)} · เดินทาง ${f1(tr)}) — ลดแอร์วันละ 1 ชม. ลดได้ ${f1(applianceWeekKg(AP.airConditioner.value, Math.min(1, ctx.st.ac)) ?? 0)} kg`;
          }
        },
      };
    },
  }, root, lab, home);
}
