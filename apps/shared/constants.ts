// The only way lab code reads scientific values. Never hard-code a constant in a lab.
import heatJson from '@content/constants/heat.json';
import weatherJson from '@content/constants/weather.json';
import climateJson from '@content/constants/climate.json';

export interface ConstantEntry {
  name: string;
  value: number | null;
  unit: string;
  verified: boolean;
  source: string;
  note?: string;
  symbol?: string;
}

export const heat = heatJson;
export const weather = weatherJson;
export const climate = climateJson;

export type SubstanceId = keyof Omit<typeof heatJson.specificHeat, '$unit'>;

export function specificHeat(id: SubstanceId): number {
  return heatJson.specificHeat[id].value;
}

export function substanceName(id: SubstanceId): string {
  return heatJson.specificHeat[id].name;
}

/** Throws when a value the lab needs has not been filled in yet (value: null). */
export function requireValue(entry: { value: number | null; name: string }): number {
  if (entry.value === null) throw new Error(`ยังไม่มีค่า "${entry.name}" ใน constants`);
  return entry.value;
}
