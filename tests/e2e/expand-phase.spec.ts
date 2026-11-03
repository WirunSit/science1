// Heat Lab stations 3–4 (PLAN §8.3, §8.4, §12.1): Expand It (5 scenes, heat and cool, record) and
// Phase Graph (heat ice to steam, record each stage). One screen per step, offline, a11y.
import { expect, test, type Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { dirname, resolve } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const base = pathToFileURL(resolve(__dirname, '../../dist/heat-lab/index.html')).href;
const shot = (page: Page, name: string, projectName: string) =>
  page.screenshot({ path: resolve(__dirname, `../screenshots/heat-lab/${projectName}-${name}.png`) });
const pane = (page: Page) => page.locator('.step-pane:not([hidden])');
const asking = (page: Page) => page.locator('.result-table td.asking select');
const pick = async (page: Page, label: string) => {
  await expect(asking(page)).toBeVisible({ timeout: 15_000 });
  await asking(page).selectOption({ label });
};
async function expectOneScreen(page: Page) {
  const { scroll, inner, scrollW, innerW } = await page.evaluate(() => ({
    scroll: document.documentElement.scrollHeight, inner: window.innerHeight,
    scrollW: document.documentElement.scrollWidth, innerW: window.innerWidth,
  }));
  expect(scroll).toBeLessThanOrEqual(inner + 1);
  expect(scrollW, 'no sideways scroll either').toBeLessThanOrEqual(innerW + 1);
  // The visible step must fit too (an inner box can overflow even when the page does not scroll).
  const right = await page.locator('.step-pane:not([hidden])').evaluate((el) => Math.max(el.getBoundingClientRect().right, el.scrollWidth));
  expect(right, 'step fits the screen width').toBeLessThanOrEqual(innerW + 1);
}
const axe = async (page: Page) => {
  await page.evaluate(() => document.fonts.ready);
  const result = await new AxeBuilder({ page }).analyze();
  const bad = result.violations.filter((v) => v.impact === 'serious' || v.impact === 'critical');
  expect(bad.map((v) => `${v.id}: ${v.nodes.map((n) => n.target).join(' ')}`)).toEqual([]);
};

/** Expand It: [scene heat button, cool button, hot answer, cold answer] in mission order. */
const SCENES: [string, string, string, string][] = [
  ['🔥 ให้ความร้อน', '❄ ทำให้เย็นลง', 'ลอดไม่ได้', 'ลอดได้'],
  ['🔥 ให้ความร้อน', '❄ ทำให้เย็นลง', 'โค้งไปทางเหล็ก', 'โค้งไปทางทองเหลือง'],
  ['☀ แดดร้อน', '❄ อากาศเย็น', 'แคบลง', 'กว้างขึ้น'],
  ['🔥 แช่น้ำร้อน', '❄ แช่น้ำเย็น', 'สูงขึ้น', 'ต่ำลง'],
  ['🔥 แช่น้ำร้อน', '❄ แช่น้ำเย็น', 'พองขึ้น', 'แฟบลง'],
];

async function doExpandIt(page: Page, info: { project: { name: string } }) {
  for (const [i, [heat, cool, hot, cold]] of SCENES.entries()) {
    await page.getByRole('button', { name: heat }).click();
    if (i === 0) {
      await expect(page.getByRole('button', { name: '⬇ หย่อนผ่านห่วง' })).toBeEnabled({ timeout: 10_000 });
      await page.getByRole('button', { name: '⬇ หย่อนผ่านห่วง' }).click();
    }
    await pick(page, hot);
    if (i === 0 && info.project.name) await shot(page, 'expand-record', info.project.name);
    await page.getByRole('button', { name: cool }).click();
    if (i === 0) {
      await expect(page.getByRole('button', { name: '⬇ หย่อนผ่านห่วง' })).toBeEnabled({ timeout: 10_000 });
      await page.getByRole('button', { name: '⬇ หย่อนผ่านห่วง' }).click();
    }
    await pick(page, cold);
  }
}

test('Expand It: five scenes, heat and cool, record, questions', async ({ page }, info) => {
  await page.goto(`${base}#expand-it`);
  await page.evaluate(() => document.fonts.ready);
  await expectOneScreen(page);
  await axe(page);
  // A wrong observation turns the cell orange.
  await page.getByRole('button', { name: SCENES[0][0] }).click();
  await page.getByRole('button', { name: '⬇ หย่อนผ่านห่วง' }).click();
  await pick(page, 'ลอดได้');
  await expect(page.locator('.result-table td.wrong')).toHaveCount(1);
  await page.getByRole('button', { name: '⚛ อนุภาค' }).click();
  await expect(page.locator('.inset')).toBeVisible();
  await page.reload();
  await doExpandIt(page, info);
  await expect(page.locator('.mission')).toHaveText('✓ สังเกตครบ 5 ฉากแล้ว');
  await expectOneScreen(page);
  await shot(page, 'expand-done', info.project.name);
  await page.getByRole('button', { name: 'ไปตอบคำถาม ›' }).click();
  await expectOneScreen(page);
  await axe(page);
  const picks = ['อนุภาคของโลหะสั่นมากขึ้น', 'ราดน้ำร้อนที่ฝาโลหะ', 'เพื่อให้รางขยายตัวได้', 'โลหะสองชนิดขยายตัวได้ไม่เท่ากัน', 'อากาศภายในลูกปิงปองได้รับความร้อน'];
  for (const [i, text] of picks.entries()) {
    await pane(page).locator('.quiz-choice', { hasText: text }).first().click();
    if (i < picks.length - 1) await pane(page).getByRole('button', { name: /ข้อต่อไป/ }).click();
  }
  page.once('dialog', (d) => d.accept());
  await pane(page).getByRole('button', { name: /ส่งคำตอบ/ }).click();
  await expect(pane(page).locator('.score-big')).toHaveText('5 / 5');
  await expect(pane(page).locator('.review-item').nth(2)).toContainText('ช่องว่างที่รอยต่อราง เมื่อร้อนขึ้น = แคบลง');
});

test('Phase Graph: heat ice to steam, record 5 stages, graph question', async ({ page }, info) => {
  const external: string[] = [];
  page.on('request', (r) => { if (!/^(file|data|blob):/.test(r.url())) external.push(r.url()); });
  await page.goto(`${base}?speed=120#phase-graph`);
  await page.evaluate(() => document.fonts.ready);
  await expectOneScreen(page);
  await axe(page);
  const answers: [string, string][] = [
    ['น้ำแข็ง', 'สูงขึ้นจนถึง 0 °C'], ['น้ำแข็งกับน้ำ', 'คงที่ที่ 0 °C'], ['น้ำ', 'สูงขึ้นจนถึง 100 °C'], ['น้ำกับไอน้ำ', 'คงที่ที่ 100 °C'], ['ไอน้ำ', 'สูงขึ้นเกิน 100 °C'],
  ];
  await page.getByRole('button', { name: '🔥 เปิดเครื่อง' }).click();
  for (const [i, [state, temp]] of answers.entries()) {
    await pick(page, state);
    if (i === 1) {
      await pick(page, 'สูงขึ้นจนถึง 0 °C'); // wrong: the melting plateau is flat
      await expect(page.locator('.result-table td.wrong')).toHaveCount(1);
      await shot(page, 'phase-record', info.project.name);
    }
    await pick(page, temp);
  }
  await expect(page.locator('.mission')).toHaveText('✓ บันทึกครบ 5 ช่วงแล้ว');
  await expect(page.getByRole('button', { name: '❄ ทำให้เย็นลง' })).toBeVisible({ timeout: 15_000 });
  await expectOneScreen(page);
  await shot(page, 'phase-done', info.project.name);
  await page.getByRole('button', { name: 'ไปตอบคำถาม ›' }).click();
  for (let i = 0; i < 3; i++) {
    await pane(page).locator('.quiz-choice').nth(1).click();
    await pane(page).getByRole('button', { name: /ข้อต่อไป/ }).click();
  }
  await expect(pane(page).locator('.quiz-figure .chart-legend')).toContainText('น้ำแข็ง 100 g');
  await expectOneScreen(page);
  await shot(page, 'phase-graph-question', info.project.name);
  expect(external).toEqual([]);
});
