// Weather Station (PLAN §10, §12.1): every station runs its mission to the end with dropdowns, fits one
// screen (also sideways), works offline, and passes axe; then the questions and the score.
import { expect, test, type Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { dirname, resolve } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const base = pathToFileURL(resolve(__dirname, '../../dist/weather-station/index.html')).href;
const shot = (page: Page, name: string, projectName: string) =>
  page.screenshot({ path: resolve(__dirname, `../screenshots/weather/${projectName}-${name}.png`) });
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

test('home lists 6 experiments', async ({ page }, info) => {
  await page.goto(base);
  await expect(page.locator('.home-card')).toHaveCount(6);
  await axe(page);
  await shot(page, 'home', info.project.name);
});

test('Atmosphere Elevator', async ({ page }, info) => {
  const external: string[] = [];
  page.on('request', (r) => { if (!/^(file|data|blob):/.test(r.url())) external.push(r.url()); });
  await page.goto(`${base}?speed=8#atmosphere-elevator`);
  await expectOneScreen(page);
  await axe(page);
  const rows: [string, string][] = [
    ['ลดลง', 'เมฆ ฝน และเครื่องบินพาณิชย์'], ['คงที่แล้วเพิ่มขึ้น', 'ชั้นโอโซน'], ['ลดลง', 'ดาวตกลุกไหม้'], ['เพิ่มขึ้น', 'แสงออโรราและสถานีอวกาศ'],
  ];
  for (const [i, [trend, found]] of rows.entries()) {
    await press(page, '⬆ ขึ้นต่อ');
    await pick(page, trend);
    if (i === 1) await shot(page, 'elevator-record', info.project.name);
    await pick(page, found);
  }
  await expectOneScreen(page);
  await shot(page, 'elevator-done', info.project.name);
  await quizAndScore(page, info, 'elevator');
  expect(external).toEqual([]);
});

test('Sun Angle', async ({ page }, info) => {
  await page.goto(`${base}?speed=10#sun-angle`);
  await expectOneScreen(page);
  await pick(page, '100');
  await press(page, '☀ เปลี่ยนมุมแสง');
  await pick(page, '87');
  await press(page, '☀ เปลี่ยนมุมแสง');
  await shot(page, 'sun-angle-30', info.project.name);
  await pick(page, '50');
  await press(page, '☀ ให้แสงแดด 1 ชั่วโมง');
  for (const r of ['1', '2', '3', '4']) await pick(page, r);
  await press(page, '▶ เดินเวลา 24 ชั่วโมง');
  await pick(page, 'ประมาณ 14:00 (บ่าย)');
  await shot(page, 'sun-day', info.project.name);
  await pick(page, 'ประมาณ 06:00 (รุ่งเช้า)');
  await pick(page, 'แคบกว่าวันฟ้าโปร่ง');
  await expectOneScreen(page);
  await axe(page);
  await quizAndScore(page, info, 'sun');
});

test('Wind Maker', async ({ page }, info) => {
  await page.goto(`${base}?speed=6#wind-maker`);
  await expectOneScreen(page);
  await press(page, '☀ ดูตอนกลางวัน');
  for (const v of ['พื้นดิน', 'พื้นดิน', 'จากทะเลเข้าฝั่ง', 'ลมทะเล']) await pick(page, v);
  await shot(page, 'wind-day', info.project.name);
  await press(page, '🌙 ดูตอนกลางคืน');
  for (const v of ['พื้นน้ำ', 'พื้นน้ำ', 'จากฝั่งออกทะเล', 'ลมบก']) await pick(page, v);
  await press(page, '🗺 ดูแผนที่ความกดอากาศ');
  for (const v of ['H ไป L', 'แรงกว่า', 'ทิศที่ลมพัดมา']) await pick(page, v);
  await expectOneScreen(page);
  await axe(page);
  await shot(page, 'wind-map', info.project.name);
  await quizAndScore(page, info, 'wind');
});

test('Humidity Box', async ({ page }, info) => {
  await page.goto(`${base}?speed=8#humidity-box`);
  await expectOneScreen(page);
  await pick(page, '30.3');
  await pick(page, '50');
  await press(page, '❄ ทำให้เย็นลง 5 °C');
  await pick(page, '23.0');
  await pick(page, '66');
  await press(page, '❄ ทำให้เย็นลง 5 °C');
  await pick(page, '17.2');
  await pick(page, '88');
  await press(page, '❄ ทำให้เย็นลงจนเกิดหยดน้ำ');
  await pick(page, '18');
  await shot(page, 'humidity-dew', info.project.name);
  await pick(page, 'ไอน้ำควบแน่นเป็นหยดน้ำเกาะผนัง');
  await expectOneScreen(page);
  await axe(page);
  await quizAndScore(page, info, 'humidity');
});

test('Cloud Lift', async ({ page }, info) => {
  await page.goto(`${base}?speed=8#cloud-lift`);
  await expectOneScreen(page);
  await press(page, '🌬 ลมพัดอากาศขึ้นภูเขา');
  for (const v of ['1500', '15', 'ฝนไม่ตก']) await pick(page, v);
  await press(page, '🌬 ครั้งที่ 2: อากาศชื้นมาก');
  await pick(page, '500');
  await shot(page, 'cloud-wet', info.project.name);
  for (const v of ['25', 'ฝนตก']) await pick(page, v);
  await expectOneScreen(page);
  await axe(page);
  await quizAndScore(page, info, 'cloud');
});

test('Forecast Room', async ({ page }, info) => {
  await page.goto(`${base}#forecast-room`);
  await expectOneScreen(page);
  const rows: [string, string][] = [
    ['ความกดอากาศสูง (H)', 'อากาศเย็น ท้องฟ้าโปร่ง'], ['ความกดอากาศต่ำ (L)', 'ฝนตกชุกเกือบทั่วไป'],
    ['ความกดอากาศต่ำ (L)', 'ฝนตกหนักมาก ลมแรง'], ['ความกดอากาศต่ำ (L)', 'อากาศร้อนอบอ้าว อาจมีพายุฤดูร้อน'],
  ];
  for (const [i, [p, w]] of rows.entries()) {
    if (i > 0) await press(page, '▶ แผนที่ถัดไป');
    await pick(page, p);
    if (i === 2) await shot(page, 'forecast-storm', info.project.name);
    await pick(page, w);
  }
  await expectOneScreen(page);
  await axe(page);
  await quizAndScore(page, info, 'forecast');
});

test('teacher tool: class weather log from the sample data', async ({ page }) => {
  await page.goto(`${base}?teacher=1#forecast-room`);
  await page.getByRole('button', { name: /เครื่องมือครู/ }).click();
  await page.getByRole('button', { name: 'ใช้ข้อมูลตัวอย่าง' }).click();
  await expect(page.getByRole('dialog').getByRole('status')).toContainText('10 แถว');
  await expect(page.getByRole('dialog').getByRole('status')).toContainText('กฎอย่างง่ายเพื่อการเรียนรู้');
});
