// Student name, class, and number: typed once, remembered on this device for every lab (PLAN §4.4).
import { safeStore } from './dom';

export interface Student {
  name: string;
  className: string;
  number: string;
}

const KEY = 'sci-m1:student';

export function readStudent(): Student {
  try {
    const raw = safeStore.get(KEY);
    if (raw) return { name: '', className: '', number: '', ...JSON.parse(raw) };
  } catch {
    /* ignore malformed */
  }
  return { name: '', className: '', number: '' };
}

export function saveStudent(st: Student): void {
  safeStore.set(KEY, JSON.stringify(st));
}
