// Course page dist/index.html: every lab, slide deck and worksheet opens from one place (PLAN §13 Phase 6).
import { expect, test, type Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { existsSync } from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { dirname, resolve } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const dist = resolve(__dirname, '../../dist');
const base = pathToFileURL(resolve(dist, 'index.html')).href;
const shot = (page: Page, name: string, projectName: string) =>
  page.screenshot({ path: resolve(__dirname, `../screenshots/hub/${projectName}-${name}.png`), fullPage: true });

test('course page links every lab, deck and worksheet to a real file', async ({ page }, info) => {
  const external: string[] = [];
  page.on('request', (r) => { if (!/^(file|data|blob):/.test(r.url())) external.push(r.url()); });
  await page.goto(base);
  await expect(page.locator('.chapter')).toHaveCount(4);
  await expect(page.locator('#U6C1 .btn:not(.off)')).toHaveText(/Weather Station/);
  await expect(page.locator('#U6C1 .soon')).toHaveCount(0);
  await expect(page.locator('#U6C2 .btn:not(.off)')).toHaveText(/Storm & Climate/);
  await expect(page.locator('#U6C2 .soon')).toHaveCount(0);
  const hrefs = await page.locator('a[href]').evaluateAll((as) => as.map((a) => a.getAttribute('href')!));
  const local = hrefs.filter((h) => !/^(https?:|#)/.test(h));
  expect(local.length).toBeGreaterThan(30);
  for (const h of local) expect(existsSync(resolve(dist, decodeURIComponent(h.split('#')[0]))), h).toBe(true);
  // Built chapters have a lab button and every lesson there has something to open.
  await expect(page.locator('#U5C1 .btn:not(.off)')).toHaveText(/Heat Lab/);
  await expect(page.locator('#U5C2 .btn:not(.off)')).toHaveText(/Heat Transfer Studio/);
  await expect(page.locator('#U5C1 .soon, #U5C2 .soon')).toHaveCount(0);
  const m = await page.evaluate(() => ({ w: document.documentElement.scrollWidth, inner: window.innerWidth }));
  expect(m.w).toBeLessThanOrEqual(m.inner + 1);
  await page.evaluate(() => document.fonts.ready);
  const axe = await new AxeBuilder({ page }).analyze();
  expect(axe.violations.filter((v) => v.impact === 'serious' || v.impact === 'critical').map((v) => v.id)).toEqual([]);
  await shot(page, 'page', info.project.name);
  expect(external).toEqual([]);
});

test('a lab link opens that experiment', async ({ page }) => {
  await page.goto(base);
  await page.locator('#U5C2 a.res.lab', { hasText: 'การแผ่รังสีความร้อน' }).click();
  await expect(page.locator('.lab-header h1')).toHaveText('การแผ่รังสีความร้อน');
});

test('QR sheet has one code per experiment', async ({ page }) => {
  await page.goto(pathToFileURL(resolve(dist, 'qr.html')).href);
  await expect(page.locator('.qr svg')).toHaveCount(18);
});
