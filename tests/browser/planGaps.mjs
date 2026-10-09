import assert from 'node:assert/strict';
import { chromium } from 'playwright';
import { deploy, enterBattle, frame, pause, tilePoint } from './helpers.mjs';

const browser = await chromium.launch({
  channel: 'msedge',
  headless: true,
  args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'],
});
try {
  for (const mobile of [false, true]) {
    const context = await browser.newContext({
      viewport: mobile ? { width: 844, height: 390 } : { width: 1920, height: 1080 },
      hasTouch: mobile,
      isMobile: mobile,
    });
    await context.grantPermissions(['local-network-access']);
    const page = await context.newPage();
    const errors = [];
    page.on('pageerror', (error) => errors.push(error.message));
    await page.clock.install();
    await page.goto('http://127.0.0.1:43195/');
    await enterBattle(page);
    await pause(page);
    assert.equal(await page.locator('.dp-panel .acorn-icon svg').count(), 1);
    assert.equal(await page.locator('.card-cost .acorn-icon svg').count(), 10);
    const cdp = mobile ? await context.newCDPSession(page) : null;
    const box = await page.locator('[data-unit-id="squirrel"]').boundingBox();
    const from = { x: box.x + box.width / 2, y: box.y + box.height / 2 };
    const to = { x: 42, y: mobile ? 135 : 180 };
    if (cdp) {
      await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ ...from, id: 1 }] });
      await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ ...to, id: 1 }] });
    } else {
      await page.mouse.move(from.x, from.y);
      await page.mouse.down();
      await page.mouse.move(to.x, to.y);
    }
    await frame(page);
    assert.equal(await page.locator('.drag-ghost svg').isVisible(), true);
    const label = mobile ? 'mobile' : 'desktop';
    await page.screenshot({ path: `docs/verification/t3.7-${label}-drag.png` });
    if (cdp) await cdp.send('Input.dispatchTouchEvent', { type: 'touchCancel', touchPoints: [] });
    else await page.mouse.up();
    await frame(page);
    assert.equal(await page.locator('.drag-ghost').isVisible(), false);
    await deploy(page, cdp, 'squirrel', { x: 2, y: 0 }, 'down');
    const point = await tilePoint(page, { x: 2, y: 0 });
    if (mobile) await page.touchscreen.tap(point.x, point.y);
    else await page.mouse.click(point.x, point.y);
    await frame(page);
    assert.equal(await page.locator('.unit-retreat .acorn-icon svg').count(), 1);
    assert.equal(await page.locator('.unit-retreat').getAttribute('aria-label'), '후퇴, 도토리 4개 환급');
    await page.screenshot({ path: `docs/verification/t3.7-${label}-popup.png` });
    assert.deepEqual(errors, []);
    console.log(JSON.stringify({ viewport: label, drag: true, acorn: true, errors }));
    await context.close();
  }
} finally {
  await browser.close();
}
