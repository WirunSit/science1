// Heat Lab ห้องทดลองความร้อน (PLAN §8): one link per experiment; the list of experiments without a hash.
import { mountLabApp } from '@shared/index';
import { mountParticleBox, PARTICLE_BOX } from './particle-box';
import { HEATER_BENCH, mountHeaterBench } from './heater-bench';
import { EXPAND_IT, mountExpandIt } from './expand-it';
import { mountPhaseGraph, PHASE_GRAPH } from './phase-graph';

mountLabApp({
  lab: 'Heat Lab ห้องทดลองความร้อน',
  kicker: 'วิทยาศาสตร์ ม.1 ภาคเรียนที่ 2 · หน่วยที่ 5 บทที่ 1',
  experiments: [
    { ...PARTICLE_BOX, mount: mountParticleBox },
    { ...HEATER_BENCH, mount: mountHeaterBench },
    { ...EXPAND_IT, mount: mountExpandIt },
    { ...PHASE_GRAPH, mount: mountPhaseGraph },
  ],
});
