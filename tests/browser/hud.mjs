import assert from 'node:assert/strict';
import { chromium } from 'playwright';
import { enterBattle, frame, pause, resume } from './helpers.mjs';

const prefix = process.env.MALLANG_SCREENSHOT_PREFIX
  ? `${process.env.MALLANG_SCREENSHOT_PREFIX}-hud`
  : 't2.3';

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
    page.on('console', (message) => {
      if (['warning', 'error'].includes(message.type())) errors.push(message.text());
    });
    const time = new Date('2026-10-07T03:00:00Z');
    await page.clock.install({ time });
    await page.clock.pauseAt(time);
    await page.addInitScript(() => {
      window.requestAnimationFrame = (callback) => setTimeout(() => callback(performance.now()), 100);
      window.cancelAnimationFrame = (id) => clearTimeout(id);
    });
    await page.goto('http://127.0.0.1:43195/');
    await enterBattle(page);
    await frame(page);
    await pause(page);
    const unavailable = page.locator('.deploy-card[data-unit-id="bunny"]');
    const card = await unavailable.boundingBox();
    assert(card);
    if (mobile) await page.touchscreen.tap(card.x + card.width / 2, card.y + card.height / 2);
    else await page.mouse.click(card.x + card.width / 2, card.y + card.height / 2);
    await frame(page);
    assert.equal(await page.locator('.toast').textContent(), '도토리가 부족해요');
    assert.equal(await page.locator('.aim-directions').isVisible(), false);
    assert.equal(await page.locator('.dp-panel strong').textContent(), '10');
    assert.equal(await unavailable.getAttribute('data-state'), 'noDp');
    assert.equal(
      await unavailable.locator('.card-cost').evaluate((node) => getComputedStyle(node).color),
      'rgb(182, 70, 78)',
    );
    await page.screenshot({ path: `docs/verification/${prefix}-${mobile ? 'mobile' : 'desktop'}.png` });
    await page.keyboard.press('2');
    await frame(page);
    assert.equal(await page.getByRole('button', { name: '전투 배속 변경' }).textContent(), '×2');
    await page.locator('[data-action="pause"]').focus();
    await page.keyboard.press('Space');
    await frame(page, 2000);
    await pause(page);
    assert.equal(await page.locator('.dp-panel strong').textContent(), '14');
    await page.keyboard.press('1');
    await frame(page);
    assert.equal(await page.getByRole('button', { name: '전투 배속 변경' }).textContent(), '×1');
    await resume(page);
    await frame(page, 22000);
    await pause(page);
    assert.equal(await page.locator('.battle-life').textContent(), '♥ 푸딩 1');
    assert.equal(await page.locator('.battle-life').getAttribute('class'), 'battle-life is-critical');
    assert.match(await page.locator('.battle-wave').textContent(), /WAVE 2\/5/);
    await page.screenshot({
      path: `docs/verification/${prefix}-${mobile ? 'mobile' : 'desktop'}-critical.png`,
    });
    assert.deepEqual(errors, []);
    console.log(JSON.stringify({ input: mobile ? 'touch' : 'mouse', hud: true, shortcuts: true, errors }));
    await context.close();
  }
} finally {
  await browser.close();
}
