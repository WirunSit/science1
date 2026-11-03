// Weather Station สถานีลมฟ้าอากาศ (PLAN §10): one link per experiment.
import { mountLabApp } from '@shared/index';
import { ATMOSPHERE_ELEVATOR, mountAtmosphereElevator } from './atmosphere-elevator';
import { SUN_ANGLE, mountSunAngle } from './sun-angle';
import { WIND_MAKER, mountWindMaker } from './wind-maker';
import { HUMIDITY_BOX, mountHumidityBox } from './humidity-box';
import { CLOUD_LIFT, mountCloudLift } from './cloud-lift';
import { FORECAST_ROOM, mountForecastRoom } from './forecast-room';

mountLabApp({
  lab: 'Weather Station สถานีลมฟ้าอากาศ',
  kicker: 'วิทยาศาสตร์ ม.1 ภาคเรียนที่ 2 · หน่วยที่ 6 บทที่ 1',
  experiments: [
    { ...ATMOSPHERE_ELEVATOR, mount: mountAtmosphereElevator },
    { ...SUN_ANGLE, mount: mountSunAngle },
    { ...WIND_MAKER, mount: mountWindMaker },
    { ...HUMIDITY_BOX, mount: mountHumidityBox },
    { ...CLOUD_LIFT, mount: mountCloudLift },
    { ...FORECAST_ROOM, mount: mountForecastRoom },
  ],
});
