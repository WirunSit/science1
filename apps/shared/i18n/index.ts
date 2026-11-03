import th from './th.json';

export type TextKey = keyof typeof th;

export function t(key: TextKey): string {
  return th[key];
}
