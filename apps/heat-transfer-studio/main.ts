// Heat Transfer Studio สตูดิโอการถ่ายโอนความร้อน (PLAN §9): one link per experiment.
import { mountLabApp } from '@shared/index';
import { CONDUCTION_ROD, mountConductionRod } from './conduction-rod';
import { CONVECTION_POT, mountConvectionPot } from './convection-pot';
import { mountRadiationCans, RADIATION_CANS } from './radiation-cans';
import { mountThermalMixer, THERMAL_MIXER } from './thermal-mixer';
import { COOL_BOX, mountCoolBox } from './cool-box';

mountLabApp({
  lab: 'Heat Transfer Studio สตูดิโอการถ่ายโอนความร้อน',
  kicker: 'วิทยาศาสตร์ ม.1 ภาคเรียนที่ 2 · หน่วยที่ 5 บทที่ 2',
  experiments: [
    { ...CONDUCTION_ROD, mount: mountConductionRod },
    { ...CONVECTION_POT, mount: mountConvectionPot },
    { ...RADIATION_CANS, mount: mountRadiationCans },
    { ...THERMAL_MIXER, mount: mountThermalMixer },
    { ...COOL_BOX, mount: mountCoolBox },
  ],
});
