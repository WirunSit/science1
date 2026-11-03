// Heat Transfer Studio (PLAN §9, §12.1): every station runs its mission to the end with dropdowns,
// fits one screen (also sideways), works offline, and passes axe; then the questions and the score.
import { expect, test, type Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { dirname, resolve } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const base = pathToFileURL(resolve(__dirname, '../../dist/heat-transfer-studio/index.html')).href;
const shot = (page: Page, name: string, projectName: string) =>
  page.screenshot({ path: resolve(__dirname, `../screenshots/heat-transfer/${projectName}-${name}.png`) });
const pane = (page: Page) => page.locator('.step-pane:not([hidden])');
const asking = (page: Page) => page.locator('.result-table td.asking select');
async function pick(page: Page, label: string) {
  await expect(asking(page)).toBeVisible({ timeout: 20_000 });
  await asking(page).selectOption({ label });
}
/** For cells whose right value depends on the student's own choices: try each option until one is accepted. */
async function pickRight(page: Page) {
  await expect(asking(page)).toBeVisible({ timeout: 20_000 });
  // Hold on to this very cell: after a right pick the next cell's dropdown opens straight away.
  const cell = await page.locator('.result-table td.asking').elementHandle();
  const select = await page.locator('.result-table td.asking select').elementHandle();
  const labels = await asking(page).locator('option:not([disabled])').allTextContents();
  for (const label of labels) {
    await select!.selectOption({ label });
    if (!(await cell!.evaluate((el) => el.classList.contains('asking')))) return;
  }
  throw new Error('no option accepted');
}
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

test('home lists 5 experiments', async ({ page }, info) => {
  await page.goto(base);
  await expect(page.locator('.home-card')).toHaveCount(5);
  await axe(page);
  await shot(page, 'home', info.project.name);
});

test('Conduction Rod', async ({ page }, info) => {
  const external: string[] = [];
  page.on('request', (r) => { if (!/^(file|data|blob):/.test(r.url())) external.push(r.url()); });
  await page.goto(`${base}?speed=600#conduction-rod`);
  await expectOneScreen(page);
  await axe(page);
  await page.getByRole('button', { name: '🔥 เริ่มให้ความร้อน' }).click();
  for (const [order, kind] of [['1', 'ตัวนำความร้อน'], ['2', 'ตัวนำความร้อน'], ['3', 'ตัวนำความร้อน'], ['ไม่หลุด', 'ฉนวนความร้อน']]) {
    await pick(page, order);
    await pick(page, kind);
  }
  await expectOneScreen(page);
  await shot(page, 'rod-done', info.project.name);
  await quizAndScore(page, info, 'rod');
  expect(external).toEqual([]);
});

test('Convection Pot', async ({ page }, info) => {
  await page.goto(`${base}#convection-pot`);
  await expectOneScreen(page);
  await page.getByRole('button', { name: '🔥 ให้ความร้อนที่ก้น' }).click();
  await page.waitForTimeout(2500);
  await shot(page, 'pot-bottom', info.project.name);
  await pick(page, 'ลอยขึ้น');
  await pick(page, 'หมุนวนทั่วภาชนะ');
  await page.getByRole('button', { name: '🔥 ให้ความร้อนด้านบน' }).click();
  await pick(page, 'อยู่ด้านบน ไม่จมลง');
  await pick(page, 'แทบไม่หมุนวน');
  await expectOneScreen(page);
  await axe(page);
  await quizAndScore(page, info, 'pot');
});

test('Radiation Cans', async ({ page }, info) => {
  await page.goto(`${base}?speed=600#radiation-cans`);
  await expectOneScreen(page);
  await page.getByRole('button', { name: '💡 เปิดหลอดไฟ' }).click();
  for (const r of ['1', '2', '3', '4']) await pick(page, r);
  await shot(page, 'cans-absorb', info.project.name);
  await page.getByRole('button', { name: '♨ ใส่น้ำร้อน ปิดไฟ' }).click();
  // Painted cans of every colour give off heat radiation about equally well; only polished silver is slow.
  for (const r of ['เย็นลงเร็ว', 'เย็นลงเร็ว', 'เย็นลงเร็ว', 'เย็นลงช้า']) await pick(page, r);
  await expectOneScreen(page);
  await axe(page);
  await quizAndScore(page, info, 'cans');
});

test('Thermal Mixer', async ({ page }, info) => {
  await page.goto(`${base}#thermal-mixer`);
  await expectOneScreen(page);
  for (const final of ['44', '50', '24']) {
    await page.getByRole('button', { name: '🫗 เทผสม' }).click();
    await pick(page, final);
    if (final === '44') await shot(page, 'mixer-record', info.project.name);
    await pick(page, 'เท่ากัน');
  }
  await expectOneScreen(page);
  await axe(page);
  await quizAndScore(page, info, 'mixer');
});

test('Cool Box Designer', async ({ page }, info) => {
  await page.goto(`${base}#cool-box`);
  await expectOneScreen(page);
  await page.getByRole('button', { name: '▶ ทดสอบกล่อง' }).click();
  await pick(page, '45');
  await page.getByRole('button', { name: '▶ ทดสอบกล่อง' }).click();
  await pick(page, '170');
  await pick(page, 'นานกว่า');
  // My own design: foam 2 cm + air gap, foil outside.
  await page.getByLabel('ชั้นที่ 2 (นอก → ใน)').selectOption({ label: 'โฟม 2 cm (4 เหรียญ)' });
  await page.getByLabel('ผิวนอก').selectOption({ label: 'ฟอยล์อะลูมิเนียม (2 เหรียญ)' });
  await expectOneScreen(page);
  await shot(page, 'box-design', info.project.name);
  await page.getByRole('button', { name: '▶ ทดสอบกล่อง' }).click();
  await pickRight(page);
  await pickRight(page);
  await expect(page.locator('.mission')).toHaveText('✓ ทดสอบครบ 3 แบบแล้ว');
  await axe(page);
  await quizAndScore(page, info, 'box');
});
