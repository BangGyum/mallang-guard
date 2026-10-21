import assert from 'node:assert/strict';
import { chromium } from 'playwright';
import { drag, enterBattle, frame, pause, tilePoint } from './helpers.mjs';

const prefix = process.env.MALLANG_SCREENSHOT_PREFIX ?? 'defense';

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
    await page.clock.install({ time: new Date('2026-10-07T03:00:00Z') });
    await page.goto('http://127.0.0.1:43195/');
    await enterBattle(page);
    await page.clock.pauseAt(new Date('2026-10-07T03:02:00Z'));
    await frame(page);
    await pause(page);
    const cdp = mobile ? await context.newCDPSession(page) : null;
    if (cdp) {
      const box = await page.locator('[data-unit-id="squirrel"]').boundingBox();
      assert(box);
      await cdp.send('Input.dispatchTouchEvent', {
        type: 'touchStart',
        touchPoints: [{ x: box.x + 20, y: box.y + 20, id: 1 }],
      });
      await frame(page);
      await cdp.send('Input.dispatchTouchEvent', { type: 'touchCancel', touchPoints: [] });
      await frame(page);
    }
    await drag(page, cdp, 'squirrel', { x: 2, y: 0 });
    assert.equal(await page.locator('.aim-directions').isVisible(), true);
    await page.keyboard.press('ArrowLeft');
    await frame(page);
    await page.screenshot({ path: `docs/verification/${prefix}-${mobile ? 'mobile' : 'desktop'}-aim.png` });
    await page.keyboard.press('Escape');
    await frame(page);
    assert.equal(await page.locator('.aim-directions').isVisible(), false);
    assert.equal(await page.locator('.dp-panel strong').textContent(), '10');
    if (!mobile) {
      await page.locator('[data-unit-id="squirrel"]').focus();
      await page.keyboard.press('Enter');
      await frame(page);
      const center = await tilePoint(page, { x: 2, y: 0 });
      await page.mouse.click(center.x, center.y);
      await frame(page);
      await page.keyboard.press('ArrowLeft');
      await page.keyboard.press('Enter');
      await frame(page);
    } else {
      const first = await page.locator('[data-unit-id="squirrel"]').boundingBox();
      const second = await page.locator('[data-unit-id="mole"]').boundingBox();
      assert(first && second);
      const a = { x: first.x + 20, y: first.y + 20, id: 1 };
      const b = { x: second.x + 20, y: second.y + 20, id: 2 };
      await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [a] });
      await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [a, b] });
      const center = await tilePoint(page, { x: 2, y: 0 });
      await cdp.send('Input.dispatchTouchEvent', {
        type: 'touchMove',
        touchPoints: [{ ...center, id: 1 }, b],
      });
      await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
      await frame(page);
      await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ ...center, id: 1 }] });
      await cdp.send('Input.dispatchTouchEvent', {
        type: 'touchMove',
        touchPoints: [{ x: center.x - 80, y: center.y, id: 1 }],
      });
      await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
      await frame(page);
    }
    assert.equal(await page.locator('[data-unit-id="squirrel"]').isVisible(), false);
    assert.equal(await page.locator('[data-unit-id="mole"]').isVisible(), true);
    assert.equal(await page.locator('.dp-panel strong').textContent(), '1');
    assert.deepEqual(errors, []);
    console.log(`${mobile ? 'touch' : 'keyboard'}: 취소·조준·배치 검증 통과`);
    await context.close();
  }
} finally {
  await browser.close();
}
