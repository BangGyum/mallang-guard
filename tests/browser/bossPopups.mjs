import assert from 'node:assert/strict';
import { writeFile } from 'node:fs/promises';
import { chromium } from 'playwright';
import { createBossPopupScene } from './bossPopupScene.mjs';

const prefix = process.env.MALLANG_SCREENSHOT_PREFIX ?? 't4.21-recheck';
const browser = await chromium.launch({ channel: 'msedge', headless: true });
const report = [];
try {
  for (const [width, height] of [
    [740, 360],
    [844, 390],
    [1920, 1080],
    [390, 844],
    [320, 568],
    [600, 400],
  ]) {
    const touch = width < 1000;
    const context = await browser.newContext({
      viewport: { width, height },
      hasTouch: touch,
      isMobile: touch,
    });
    await context.grantPermissions(['local-network-access']);
    const page = await context.newPage();
    const errors = [];
    page.on('pageerror', (error) => errors.push(error.message));
    page.on('console', (message) => {
      if (['warning', 'error'].includes(message.type())) errors.push(message.text());
    });
    const time = new Date('2026-10-12T03:00:00Z');
    await page.clock.install({ time });
    await page.clock.pauseAt(new Date(time.getTime() + 1000));
    await page.route('**/boss-popup-check', (route) =>
      route.fulfill({
        contentType: 'text/html; charset=utf-8',
        body: '<meta name="viewport" content="width=device-width, initial-scale=1"><link rel="stylesheet" href="/src/ui/styles.css"><div id="app"></div>',
      }),
    );
    await page.goto('http://127.0.0.1:43195/boss-popup-check');
    const click = async (locator) => {
      if (touch) await locator.tap();
      else await locator.click();
      await page.evaluate(() => window.bossPopupScene?.render());
    };
    const inspect = () =>
      page.evaluate(() => {
        const box = (selector) => document.querySelector(selector).getBoundingClientRect().toJSON();
        const boss = box('.boss-hud');
        const popup = box('.unit-panel:not([hidden]), .roster-panel:not([hidden])');
        const header = box('.battle-top');
        const bar = box('.deploy-bar');
        const heading = box('.boss-heading');
        const name = box('.boss-name');
        const hp = box('.boss-hp-value');
        const wave = box('.wave-notice');
        return {
          boss,
          popup,
          separated:
            boss.right <= popup.left ||
            popup.right <= boss.left ||
            boss.bottom <= popup.top ||
            popup.bottom <= boss.top,
          fits:
            boss.left >= 0 && boss.right <= innerWidth && boss.top >= header.bottom && boss.bottom <= bar.top,
          labelsFit: heading.left <= name.left && name.right < hp.left && hp.right <= heading.right,
          waveClear:
            wave.width === 0 ||
            wave.right <= popup.left ||
            popup.right <= wave.left ||
            wave.bottom <= popup.top ||
            popup.bottom <= wave.top,
          buttonsFit: [...document.querySelectorAll('.unit-panel:not([hidden]) button')].every((button) => {
            const bounds = button.getBoundingClientRect();
            return (
              bounds.top >= popup.top &&
              bounds.bottom <= popup.bottom &&
              bounds.width >= 44 &&
              bounds.height >= 44
            );
          }),
        };
      });
    const checks = [];
    const firstPoint = await page.evaluate(createBossPopupScene, { tile: { x: 9, y: 5 }, spawnAtSec: 1 });
    if (touch) await page.touchscreen.tap(firstPoint.x, firstPoint.y);
    else await page.mouse.click(firstPoint.x, firstPoint.y);
    await page.evaluate(() => {
      window.bossPopupScene.render();
      window.bossPopupScene.step(30);
    });
    const arrival = await inspect();
    assert(await page.locator('.wave-notice').isVisible());
    assert(
      arrival.separated && arrival.fits && arrival.waveClear,
      `선택 중 보스 등장 첫 프레임 ${JSON.stringify(arrival)}`,
    );
    for (const tile of [
      { x: 9, y: 5 },
      { x: 10, y: 6 },
      { x: 18, y: 5 },
      { x: 6, y: 5 },
      { x: 4, y: 8 },
      { x: 19, y: 8 },
    ]) {
      const point = await page.evaluate(createBossPopupScene, { tile });
      assert(await page.locator('.wave-notice').isVisible());
      if (touch) await page.touchscreen.tap(point.x, point.y);
      else await page.mouse.click(point.x, point.y);
      await page.evaluate(() => window.bossPopupScene.render());
      assert(
        await page.locator('.unit-panel').isVisible(),
        `${width}x${height}: 유닛 선택 ${JSON.stringify(tile)}`,
      );
      const duringWave = await inspect();
      if (tile.x === 9 && tile.y === 5) {
        await page.locator('.unit-popup-card').evaluate((card) => {
          for (const animation of card.getAnimations()) animation.finish();
        });
        await page.screenshot({ path: `docs/verification/${prefix}-${width}x${height}-boss-popup.png` });
      }
      assert(
        duringWave.separated &&
          duringWave.fits &&
          duringWave.labelsFit &&
          duringWave.buttonsFit &&
          duringWave.waveClear,
        JSON.stringify({ width, height, tile, duringWave }),
      );
      await page.clock.runFor(2000);
      await page.evaluate(() => window.bossPopupScene.render());
      const afterWave = await inspect();
      assert(
        afterWave.separated && afterWave.fits && afterWave.labelsFit && afterWave.buttonsFit,
        JSON.stringify({ width, height, tile, afterWave }),
      );
      await page.evaluate(() => window.bossPopupScene.step(900));
      assert.equal(await page.locator('.skill-button').isDisabled(), false);
      await click(page.locator('.skill-button'));
      await page.evaluate(() => window.bossPopupScene.step(1));
      assert.equal(await page.locator('.unit-panel').getAttribute('data-skill-state'), 'active');
      assert(await page.locator('.skill-notice[data-unit-id="squirrel"]').isVisible());
      const noticeLayout = await page.locator('.skill-notice').evaluate((notice) => {
        const a = notice.getBoundingClientRect();
        const b = document.querySelector('.boss-hud').getBoundingClientRect();
        return {
          notice: a.toJSON(),
          boss: b.toJSON(),
          clear: a.right <= b.left || b.right <= a.left || a.bottom <= b.top || b.bottom <= a.top,
        };
      });
      assert(
        noticeLayout.clear,
        `스킬 발동 알림 겹침 ${JSON.stringify({ width, height, tile, noticeLayout })}`,
      );
      if (tile.x === 9 && tile.y === 5 && [740, 320].includes(width))
        await page.screenshot({ path: `docs/verification/${prefix}-${width}x${height}-boss-skill.png` });
      await click(page.locator('.unit-popup-close'));
      const center = await page.locator('.boss-hud').evaluate((node) => {
        const box = node.getBoundingClientRect();
        return box.left + box.width / 2;
      });
      assert(Math.abs(center - width / 2) < 1, '창을 닫으면 보스 체력창 중앙 복원');
      await click(page.locator('.deploy-card[data-unit-id="owl"]'));
      const roster = await inspect();
      assert(
        roster.separated && roster.fits && roster.labelsFit,
        JSON.stringify({ width, height, tile, roster }),
      );
      await page.setViewportSize({ width: 740, height: 360 });
      await page.evaluate(() => window.bossPopupScene.render());
      const resized = await inspect();
      assert(
        resized.separated && resized.fits && resized.labelsFit,
        '정보창을 연 채 크기를 바꿔도 보스 표시 유지',
      );
      await page.setViewportSize({ width, height });
      await page.evaluate(() => window.bossPopupScene.render());
      assert.deepEqual(await page.evaluate(() => window.bossPopupScene.rejected), []);
      await click(page.locator('[data-action="exit"]'));
      assert.equal(await page.locator('.boss-hud, .unit-panel, .roster-panel, .skill-notice').count(), 0);
      checks.push({ tile, duringWave, afterWave, roster, resized, skill: true, exit: true });
    }
    assert.deepEqual(errors, []);
    report.push({ width, height, touch, arrival, checks, errors });
    console.log(JSON.stringify({ width, height, checks: checks.length, errors }));
    await context.close();
  }
  await writeFile(`docs/verification/${prefix}-boss-popups.json`, `${JSON.stringify(report, null, 2)}\n`);
} finally {
  await browser.close();
}
