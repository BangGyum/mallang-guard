import assert from 'node:assert/strict';
import { chromium } from 'playwright';

const browser = await chromium.launch({ channel: 'msedge', headless: true });
try {
  for (const viewport of [
    { width: 844, height: 390 },
    { width: 740, height: 360 },
  ]) {
    const page = await browser.newPage({ viewport, hasTouch: true, isMobile: true });
    const errors = [];
    page.on('pageerror', (error) => errors.push(error.message));
    await page.route('**/result-layout', (route) =>
      route.fulfill({
        contentType: 'text/html',
        body: '<meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="/src/ui/styles.css"><div id="app"><div id="screens"></div></div>',
      }),
    );
    await page.goto('http://127.0.0.1:43195/result-layout');
    await page.evaluate(async () => {
      await document.fonts.ready;
      const { createResultScreen } = await import('/src/ui/resultScreen.ts');
      createResultScreen(
        document.querySelector('#screens'),
        {
          won: true,
          life: 3,
          killed: 37,
          totalEnemies: 37,
          bestLife: 3,
          stars: 3,
        },
        { restart() {}, exit() {}, stages() {}, next() {} },
      );
    });
    const bounds = await page.locator('.battle-result').evaluate((dialog) => ({
      client: dialog.clientHeight,
      scroll: dialog.scrollHeight,
      buttons: [...dialog.querySelectorAll('button')].map((button) => ({
        width: button.offsetWidth,
        height: button.offsetHeight,
      })),
    }));
    await page.screenshot({ path: `docs/verification/t4.1-result-${viewport.width}.png` });
    console.log(JSON.stringify({ viewport, ...bounds, errors }));
    assert(bounds.scroll <= bounds.client + 1, '별과 결과 버튼을 스크롤 없이 표시');
    assert(bounds.buttons.every((button) => button.width >= 44 && button.height >= 44));
    assert.deepEqual(errors, []);
    await page.close();
  }
} finally {
  await browser.close();
}
