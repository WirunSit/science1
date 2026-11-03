import { defineConfig } from '@playwright/test';

// Uses the Google Chrome installed on this machine (docs/decisions.md D-003).
export default defineConfig({
  testDir: 'tests/e2e',
  timeout: 60_000,
  reporter: [['list']],
  use: {
    channel: 'chrome',
    headless: true,
    locale: 'th-TH',
  },
  projects: [
    { name: 'phone', use: { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 } },
    // Small Android phone with Chrome's address bar taking its share of the screen (PLAN §0.7).
    { name: 'android', use: { viewport: { width: 360, height: 740 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 } },
    { name: 'tablet', use: { viewport: { width: 1280, height: 800 } } },
    { name: 'projector', use: { viewport: { width: 1920, height: 1080 } } },
  ],
});
