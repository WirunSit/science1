// Storm & Climate (PLAN §11, §12.1): every station runs its mission to the end with dropdowns, fits one
// screen (also sideways), works offline, and passes axe; then the questions and the score.
import { expect, test, type Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { dirname, resolve } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const base = pathToFileURL(resolve(__dirname, '../../dist/storm-climate/index.html')).href;
const shot = (page: Page, name: string, projectName: string) =>
  page.screenshot({ path: resolve(__dirname, `../screenshots/storm/${projectName}-${name}.png`) });
const pane = (page: Page) => page.locator('.step-pane:not([hidden])');
const asking = (page: Page) => page.locator('.result-table td.asking select');
async function pick(page: Page, label: string) {
  await expect(asking(page)).toBeVisible({ timeout: 20_000 });
  await asking(page).selectOption({ label });
}
const press = async (page: Page, name: string | RegExp) => {
  const b = page.getByRole('button', { name });
  await expect(b).toBeEnabled({ timeout: 20_000 });
  await b.click();
};
async function expectOneScreen(page: Page) {
  const m = await page.evaluate(() => ({
    scroll: document.documentElement.scrollHeight, inner: window.innerHeight,
    scrollW: document.documentElement.scrollWidth, innerW: window.innerWidth,
  }));
  expect(m.scroll).toBeLessThanOrEqual(m.inner + 1);
  expect(m.scrollW).toBeLessThanOrEqual(m.innerW + 1);
  const right = await page.locator('.step-pane:not([hidden])').evaluate((el) => Math.max(el.getBoundingClientRect().right, el.scrollWidth));
  expect(right).toBeLessThanOrEqual(m.innerW + 1);
}
const axe = async (page: Page) => {
  await page.evaluate(() => document.fonts.ready);
  const result = await new AxeBuilder({ page }).analyze();
  const bad = result.violations.filter((v) => v.impact === 'serious' || v.impact === 'critical');
  expect(bad.map((v) => `${v.id}: ${v.nodes.map((n) => n.target).join(' ')}`)).toEqual([]);
};
async function quizAndScore(page: Page, info: { project: { name: string } }, station: string) {
  await page.getByRole('button', { name: 'ไปตอบคำถาม ›' }).click();
  await expectOneScreen(page);
  for (let i = 0; i < 5; i++) {
    await pane(page).locator('.quiz-choice').first().click();
    if (i < 4) await pane(page).getByRole('button', { name: /ข้อต่อไป/ }).click();
  }
  page.once('dialog', (d) => d.accept());
  await pane(page).getByRole('button', { name: /ส่งคำตอบ/ }).click();
  await expect(pane(page).locator('.score-big')).toHaveText(/\d \/ 5/);
  await expect(pane(page).locator('.review-check').first()).toContainText('ดูตารางของฉัน');
  await expectOneScreen(page);
  await shot(page, `${station}-score`, info.project.name);
}

test('home lists 3 experiments', async ({ page }, info) => {
  await page.goto(base);
  await expect(page.locator('.home-card')).toHaveCount(3);
  await axe(page);
  await shot(page, 'home', info.project.name);
});

test('Storm Builder', async ({ page }, info) => {
  const external: string[] = [];
  page.on('request', (r) => { if (!/^(file|data|blob):/.test(r.url())) external.push(r.url()); });
  await page.goto(`${base}?speed=8#storm-builder`);
  await expectOneScreen(page);
  await axe(page);
  const stages: [string, string][] = [
    ['อากาศยกตัวขึ้นเป็นส่วนใหญ่', 'ยังไม่มีฝน'], ['มีทั้งอากาศยกตัวและจมตัว', 'ฝนตกหนัก ฟ้าแลบ ลมกระโชกแรง'], ['อากาศจมตัวลงเป็นส่วนใหญ่', 'ฝนเบาลง'],
  ];
  for (const [i, [air, rain]] of stages.entries()) {
    await press(page, i === 0 ? '▶ ให้อากาศร้อนชื้นยกตัว' : '▶ ระยะต่อไป');
    await pick(page, air);
    if (i === 1) await shot(page, 'storm-mature', info.project.name);
    await pick(page, rain);
  }
  await press(page, '🌊 ผิวน้ำทะเล 25 °C');
  await pick(page, 'ไม่เกิดพายุ');
  await press(page, '🌊 ผิวน้ำทะเล 29 °C');
  await pick(page, 'เกิดพายุ');
  for (const cat of ['พายุดีเปรสชัน', 'พายุโซนร้อน', 'พายุไต้ฝุ่น']) {
    await press(page, '▶ ให้พายุเพิ่มกำลัง');
    await pick(page, cat);
  }
  await shot(page, 'storm-typhoon', info.project.name);
  await press(page, '▶ พายุเคลื่อนขึ้นฝั่ง');
  for (const v of ['อ่อนกำลังลง', 'ทวนเข็มนาฬิกา', 'ลมสงบ ท้องฟ้าค่อนข้างโปร่ง']) await pick(page, v);
  await expectOneScreen(page);
  await quizAndScore(page, info, 'storm');
  expect(external).toEqual([]);
});

test('Greenhouse Earth', async ({ page }, info) => {
  await page.goto(`${base}?speed=8#greenhouse-earth`);
  await expectOneScreen(page);
  await pick(page, '-18');
  for (const t of ['12', '14', '16', '17']) {
    await press(page, '▶ เปลี่ยนปริมาณ CO₂');
    await pick(page, t);
  }
  await shot(page, 'greenhouse-double', info.project.name);
  await press(page, '📈 ดูข้อมูลจริง');
  for (const v of ['427', 'เพิ่มขึ้น', '1.18', 'เพิ่มขึ้น']) await pick(page, v);
  await expect(page.locator('.source-note')).toContainText('NOAA');
  await expectOneScreen(page);
  await axe(page);
  await shot(page, 'greenhouse-data', info.project.name);
  await quizAndScore(page, info, 'greenhouse');
});

test('My Footprint', async ({ page }, info) => {
  await page.goto(`${base}#my-footprint`);
  await expectOneScreen(page);
  for (const v of ['10.0', '1.0', '1.9', '12.9', '3.3']) await pick(page, v);
  await page.getByLabel('เครื่องปรับอากาศ ต่อวัน').selectOption({ label: '1 ชม.' });
  await expect(page.locator('.foot-total')).toContainText('ของฉัน');
  await expectOneScreen(page);
  await axe(page);
  await shot(page, 'footprint-mine', info.project.name);
  await quizAndScore(page, info, 'footprint');
});
