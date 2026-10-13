import assert from 'node:assert/strict';
import { writeFile } from 'node:fs/promises';
import { chromium } from 'playwright';
import { frame, pause, resume } from './helpers.mjs';
import { createRareCombatScene, rareCombatPoint, readRareCombat, seedRareShopProfile } from './rareScene.mjs';
import { createShopAuditGame } from './shopScene.mjs';

const prefix = process.env.MALLANG_SCREENSHOT_PREFIX ?? 't4.26';
const browser = await chromium.launch({ channel: 'msedge', headless: true });
const report = [];
const tiles = { fox: { x: 3, y: 4 }, redPanda: { x: 3, y: 5 }, deer: { x: 3, y: 3 } };
try {
  for (const [width, height] of [
    [1920, 1080],
    [844, 390],
    [740, 360],
    [390, 844],
    [320, 568],
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
      if (['error', 'warning'].includes(message.type())) errors.push(message.text());
    });
    const time = new Date('2026-10-13T03:00:00Z');
    await page.clock.install({ time });
    await page.clock.pauseAt(new Date(time.getTime() + 1000));
    await page.addInitScript(() => {
      window.requestAnimationFrame = (callback) => setTimeout(() => callback(performance.now()), 100);
      window.cancelAnimationFrame = (id) => clearTimeout(id);
    });
    await page.route('**/rare-audit', (route) =>
      route.fulfill({
        contentType: 'text/html; charset=utf-8',
        body: '<meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="/src/ui/styles.css"><div id="app"></div>',
      }),
    );
    await page.goto('http://127.0.0.1:43195/rare-audit');
    const click = async (locator) => {
      if (touch) await locator.tap();
      else await locator.click();
      await frame(page);
    };
    const saved = () => page.evaluate(() => JSON.parse(localStorage.getItem('mallang-guard:v1')));
    await page.evaluate(seedRareShopProfile);
    await page.evaluate(createShopAuditGame);
    await click(page.getByRole('button', { name: '상점 · 모집', exact: true }));
    assert.equal(await page.locator('.shop-unit[data-rarity="rare"]').count(), 3);
    assert.equal(await page.locator('.shop-owned-count').textContent(), '보유 10/13');
    const before = (await saved()).collection;
    if (!touch) {
      await page.evaluate(() => {
        window.rareOriginalSetItem = Storage.prototype.setItem;
        Storage.prototype.setItem = () => {
          throw new Error('quota');
        };
      });
      await click(page.locator('[data-unit-id="fox"] .shop-buy'));
      assert.match(await page.locator('.shop-status').textContent(), /저장할 수 없어/);
      assert.deepEqual((await saved()).collection, before);
      await page.evaluate(() => {
        Storage.prototype.setItem = window.rareOriginalSetItem;
      });
    }
    for (const id of Object.keys(tiles)) {
      const card = page.locator(`.shop-unit[data-unit-id="${id}"]`);
      await click(card.locator('summary'));
      assert.match(await card.textContent(), /희귀/);
      assert.match(await card.locator('.shop-buy').textContent(), /1,800머니/);
      await click(card.locator('.shop-buy'));
      assert.equal(
        await page.locator('.recruit-result[data-rarity="rare"]').getAttribute('data-unit-id'),
        id,
      );
      await page.screenshot({ path: `docs/verification/${prefix}-${width}x${height}-${id}-recruit.png` });
      await click(page.locator('.recruit-confirm'));
      assert.equal(await card.locator('details').getAttribute('open'), '');
    }
    const after = (await saved()).collection;
    assert.equal(after.money, 600);
    assert.equal(after.ownedUnits.length, 13);
    assert.equal(after.rngState, before.rngState);
    assert.equal(after.pullsSinceNew, before.pullsSinceNew);
    await click(page.locator('.shop-rates summary'));
    const rates = await page.locator('.shop-rate-list').first().textContent();
    assert.match(rates, /루아.*1\.67%/);
    assert.match(rates, /로크.*1\.67%/);
    assert.match(rates, /세라.*1\.67%/);
    await page.screenshot({ path: `docs/verification/${prefix}-${width}x${height}-rare-shop.png` });
    await page.reload();
    await page.evaluate(createShopAuditGame);
    assert.deepEqual((await saved()).collection, after);
    await page.evaluate(createRareCombatScene);
    await click(page.getByRole('button', { name: '시작', exact: true }));
    await pause(page);
    const cdp = touch ? await context.newCDPSession(page) : null;
    for (const [id, tile] of Object.entries(tiles)) {
      const card = page.locator(`.deploy-card[data-unit-id="${id}"]`);
      assert.equal(await card.getAttribute('data-rarity'), 'rare');
      await card.scrollIntoViewIfNeeded();
      const box = await card.boundingBox();
      assert(box);
      const point = await page.evaluate(rareCombatPoint, tile);
      const from = { x: box.x + box.width / 2, y: box.y + box.height / 2 };
      if (touch) {
        await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ ...from, id: 1 }] });
        await frame(page);
        await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ ...point, id: 1 }] });
        await frame(page);
        await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
      } else {
        await page.mouse.move(from.x, from.y);
        await page.mouse.down();
        await frame(page);
        await page.mouse.move(point.x, point.y, { steps: 5 });
        await frame(page);
        await page.mouse.up();
      }
      await frame(page);
      assert(await page.locator('.aim-directions').isVisible(), `${id} 조준 실패`);
      await click(page.locator('[data-dir="right"]'));
    }
    assert.equal((await page.evaluate(readRareCombat)).dp, 14);
    await resume(page);
    await click(page.locator('[data-action="start"]'));
    await frame(page, 59000);
    await pause(page);
    const charged = await page.evaluate(readRareCombat);
    assert(charged.units.every((unit) => unit.skillState === 'ready'));
    assert.equal(charged.units.length, 3);
    assert(charged.bossShots > 0);
    assert(charged.chains > 0);
    for (const [id, tile] of Object.entries(tiles)) {
      const point = await page.evaluate(rareCombatPoint, tile);
      if (touch) await page.touchscreen.tap(point.x, point.y);
      else await page.mouse.click(point.x, point.y);
      await frame(page, 250);
      assert.equal(await page.locator('.unit-panel').getAttribute('data-unit-id'), id);
      await click(page.locator('.unit-panel summary'));
      assert(!(await page.locator('.skill-button').isDisabled()));
      await click(page.locator('.skill-button'));
      assert.equal(await page.locator('.unit-panel').getAttribute('data-skill-state'), 'active');
      assert.equal(await page.locator(`.skill-notice[data-unit-id="${id}"]`).count(), 1);
      const skillBounds = await page.locator('.skill-button').boundingBox();
      assert(
        skillBounds.width >= 44 && skillBounds.height >= 44 && skillBounds.y + skillBounds.height <= height,
      );
      await page.screenshot({ path: `docs/verification/${prefix}-${width}x${height}-${id}-skill.png` });
      await click(page.locator('.unit-popup-close'));
    }
    const active = await page.evaluate(readRareCombat);
    assert.equal(active.dp, 14);
    assert.deepEqual(active.starts.sort(), ['polarAim', 'siegeBarrage', 'stormChain']);
    await resume(page, 1);
    for (let frameCount = 0; frameCount < 35; frameCount++) {
      await frame(page, 100);
      if ((await page.evaluate(readRareCombat)).chains > active.chains) break;
    }
    await frame(page, 200);
    await pause(page);
    await page.screenshot({ path: `docs/verification/${prefix}-${width}x${height}-rare-battle.png` });
    const attacking = await page.evaluate(readRareCombat);
    assert(attacking.chains > active.chains);
    await resume(page);
    await frame(page, 13000);
    await pause(page);
    const ended = await page.evaluate(readRareCombat);
    assert.equal(ended.ends.length, 3);
    assert(ended.units.every((unit) => unit.skillState === 'charging' && unit.buffs.length === 0));
    for (const [id, tile] of Object.entries(tiles)) {
      const point = await page.evaluate(rareCombatPoint, tile);
      if (touch) await page.touchscreen.tap(point.x, point.y);
      else await page.mouse.click(point.x, point.y);
      await frame(page);
      await click(page.locator('.unit-retreat'));
      assert.equal((await page.evaluate(readRareCombat)).dp, 14);
      assert.equal(
        await page.locator(`.deploy-card[data-unit-id="${id}"]`).getAttribute('data-state'),
        'cooldown',
      );
    }
    assert.equal((await page.evaluate(readRareCombat)).units.length, 0);
    assert.deepEqual((await saved()).collection, after);
    assert.deepEqual(ended.rejected, []);
    assert.deepEqual(errors, []);
    report.push({
      width,
      height,
      profileMoney: 6000,
      purchased: Object.keys(tiles),
      balance: after.money,
      charged,
      active,
      attacking,
      ended,
      errors,
    });
    console.log(
      JSON.stringify({ width, height, bought: 3, skills: active.starts, chains: attacking.chains, errors }),
    );
    await context.close();
  }
  await writeFile(`docs/verification/${prefix}-rare-operatives.json`, `${JSON.stringify(report, null, 2)}\n`);
} finally {
  await browser.close();
}
