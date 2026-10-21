import assert from 'node:assert/strict';
import { chromium } from 'playwright';
import { deploy, enterBattle, frame, tilePoint } from './helpers.mjs';

const browser = await chromium.launch({ channel: 'msedge', headless: true });
try {
  const context = await browser.newContext({
    viewport: { width: 844, height: 390 },
    hasTouch: true,
    isMobile: true,
  });
  await context.grantPermissions(['local-network-access']);
  const page = await context.newPage();
  const time = new Date('2026-10-07T03:00:00Z');
  await page.clock.install({ time });
  await page.clock.pauseAt(time);
  await page.addInitScript(() => {
    window.requestAnimationFrame = (callback) => setTimeout(() => callback(performance.now()), 100);
    window.cancelAnimationFrame = (id) => clearTimeout(id);
  });
  await page.goto('http://127.0.0.1:43195/');
  await enterBattle(page);
  const cdp = await context.newCDPSession(page);
  await deploy(page, cdp, 'squirrel', { x: 2, y: 0 }, 'down');
  await page.setViewportSize({ width: 740, height: 360 });
  await frame(page, 220);
  const point = await tilePoint(page, { x: 2, y: 0 });
  await page.touchscreen.tap(point.x, point.y);
  await frame(page, 220);
  await page.locator('.unit-popup-card').evaluate(async (node) => {
    await Promise.all(node.getAnimations().map((animation) => animation.finished));
  });
  const bounds = await page.evaluate(() => {
    const panel = document.querySelector('.unit-panel');
    return {
      panel: panel.getBoundingClientRect().toJSON(),
      card: document.querySelector('.unit-popup-card').getBoundingClientRect().toJSON(),
      buttons: [...document.querySelectorAll('.unit-popup-actions button')].map((node) =>
        node.getBoundingClientRect().toJSON(),
      ),
      scrollHeight: panel.scrollHeight,
    };
  });
  await page.screenshot({ path: 'docs/verification/v0.1-mobile-compact-popup.png' });
  console.log(JSON.stringify(bounds));
  for (const button of bounds.buttons) {
    assert(button.height >= 44 && button.width >= 44);
    assert(
      button.bottom <= bounds.panel.bottom && button.top >= bounds.panel.top,
      '작은 가로 화면에서 버튼 전체 노출',
    );
  }
} finally {
  await browser.close();
}
