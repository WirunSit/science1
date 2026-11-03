// Heat Lab station 2 — Heater Bench: virtual bench → questions → score (PLAN §4.2, §8.2, §12.1). Offline,
// one screen per step, dropdown recording checked at once, progress survives reload, answer key points at the table.
import { expect, test, type Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { dirname, resolve } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
// ?speed=120: 30 simulated seconds take 0.25 s instead of 3 s.
const url = `${pathToFileURL(resolve(__dirname, '../../dist/heat-lab/index.html')).href}?speed=120#heater-bench`;

const shot = (page: Page, name: string, projectName: string) =>
  page.screenshot({ path: resolve(__dirname, `../screenshots/heat-lab/${projectName}-heater-${name}.png`) });

const pane = (page: Page) => page.locator('.step-pane:not([hidden])');

/** The preset table (PLAN §8.2): what the thermometer reads at 0, 30, 60, 90, 120 s. */
const RUNS = {
  water100: { bottle: 'น้ำ', taps: 1, col: 1, readings: [25, 35, 45, 55, 65] },
  water200: { bottle: 'น้ำ', taps: 2, col: 2, readings: [25, 30, 35, 40, 45] },
  oil100: { bottle: 'น้ำมันพืช', taps: 1, col: 3, readings: [25, 46, 68, 89, 110] },
};
type RunKey = keyof typeof RUNS;

const bottle = (page: Page, name: string) => page.getByRole('button', { name: `${name}: เท 100 g ลงบีกเกอร์` });
const heater = (page: Page) => page.getByRole('button', { name: /เปิดเครื่อง|กำลังให้ความร้อน/ });
const asking = (page: Page) => page.locator('.result-table td.asking select');
const cell = (page: Page, row: number, col: number) => page.locator('.result-table tbody tr').nth(row).locator('td').nth(col);

async function pour(page: Page, name: string, taps: number) {
  for (let i = 0; i < taps; i++) {
    await expect(bottle(page, name)).toBeEnabled();
    await bottle(page, name).click();
  }
  await expect(bottle(page, name)).toBeEnabled(); // pouring animation finished
}

/** One mission run: pour, record 0 s, heat, record every 30 s up to `upTo` rows. */
async function doRun(page: Page, key: RunKey, upTo = 5) {
  const r = RUNS[key];
  await pour(page, r.bottle, r.taps);
  await expect(heater(page)).toBeDisabled(); // 0 s must be recorded first
  await asking(page).selectOption({ label: String(r.readings[0]) });
  for (let row = 1; row < upTo; row++) {
    if (row === 1) await heater(page).click();
    await expect(asking(page)).toBeVisible({ timeout: 10_000 });
    await asking(page).selectOption({ label: String(r.readings[row]) });
  }
}

async function finishMission(page: Page) {
  const keys = Object.keys(RUNS) as RunKey[];
  for (const [i, key] of keys.entries()) {
    await doRun(page, key);
    await expect(page.locator('.todo')).toContainText('ครบ 120 s แล้ว');
    if (i < keys.length - 1) await page.getByRole('button', { name: 'เทออก' }).click();
  }
}

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

test('step 1: virtual bench — pour, heat, record with dropdowns, graph grows', async ({ page }, info) => {
  const external: string[] = [];
  page.on('request', (r) => { if (!/^(file|data|blob):/.test(r.url())) external.push(r.url()); });
  await page.goto(url);
  await page.evaluate(() => document.fonts.ready);
  await expectOneScreen(page);
  for (const loc of [page.locator('.bench'), page.locator('.graph-slot'), page.locator('.result-table'), page.locator('.todo')]) {
    await expect(loc).toBeInViewport({ ratio: 0.99 });
  }
  await expect(bottle(page, 'น้ำ')).toHaveClass(/cue/);
  await expect(page.getByRole('button', { name: 'ตอบคำถาม' })).toBeDisabled();
  await shot(page, '1-start', info.project.name);

  // Water 100 g, stop at the 60 s reading; a wrong pick turns the cell orange and holds the clock.
  await doRun(page, 'water100', 2);
  await expect(asking(page)).toBeVisible({ timeout: 10_000 });
  await asking(page).selectOption({ label: '40' });
  await expect(page.locator('.result-table td.wrong')).toHaveCount(1);
  await expect(page.locator('.todo')).toContainText('ยังไม่ถูก');
  await expect(page.locator('.clock')).toContainText('60 s');
  await expectOneScreen(page);
  await shot(page, '1-record', info.project.name);
  await asking(page).selectOption({ label: '45' });
  for (const v of [55, 65]) {
    await expect(asking(page)).toBeVisible({ timeout: 10_000 });
    await asking(page).selectOption({ label: String(v) });
  }
  await page.getByRole('button', { name: 'เทออก' }).click();
  await doRun(page, 'water200');
  await page.getByRole('button', { name: 'เทออก' }).click();
  await doRun(page, 'oil100');

  await expect(cell(page, 2, 0)).toHaveText('8,400');
  await expect(cell(page, 2, 1)).toHaveText('45');
  await expect(cell(page, 4, 2)).toHaveText('45');
  await expect(cell(page, 1, 3)).toHaveText('46');
  await expect(page.locator('.mission')).toHaveText('✓ ทดลองครบ 3 อย่างแล้ว');
  // 3 runs × 5 recorded points on the graph.
  await expect(page.locator('.graph-slot .chart-svg circle, .graph-slot .chart-svg rect[width="9"], .graph-slot .chart-svg polygon')).toHaveCount(15);

  // An extra run (vegetable oil 200 g): on the graph, not in the table, no stops.
  await page.getByRole('button', { name: 'เทออก' }).click();
  await pour(page, 'น้ำมันพืช', 2);
  await expect(page.locator('.todo')).toContainText('การทดลองเพิ่มเติม');
  await heater(page).click();
  await expect(page.locator('.todo')).toContainText('ครบ 120 s แล้ว', { timeout: 10_000 });
  await expect(page.locator('.chart-legend')).toContainText('น้ำมันพืช 200 g (เพิ่มเติม)');
  await expect(page.locator('.result-table thead')).not.toContainText('200 g (เพิ่มเติม)');
  await expectOneScreen(page);
  await shot(page, '1-done', info.project.name);
  expect(external).toEqual([]);
});

test('reload keeps recorded rows and waits at the last one', async ({ page }) => {
  await page.goto(url);
  await doRun(page, 'water100', 3); // rows 0, 30, 60 recorded
  await expect(asking(page)).toBeVisible({ timeout: 10_000 }); // paused at 90 s
  await page.reload();
  await expect(cell(page, 2, 1)).toHaveText('45');
  await expect(page.locator('.clock')).toContainText('60 s');
  await expect(heater(page)).toBeEnabled();
  await heater(page).click();
  await expect(asking(page)).toBeVisible({ timeout: 10_000 });
  await expect(page.locator('.clock')).toContainText('90 s');
});

test('steps 2–3: questions one at a time (with the graph), score, score card', async ({ page }, info) => {
  await page.goto(url);
  await finishMission(page);
  await page.getByRole('button', { name: 'ไปตอบคำถาม ›' }).click();

  const quiz = pane(page);
  await expect(quiz.locator('.result-table')).toBeVisible();
  await expect(quiz.getByText('ข้อ 1 จาก 5')).toBeVisible();
  await expectOneScreen(page);
  await expect(quiz.getByRole('button', { name: /ข้อต่อไป/ })).toBeInViewport();
  await shot(page, '2-quiz', info.project.name);

  // Keys: ข, ข, ข, ค, ข — answer Q4 wrong on purpose.
  const picks = ['55 °C', '8,400 J', 'น้ำมวลมากกว่าต้องใช้', 'น้ำ 200 g', 'น้ำมันพืชมีความจุความร้อนจำเพาะน้อยกว่า'];
  for (const [i, text] of picks.entries()) {
    if (i === 3) {
      await expect(quiz.locator('.quiz-figure .chart-legend')).toContainText('น้ำมันพืช 100 g');
      await shot(page, '2-graph-question', info.project.name);
    }
    await quiz.locator('.quiz-choice', { hasText: text }).first().click();
    if (i < picks.length - 1) await quiz.getByRole('button', { name: /ข้อต่อไป/ }).click();
  }
  await page.reload();
  await expect(pane(page).getByText('ข้อ 5 จาก 5')).toBeVisible();
  page.once('dialog', (d) => d.accept());
  await pane(page).getByRole('button', { name: /ส่งคำตอบ/ }).click();

  const score = pane(page);
  await expect(score.locator('.score-big')).toHaveText('4 / 5');
  await expect(score.locator('.review-item.no')).toHaveCount(1);
  await expect(score.locator('.review-item').nth(1)).toContainText('น้ำ 100 g เวลา 60 s = 45 °C, ความร้อน 8,400 J');
  const send = score.getByRole('button', { name: /ส่งคะแนนให้ครู/ });
  await expect(send).toBeDisabled();
  await score.getByLabel('ชื่อ–นามสกุล').fill('ทดสอบ ระบบ');
  await score.getByLabel('ชั้น').fill('ม.1/1');
  await score.getByLabel('เลขที่').fill('1');
  await expectOneScreen(page);
  await expect(send).toBeInViewport();
  await shot(page, '3-score', info.project.name);
  await page.evaluate(() => { (navigator as unknown as { canShare: unknown }).canShare = undefined; });
  const [png] = await Promise.all([page.waitForEvent('download'), send.click()]);
  expect(png.suggestedFilename()).toMatch(/-1\.png$/);
  if (info.project.name === 'phone') await png.saveAs(resolve(__dirname, '../screenshots/heat-lab/heater-score-card.png'));

  await page.reload();
  await expect(pane(page).locator('.score-big')).toHaveText('4 / 5');
  await page.getByRole('button', { name: 'ตอบคำถาม' }).click();
  await expect(pane(page).locator('input[type=radio]').first()).toBeDisabled();
});

test('accessibility in every step and dark mode', async ({ page }, info) => {
  await page.goto(url);
  const check = async () => {
    await page.evaluate(() => document.fonts.ready);
    const result = await new AxeBuilder({ page }).analyze();
    const bad = result.violations.filter((v) => v.impact === 'serious' || v.impact === 'critical');
    expect(bad.map((v) => `${v.id}: ${v.nodes.map((n) => n.target).join(' ')}`)).toEqual([]);
  };
  await check();
  await pour(page, 'น้ำ', 1);
  await check(); // with the dropdown open in the table
  await page.getByRole('button', { name: 'เทออก' }).click();
  await finishMission(page);
  await page.getByRole('button', { name: 'ไปตอบคำถาม ›' }).click();
  await check();
  for (let i = 0; i < 5; i++) {
    await pane(page).locator('.quiz-choice').first().click();
    if (i < 4) await pane(page).getByRole('button', { name: /ข้อต่อไป/ }).click();
  }
  page.once('dialog', (d) => d.accept());
  await pane(page).getByRole('button', { name: /ส่งคำตอบ/ }).click();
  await check();
  await page.emulateMedia({ colorScheme: 'dark' });
  await page.getByRole('button', { name: 'ทดลอง' }).click();
  await check();
  await shot(page, 'dark', info.project.name);
});
