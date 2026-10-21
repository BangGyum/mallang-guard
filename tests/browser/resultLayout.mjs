import assert from 'node:assert/strict';
import { writeFile } from 'node:fs/promises';
import { chromium } from 'playwright';
import { resultBounds } from './screenFlowScene.mjs';

const prefix = process.env.MALLANG_SCREENSHOT_PREFIX ?? 't4.25';
const browser = await chromium.launch({ channel: 'msedge', headless: true });
const report = [];
try {
  for (const [width, height] of [
    [1920, 1080],
    [844, 390],
    [740, 360],
    [600, 400],
    [540, 360],
    [390, 844],
    [320, 568],
  ]) {
    const page = await browser.newPage({
      viewport: { width, height },
      hasTouch: width < 1000,
      isMobile: width < 1000,
    });
    const errors = [];
    page.on('pageerror', (e) => errors.push(e.message));
    await page.route('**/result-layout', (route) =>
      route.fulfill({
        contentType: 'text/html; charset=utf-8',
        body: '<!doctype html><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="/src/ui/styles.css"><div id="app"><div id="screens"></div></div>',
      }),
    );
    await page.goto('http://127.0.0.1:43195/result-layout');
    for (const variant of ['won', 'lost', 'unsaved']) {
      await page.evaluate(async (variant) => {
        await document.fonts.ready;
        window.resultLayout?.dispose();
        const { createResultScreen } = await import('/src/ui/resultScreen.ts');
        const won = variant !== 'lost';
        window.resultLayout = createResultScreen(
          document.querySelector('#screens'),
          {
            won,
            life: won ? 3 : 0,
            killed: 498,
            totalEnemies: 498,
            bestLife: 3,
            stars: won ? 3 : 0,
            reward: {
              amount: won ? 2920 : 80,
              balance: 999999,
              firstClear: won,
              saved: variant !== 'unsaved',
            },
          },
          { restart() {}, exit() {}, stages() {}, shop() {}, ...(won ? { next() {} } : {}) },
        );
      }, variant);
      const bounds = await resultBounds(page);
      report.push({ viewport: `${width}x${height}`, variant, ...bounds, errors });
      await writeFile(
        `docs/verification/${prefix}-result-layout.json`,
        `${JSON.stringify(report, null, 2)}\n`,
      );
      await page.screenshot({
        path: `docs/verification/${prefix}-${width}x${height}-${variant}-result-layout.png`,
        animations: 'disabled',
      });
      assert(bounds.fits && bounds.noDialogScroll && bounds.moneyVisible, JSON.stringify(report.at(-1)));
      assert(
        bounds.buttons.every((b) => b.visible && b.size),
        JSON.stringify(report.at(-1)),
      );
      assert.deepEqual(errors, []);
    }
    console.log(JSON.stringify({ viewport: `${width}x${height}`, variants: 3, errors }));
    await page.close();
  }
} finally {
  await browser.close();
}
