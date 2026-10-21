import assert from 'node:assert/strict';
import { writeFile } from 'node:fs/promises';
import { chromium } from 'playwright';
import { frame, pause, resume } from './helpers.mjs';
import { createRareCombatScene, rareCombatPoint } from './rareScene.mjs';
import { createShopAuditGame } from './shopScene.mjs';

const prefix = process.env.MALLANG_SCREENSHOT_PREFIX ?? 't4.28';
const browser = await chromium.launch({ channel: 'msedge', headless: true });
const report = [];
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
    const page = await context.newPage(),
      errors = [];
    page.on('pageerror', (error) => errors.push(error.message));
    page.on('console', (m) => {
      if (['error', 'warning'].includes(m.type())) errors.push(m.text());
    });
    const time = new Date('2026-10-15T07:30:00Z');
    await page.clock.install({ time });
    await page.clock.pauseAt(new Date(time.getTime() + 1000));
    await page.addInitScript(() => {
      window.requestAnimationFrame = (cb) => setTimeout(() => cb(performance.now()), 100);
      window.cancelAnimationFrame = (id) => clearTimeout(id);
    });
    await page.route('**/rarity-audit', (route) =>
      route.fulfill({
        contentType: 'text/html; charset=utf-8',
        body: '<meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="/src/ui/styles.css"><div id="app"></div>',
      }),
    );
    await page.goto('http://127.0.0.1:43195/rarity-audit');
    const click = async (locator) => {
      if (touch) await locator.tap();
      else await locator.click();
      await frame(page);
    };
    const saved = () => page.evaluate(() => JSON.parse(localStorage.getItem('mallang-guard:v1')));
    async function shop() {
      await page.evaluate(createShopAuditGame);
      await click(page.getByRole('button', { name: '상점 · 모집', exact: true }));
    }
    await page.evaluate(() => localStorage.clear());
    await shop();
    assert.equal(await page.locator('.shop-owned-count').textContent(), '보유 8/14');
    for (const [id, count] of [
      ['R', 5],
      ['SR', 5],
      ['SSR', 3],
      ['UR', 1],
    ])
      assert.equal(await page.locator(`.shop-unit[data-rarity="${id}"]`).count(), count);
    await click(page.locator('.shop-rates summary'));
    assert.match(await page.locator('.shop-rates').textContent(), /R 59%.*SR 35%.*SSR 5%.*UR 1%/);
    assert.match(await page.locator('.shop-rates').textContent(), /노바 · UR 1\.00%/);
    assert.match(await page.locator('.shop-rates').textContent(), /UR도 미보유 보장에 포함/);
    const seed = await page.evaluate(async () => {
      const { initialCollection } = await import('/src/data/recruitment.ts');
      const profile = JSON.parse(localStorage.getItem('mallang-guard:v1'));
      profile.collection = { ...initialCollection(undefined, 7, true), money: 3600, pullsSinceNew: 6 };
      profile.stages = { 'stage-1': { cleared: true, bestLife: 3 } };
      localStorage.setItem('mallang-guard:v1', JSON.stringify(profile));
      return profile;
    });
    await shop();
    const nova = page.locator('.shop-unit[data-unit-id="snowLeopard"]');
    await click(nova.locator('summary'));
    assert.match(await nova.textContent(), /보스 25%/);
    assert.match(await nova.textContent(), /1,?920/);
    assert.match(await nova.locator('.shop-buy').textContent(), /3,600/);
    if (!touch) {
      await page.evaluate(() => {
        window.originalStorage = Storage.prototype.setItem;
        Storage.prototype.setItem = () => {
          throw new Error('quota');
        };
      });
      await click(nova.locator('.shop-buy'));
      assert.match(await page.locator('.shop-status').textContent(), /저장할 수 없어/);
      assert.deepEqual((await saved()).collection, seed.collection);
      await page.evaluate(() => {
        Storage.prototype.setItem = window.originalStorage;
      });
    }
    await nova.scrollIntoViewIfNeeded();
    await page.screenshot({ path: `docs/verification/${prefix}-${width}x${height}-nova-shop.png` });
    await click(nova.locator('.shop-buy'));
    assert.equal(await page.locator('.recruit-result').getAttribute('data-rarity'), 'UR');
    assert.match(await page.locator('.recruit-result').textContent(), /노바/);
    await page.waitForTimeout(350);
    assert.equal(await page.locator('.recruit-result').evaluate((n) => getComputedStyle(n).opacity), '1');
    await page.screenshot({ path: `docs/verification/${prefix}-${width}x${height}-ur-recruit.png` });
    await click(page.locator('.recruit-confirm'));
    const bought = await saved();
    assert.equal(bought.collection.money, 0);
    assert.equal(bought.collection.rngState, 7);
    assert.equal(bought.collection.pullsSinceNew, 6);
    assert.deepEqual(bought.stages, seed.stages);
    await page.reload();
    await shop();
    assert.deepEqual((await saved()).collection, bought.collection);
    assert(await page.locator('[data-unit-id="snowLeopard"] .shop-buy').isDisabled());
    for (const mode of ['normal', 'guaranteed']) {
      await page.evaluate(async (mode) => {
        const { recruitment, initialCollection } = await import('/src/data/recruitment.ts');
        const { mulberry32 } = await import('/src/core/rng.ts');
        let rngState = 0;
        while (mulberry32(rngState).value < 0.99) rngState++;
        const profile = JSON.parse(localStorage.getItem('mallang-guard:v1'));
        profile.collection = {
          ...initialCollection(),
          money: 100,
          rngState,
          ownedUnits: recruitment.pool.filter((id) => id !== 'snowLeopard'),
          pullsSinceNew: mode === 'guaranteed' ? 9 : 0,
        };
        localStorage.setItem('mallang-guard:v1', JSON.stringify(profile));
      }, mode);
      await shop();
      await click(page.locator('.recruit-single'));
      assert.equal(await page.locator('.recruit-result').getAttribute('data-unit-id'), 'snowLeopard');
      assert.equal(await page.locator('.recruit-guaranteed').count(), mode === 'guaranteed' ? 1 : 0);
      await click(page.locator('.recruit-confirm'));
      assert.equal((await saved()).collection.ownedUnits.length, 14);
      assert.equal((await saved()).collection.money, 0);
    }
    await page.evaluate(createRareCombatScene);
    await click(page.getByRole('button', { name: '설정', exact: true }));
    await page.getByLabel('화면 품질').selectOption('low');
    await page.getByLabel('화면 품질').selectOption('high');
    await click(page.getByRole('button', { name: '완료', exact: true }));
    await click(page.getByRole('button', { name: '시작', exact: true }));
    await pause(page);
    const overlaps = await page.locator('.deploy-card').evaluateAll((cards) =>
      cards.flatMap((card) => {
        const cost = card.querySelector('.card-cost').getBoundingClientRect();
        const rank = card.querySelector('.card-rarity').getBoundingClientRect();
        return cost.right > rank.left
          ? [{ id: card.dataset.unitId, cost: cost.toJSON(), rank: rank.toJSON() }]
          : [];
      }),
    );
    assert.deepEqual(overlaps, [], '작은 카드의 비용과 등급이 겹치지 않음');
    const card = page.locator('.deploy-card[data-unit-id="snowLeopard"]');
    assert.equal(await card.getAttribute('data-rarity'), 'UR');
    await card.scrollIntoViewIfNeeded();
    await click(card);
    assert.match(await page.locator('.roster-panel').textContent(), /UR.*설표/s);
    assert.match(await page.locator('.roster-panel').textContent(), /40초/);
    await click(page.locator('.roster-close'));
    const box = await card.boundingBox(),
      point = await page.evaluate(rareCombatPoint, { x: 3, y: 4 });
    assert(box);
    const from = { x: box.x + box.width / 2, y: box.y + box.height / 2 };
    const cdp = touch ? await context.newCDPSession(page) : null;
    if (cdp) {
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
    await click(page.locator('[data-dir="right"]'));
    assert.equal(await card.isVisible(), false);
    assert.equal(await page.evaluate(() => window.shopAudit.battle.state.dp), 65);
    const unit = () => page.evaluate(() => structuredClone(window.shopAudit.battle.state.units[0]));
    await resume(page);
    await click(page.locator('[data-action="start"]'));
    await frame(page, 46000);
    await pause(page);
    assert.equal((await unit()).skillState, 'ready');
    const openUnit = async () => {
      if (touch) await page.touchscreen.tap(point.x, point.y);
      else await page.mouse.click(point.x, point.y);
      await frame(page);
      assert.equal(await page.locator('.unit-panel').getAttribute('data-unit-id'), 'snowLeopard');
    };
    await openUnit();
    await click(page.locator('.skill-button'));
    const active = await unit();
    assert(active.gravityCenter);
    assert.equal(active.skillState, 'active');
    assert.equal(await page.locator('.unit-panel').getAttribute('data-rarity'), 'UR');
    await page.screenshot({ path: `docs/verification/${prefix}-${width}x${height}-gravity-active.png` });
    // DOM 발동 알림의 실제 시간 등장 애니메이션이 끝난 뒤 보드를 비교합니다.
    await frame(page, 2200);
    const paused = await page.locator('#board').screenshot();
    const beforePause = await page.evaluate(() => structuredClone(window.shopAudit.battle.state));
    await frame(page, 1000);
    const afterPause = await page.locator('#board').screenshot();
    if (!afterPause.equals(paused)) {
      await writeFile(`docs/verification/${prefix}-pause-before.png`, paused);
      await writeFile(`docs/verification/${prefix}-pause-after.png`, afterPause);
      console.log(
        JSON.stringify({
          beforeTick: beforePause.tick,
          afterTick: await page.evaluate(() => window.shopAudit.battle.state.tick),
        }),
      );
    }
    assert(afterPause.equals(paused), '정지 중 보드 픽셀 변경');
    assert.deepEqual((await unit()).gravityCenter, active.gravityCenter);
    await click(page.locator('.unit-popup-close'));
    await resume(page);
    await frame(page, 2200);
    await pause(page);
    assert.deepEqual((await unit()).gravityCenter, active.gravityCenter);
    await resume(page);
    await frame(page, 1600);
    for (let step = 0; step < 20; step++) {
      if ((await unit()).skillState !== 'active') break;
      await frame(page, 100);
    }
    assert.equal((await unit()).skillState, 'charging');
    const bursts = await page.evaluate(() =>
      window.shopAudit.events.filter((e) => e.type === 'gravityField' && e.phase === 'burst'),
    );
    assert.equal(bursts.length, 1);
    await page.screenshot({ path: `docs/verification/${prefix}-${width}x${height}-gravity-burst.png` });
    await frame(page, 56000);
    await pause(page);
    assert.equal((await unit()).skillState, 'ready');
    await openUnit();
    await click(page.locator('.skill-button'));
    assert((await unit()).gravityCenter);
    await click(page.locator('.unit-retreat'));
    assert.equal(await page.evaluate(() => window.shopAudit.battle.state.units.length), 0);
    await resume(page);
    await frame(page, 5000);
    const audit = await page.evaluate(() => ({
      starts: window.shopAudit.events.filter((e) => e.type === 'gravityField' && e.phase === 'start').length,
      bursts: window.shopAudit.events.filter((e) => e.type === 'gravityField' && e.phase === 'burst').length,
      attacks: window.shopAudit.events.filter((e) => e.type === 'attack').length,
      rejected: window.shopAudit.events.filter((e) => e.type === 'commandRejected'),
      quality: JSON.parse(localStorage.getItem('mallang-guard:v1')).settings.quality,
    }));
    assert.equal(audit.starts, 2);
    assert.equal(audit.bursts, 1);
    assert(audit.attacks > 5);
    assert.deepEqual(audit.rejected, []);
    assert.equal(audit.quality, 'high');
    assert.deepEqual(errors, []);
    report.push({
      width,
      height,
      touch,
      directPrice: 3600,
      normalUrRoll: true,
      guaranteedUrRoll: true,
      restored: true,
      pausedPixels: true,
      audit,
      errors,
    });
    await page.evaluate(() => window.shopAudit.game.dispose());
    await context.close();
    console.log(JSON.stringify(report.at(-1)));
  }
  await writeFile(`docs/verification/${prefix}-rarity-nova.json`, `${JSON.stringify(report, null, 2)}\n`);
} finally {
  await browser.close();
}
