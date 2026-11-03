// Storm & Climate พายุและภูมิอากาศ (PLAN §11): one link per experiment.
import { mountLabApp } from '@shared/index';
import { STORM_BUILDER, mountStormBuilder } from './storm-builder';
import { GREENHOUSE_EARTH, mountGreenhouseEarth } from './greenhouse-earth';
import { MY_FOOTPRINT, mountMyFootprint } from './my-footprint';

mountLabApp({
  lab: 'Storm & Climate พายุและภูมิอากาศ',
  kicker: 'วิทยาศาสตร์ ม.1 ภาคเรียนที่ 2 · หน่วยที่ 6 บทที่ 2',
  experiments: [
    { ...STORM_BUILDER, mount: mountStormBuilder },
    { ...GREENHOUSE_EARTH, mount: mountGreenhouseEarth },
    { ...MY_FOOTPRINT, mount: mountMyFootprint },
  ],
});
