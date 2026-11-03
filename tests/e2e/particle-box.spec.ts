// Heat Lab station 1 — Particle Box (PLAN §8.1, §12.1): observe 3 states, heat, cool, record with
// dropdowns checked at once; questions; score. Also the app's list of experiments and teacher mode.
import { expect, test, type Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { dirname, resolve } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const base = pathToFileURL(resolve(__dirname, '../../dist/heat-lab/index.html')).href;
const url = `${base}#particle-box`;

const shot = (page: Page, name: string, projectName: string) =>
  page.screenshot({ path: resolve(__dirname, `../screenshots/heat-lab/${projectName}-particle-${name}.png`) });
const pane = (page: Page) => page.locator('.step-pane:not([hidden])');
const asking = (page: Page) => page.locator('.result-table td.asking select');
const pick = async (page: Page, label: string) => {
  await expect(asking(page)).toBeVisible({ timeout: 10_000 });
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

/** The whole mission: start reading, 3 states, heat once (50 °C), cool twice (10 °C). */
async function finishMission(page: Page) {
  await pick(page, '30');
  for (const v of ['ชิดกัน เป็นระเบียบ', 'สั่นอยู่กับที่', 'ชิดกัน ไม่เป็นระเบียบ', 'เลื่อนผ่านกันได้', 'ห่างกันมาก', 'เคลื่อนที่อิสระ']) await pick(page, v);
  await page.getByRole('button', { name: '🔥 ให้ความร้อน' }).click();
  for (const v of ['50', 'เร็วขึ้น', 'เท่าเดิม']) await pick(page, v);
  await page.getByRole('button', { name: '❄ ทำให้เย็นลง' }).click();
  await page.getByRole('button', { name: '❄ ทำให้เย็นลง' }).click();
  for (const v of ['10', 'ช้าลง', 'เท่าเดิม']) await pick(page, v);
}

test('app home lists the experiments and links to each', async ({ page }, info) => {
  await page.goto(base);
  await expect(page.locator('.home-card')).toHaveCount(4);
  await shot(page, 'home', info.project.name);
  // A hash change reloads the app (main.ts): wait for that load before checking the page.
  await Promise.all([page.waitForEvent('load'), page.locator('.home-card').first().click()]);
  await expect(page.locator('.lab-title')).toContainText('แบบจำลองอนุภาค');
  await Promise.all([page.waitForEvent('load'), page.getByRole('link', { name: /Heat Lab/ }).click()]);
  await expect(page.locator('.home-card')).toHaveCount(4);
});

test('step 1: observe, heat and cool, record with dropdowns', async ({ page }, info) => {
  const external: string[] = [];
  page.on('request', (r) => { if (!/^(file|data|blob):/.test(r.url())) external.push(r.url()); });
  await page.goto(url);
  await page.evaluate(() => document.fonts.ready);
  await expectOneScreen(page);
  for (const loc of [page.locator('.pboxes'), page.locator('.scale-zoom'), page.locator('.tables'), page.locator('.todo')]) {
    await expect(loc).toBeInViewport({ ratio: 0.99 });
  }
  // Heating is locked until the room-temperature observations are recorded.
  await expect(page.getByRole('button', { name: '🔥 ให้ความร้อน' })).toBeDisabled();
  await pick(page, '30');
  await pick(page, 'ชิดกัน เป็นระเบียบ');
  // A wrong observation turns the cell orange and asks again.
  await pick(page, 'อยู่นิ่ง');
  await expect(page.locator('.result-table td.wrong')).toHaveCount(1);
  await expect(page.locator('.todo')).toContainText('ยังไม่ถูก');
  await page.getByRole('button', { name: /ติดตาม/ }).click();
  await expect(page.getByRole('button', { name: /ติดตาม/ })).toHaveAttribute('aria-pressed', 'true');
  await shot(page, 'record', info.project.name);
  await pick(page, 'สั่นอยู่กับที่');
  for (const v of ['ชิดกัน ไม่เป็นระเบียบ', 'เลื่อนผ่านกันได้', 'ห่างกันมาก', 'เคลื่อนที่อิสระ']) await pick(page, v);
  await expect(page.locator('.mission li.done')).toHaveCount(1);
  await page.getByRole('button', { name: '🔥 ให้ความร้อน' }).click();
  await pick(page, '50');
  for (const v of ['เร็วขึ้น', 'เท่าเดิม']) await pick(page, v);
  await page.getByRole('button', { name: '❄ ทำให้เย็นลง' }).click();
  await page.getByRole('button', { name: '❄ ทำให้เย็นลง' }).click();
  for (const v of ['10', 'ช้าลง', 'เท่าเดิม']) await pick(page, v);
  await expect(page.locator('.mission')).toHaveText('✓ สังเกตครบแล้ว');
  await expect(page.getByRole('button', { name: 'ไปตอบคำถาม ›' })).toBeVisible();
  await expectOneScreen(page);
  await shot(page, 'done', info.project.name);

  // Reload keeps every recorded cell.
  await page.reload();
  await expect(page.locator('.mission')).toHaveText('✓ สังเกตครบแล้ว');
  await expect(page.locator('.tables')).toContainText('สั่นอยู่กับที่');
  expect(external).toEqual([]);
});

test('steps 2–3: questions, score, score card with both tables', async ({ page }, info) => {
  await page.goto(url);
  await finishMission(page);
  await page.getByRole('button', { name: 'ไปตอบคำถาม ›' }).click();
  await expect(pane(page).locator('.tables')).toBeVisible();
  await expectOneScreen(page);
  await shot(page, 'quiz', info.project.name);
  const picks = ['สั่นอยู่กับที่', 'แก๊ส', 'อนุภาคอยู่ชิดกันแต่ไม่เป็นระเบียบ', 'เคลื่อนที่เร็วขึ้น ขนาดเท่าเดิม', 'ความร้อนเป็นพลังงานที่ถ่ายโอน'];
  for (const [i, text] of picks.entries()) {
    await pane(page).locator('.quiz-choice', { hasText: text }).first().click();
    if (i < picks.length - 1) await pane(page).getByRole('button', { name: /ข้อต่อไป/ }).click();
  }
  page.once('dialog', (d) => d.accept());
  await pane(page).getByRole('button', { name: /ส่งคำตอบ/ }).click();
  await expect(pane(page).locator('.score-big')).toHaveText('5 / 5');
  await expect(pane(page).locator('.review-item').first()).toContainText('ของแข็ง · การเคลื่อนที่ = สั่นอยู่กับที่');
  await pane(page).getByLabel('ชื่อ–นามสกุล').fill('ทดสอบ ระบบ');
  await pane(page).getByLabel('เลขที่').fill('2');
  await expectOneScreen(page);
  await page.evaluate(() => { (navigator as unknown as { canShare: unknown }).canShare = undefined; });
  const [png] = await Promise.all([page.waitForEvent('download'), pane(page).getByRole('button', { name: /ส่งคะแนนให้ครู/ }).click()]);
  expect(png.suggestedFilename()).toMatch(/-2\.png$/);
  if (info.project.name === 'phone') await png.saveAs(resolve(__dirname, '../screenshots/heat-lab/particle-score-card.png'));
});

test('teacher mode: tools dialog, every step open, answer key shown', async ({ page }, info) => {
  await page.goto(`${base}?teacher=1#particle-box`);
  await expect(page.getByRole('button', { name: 'ตอบคำถาม' })).toBeEnabled();
  await page.getByRole('button', { name: /เครื่องมือครู/ }).click();
  await expect(page.getByRole('dialog')).toContainText('ตั้งอุณหภูมิอิสระ');
  await page.getByRole('button', { name: 'ปิด' }).click();
  await page.getByRole('button', { name: 'ตอบคำถาม' }).click();
  await expect(pane(page).locator('.key-tag')).toHaveText('✓ เฉลย');
  await shot(page, 'teacher', info.project.name);
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
  await finishMission(page);
  await page.getByRole('button', { name: 'ไปตอบคำถาม ›' }).click();
  await check();
  // A hash-only change reloads the app (main.ts), so go through a blank page.
  await page.goto('about:blank');
  await page.goto(base);
  await check();
  await page.emulateMedia({ colorScheme: 'dark' });
  await page.goto('about:blank');
  await page.goto(url);
  await check();
  await shot(page, 'dark', info.project.name);
});
