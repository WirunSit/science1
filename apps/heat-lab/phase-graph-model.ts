// Phase Graph data with no DOM, so unit tests can check the answers the lab accepts (PLAN §8.4, D-042).
import { heat } from '@shared/constants';
import { heatingCurve, type CurveStage } from '@shared/physics/heat';

/** The student's run: 100 g of ice at −10 °C heated until it is steam at 110 °C, 1,000 J every second. */
export const RUN = { m: 0.1, t0: -10, tSteam: 110, power: 1000 };
export const STAGES = heatingCurve(RUN.m, RUN.t0, RUN.tSteam);

const MELT = heat.phasePoints.waterMelting.value;
const BOIL = heat.phasePoints.waterBoiling.value;
export const STATE_CHOICES = ['น้ำแข็ง', 'น้ำแข็งกับน้ำ', 'น้ำ', 'น้ำกับไอน้ำ', 'ไอน้ำ'];
const RISE_TO_MELT = `สูงขึ้นจนถึง ${MELT} °C`;
const RISE_TO_BOIL = `สูงขึ้นจนถึง ${BOIL} °C`;
const RISE_PAST_BOIL = `สูงขึ้นเกิน ${BOIL} °C`;
export const TEMP_CHOICES = [RISE_TO_MELT, RISE_TO_BOIL, RISE_PAST_BOIL, `คงที่ที่ ${MELT} °C`, `คงที่ที่ ${BOIL} °C`];

const ANSWERS: Record<CurveStage['id'], { state: string; temp: string }> = {
  ice: { state: 'น้ำแข็ง', temp: RISE_TO_MELT },
  melting: { state: 'น้ำแข็งกับน้ำ', temp: `คงที่ที่ ${MELT} °C` },
  water: { state: 'น้ำ', temp: RISE_TO_BOIL },
  boiling: { state: 'น้ำกับไอน้ำ', temp: `คงที่ที่ ${BOIL} °C` },
  steam: { state: 'ไอน้ำ', temp: RISE_PAST_BOIL },
};

export function stageAnswer(i: number): { state: string; temp: string } {
  return ANSWERS[STAGES[i].id];
}

/** Every answer cell a quiz item may quote: "stages/<stage id>/<state|temp>" → the right value. */
export function answerCells(): Record<string, string> {
  const out: Record<string, string> = {};
  for (const s of STAGES) {
    out[`stages/${s.id}/state`] = ANSWERS[s.id].state;
    out[`stages/${s.id}/temp`] = ANSWERS[s.id].temp;
  }
  return out;
}
