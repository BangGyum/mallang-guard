import assert from 'node:assert/strict';
import { writeFile } from 'node:fs/promises';
import { chromium } from 'playwright';
import { frame, pause, resume } from './helpers.mjs';
import { createShopAuditGame, shopPoint, unluckyProfile } from './shopScene.mjs';

const prefix = process.env.MALLANG_SCREENSHOT_PREFIX ?? 't4.24';
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
    const touch = width !== 1920;
    const context = await browser.newContext({
      viewport: { width, height },
      hasTouch: touch,
      isMobile: touch,
    });
    await context.grantPermissions(['local-network-access']);
    const page = await context.newPage();
    const errors = [];
    page.on('pageerror', (e) => errors.push(e.message));
    page.on('console', (m) => {
      if (['error', 'warning'].includes(m.type())) errors.push(m.text());
    });
    const time = new Date('2026-10-13T01:00:00Z');
    await page.clock.install({ time });
    await page.clock.pauseAt(new Date(time.getTime() + 1000));
    await page.addInitScript(() => {
      window.requestAnimationFrame = (cb) => setTimeout(() => cb(performance.now()), 100);
      window.cancelAnimationFrame = (id) => clearTimeout(id);
    });
    await page.route('**/shop-flow', (route) =>
      route.fulfill({
        contentType: 'text/html; charset=utf-8',
        body: '<!doctype html><meta name="viewport" content="width=device-width, initial-scale=1"><link rel="stylesheet" href="/src/ui/styles.css"><div id="app"></div>',
      }),
    );
    await page.goto('http://127.0.0.1:43195/shop-flow');
    await page.evaluate(createShopAuditGame);
    const read = () => page.evaluate(() => JSON.parse(localStorage.getItem('mallang-guard:v1')));
    const click = async (locator) => {
      if (touch) await locator.tap();
      else await locator.click();
      await frame(page);
    };
    const openShop = () => click(page.getByRole('button', { name: '상점 · 모집', exact: true }));
    const cdp = touch ? await context.newCDPSession(page) : null;
    const deploy = async (id) => {
      const card = page.locator(`.deploy-card[data-unit-id="${id}"]`);
      const point = await page.evaluate(shopPoint);
      await card.scrollIntoViewIfNeeded();
      if (width === 320) {
        const box = await card.boundingBox();
        await cdp.send('Input.dispatchTouchEvent', {
          type: 'touchStart',
          touchPoints: [{ x: box.x + box.width / 2, y: box.y + box.height / 2, id: 1 }],
        });
        await frame(page);
        await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ ...point, id: 1 }] });
        await frame(page);
        await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
        await frame(page);
      } else if (touch) {
        await click(card);
        await page.touchscreen.tap(point.x, point.y);
        await frame(page);
      } else {
        await click(card);
        await page.mouse.click(point.x, point.y);
        await frame(page);
      }
      assert(await page.locator('.aim-directions').isVisible(), JSON.stringify({ width, height, point }));
      await click(page.locator('[data-dir="down"]'));
      const deployed = await page.evaluate(() => ({
        units: window.shopAudit.battle.state.units,
        phase: window.shopAudit.battle.state.phase,
        dp: window.shopAudit.battle.state.dp,
        events: window.shopAudit.events.slice(-12),
      }));
      assert(
        deployed.units.some((unit) => unit.unitId === id),
        JSON.stringify(deployed),
      );
    };
    const start = async () => {
      const fromResult = await page.locator('.battle-result').isVisible();
      await click(page.getByRole('button', { name: fromResult ? '다시 하기' : '시작', exact: true }));
      await pause(page);
    };
    const win = async () => {
      await start();
      await deploy('squirrel');
      await resume(page);
      await click(page.locator('[data-action="start"]'));
      await frame(page, 4000);
      assert.equal(await page.locator('.battle-result').getAttribute('data-result'), 'won');
    };
    assert.equal((await read()).collection.ownedUnits.length, 8);
    assert.equal((await read()).collection.money, 300);
    const titleBounds = await page.locator('.title-card').evaluate((n) => n.getBoundingClientRect().top);
    assert(titleBounds >= 0, '타이틀 상단 접근 가능');
    await openShop();
    assert.equal(await page.locator('.shop-owned-count').textContent(), '보유 8/13');
    assert(await page.locator('.recruit-ten').isDisabled());
    assert(await page.locator('.shop-unit[data-unit-id="owl"] .shop-buy').isDisabled());
    await click(page.locator('.shop-unit[data-unit-id="owl"] summary'));
    assert.match(
      await page.locator('.shop-unit[data-unit-id="owl"] .skill-details-body').textContent(),
      /5×5칸 → 주변 10×10칸/,
    );
    await click(page.locator('.shop-unit[data-unit-id="owl"] summary'));
    await page.locator('.shop-body').evaluate((n) => {
      n.scrollTop = 0;
    });
    const bounds = await page.locator('.recruit-single').evaluate((n) => ({
      ...n.getBoundingClientRect().toJSON(),
      scroll: document.documentElement.scrollWidth,
    }));
    if (height <= 500) assert(bounds.bottom <= height, `모집 버튼 첫 화면: ${bounds.bottom}/${height}`);
    assert(bounds.height >= 44 && bounds.scroll <= width);
    await page.screenshot({ path: `docs/verification/${prefix}-${width}x${height}-shop.png` });
    const beforeFailure = await read();
    await page.evaluate(() => {
      window.setItemBefore = Storage.prototype.setItem;
      Storage.prototype.setItem = () => {
        throw new Error('blocked');
      };
    });
    await click(page.locator('.recruit-single'));
    assert.equal(await page.locator('.recruit-dialog').count(), 0);
    assert.match(await page.locator('.shop-status').textContent(), /구매하지 않았어요/);
    assert.deepEqual(await read(), beforeFailure);
    await page.evaluate(() => {
      Storage.prototype.setItem = window.setItemBefore;
    });
    await click(page.locator('.shop-back'));
    await win();
    assert.equal((await read()).collection.money, 1020);
    assert.match(await page.locator('.result-money').textContent(), /720머니/);
    const completed = await read();
    await frame(page, 5000);
    assert.deepEqual(await read(), completed, '보상 1회 지급');
    await openShop();
    await click(page.locator('.shop-unit[data-unit-id="owl"] .shop-buy'));
    assert.equal(await page.locator('.recruit-result[data-new="true"]').count(), 1);
    await click(page.locator('.recruit-confirm'));
    assert.equal((await read()).collection.money, 420);
    assert((await read()).collection.ownedUnits.includes('owl'));
    await click(page.locator('.shop-back'));
    await start();
    assert.equal(await page.locator('.deploy-card').count(), 9);
    assert.equal(await page.locator('.deploy-card[data-unit-id="wolf"]').count(), 0);
    await deploy('owl');
    await click(page.locator('[data-action="exit"]'));
    assert.equal((await read()).collection.money, 420, '중도 나가기는 보상 없음');
    await win();
    assert.equal((await read()).collection.money, 740, '재도전 첫 보너스 재지급 없음');
    await openShop();
    await click(page.locator('.shop-unit[data-unit-id="wolf"] .shop-buy'));
    await click(page.locator('.recruit-confirm'));
    assert.equal((await read()).collection.money, 140);
    await click(page.locator('.recruit-single'));
    assert.equal(await page.locator('.recruit-result[data-new="false"]').count(), 1);
    assert.equal((await read()).collection.money, 70);
    await click(page.locator('.recruit-confirm'));
    assert(await page.locator('.recruit-single').isDisabled());
    const restored = await read();
    await page.reload();
    await page.evaluate(createShopAuditGame);
    assert.deepEqual(await read(), restored);
    await openShop();
    assert.equal(await page.locator('.shop-owned-count').textContent(), '보유 10/13');
    await page.evaluate(unluckyProfile);
    await page.evaluate(createShopAuditGame);
    await win();
    await openShop();
    await click(page.locator('.recruit-ten'));
    assert.equal(await page.locator('.recruit-result').count(), 10);
    assert.equal(await page.locator('.recruit-result[data-new="true"]').count(), 1);
    assert.equal(await page.locator('.recruit-guaranteed').count(), 1);
    const batch = await read();
    assert.equal(batch.collection.money, 290);
    assert.equal(batch.collection.pullsSinceNew, 0);
    assert.equal(batch.collection.ownedUnits.length, 9);
    const dialog = await page.locator('.recruit-dialog').evaluate((n) => {
      const box = n.getBoundingClientRect();
      const button = n.querySelector('button').getBoundingClientRect();
      return {
        fits: box.top >= 0 && box.bottom <= innerHeight,
        confirm: button.height >= 44 && button.bottom <= box.bottom,
        scroll: n.scrollHeight <= n.clientHeight + 1,
      };
    });
    assert(Object.values(dialog).every(Boolean), JSON.stringify(dialog));
    await page.screenshot({
      path: `docs/verification/${prefix}-${width}x${height}-ten-recruit.png`,
      animations: 'disabled',
    });
    await page.keyboard.press('Escape');
    assert.equal(await page.locator('.recruit-dialog').count(), 0);
    await page.evaluate(createShopAuditGame, { defeat: true });
    await start();
    await deploy('squirrel');
    await resume(page);
    await click(page.locator('[data-action="start"]'));
    await frame(page, 20000);
    assert.equal(await page.locator('.battle-result').getAttribute('data-result'), 'lost');
    assert.equal((await read()).collection.money, 292, '패배는 실제 1처치당 2머니');
    assert.equal((await read()).stages['stage-1'].bestLife, 3);
    await page.evaluate(() =>
      localStorage.setItem(
        'mallang-guard:v1',
        JSON.stringify({
          version: 1,
          settings: { speed: 2, quality: 'low' },
          stages: { 'stage-1': { cleared: true, bestLife: 3 } },
        }),
      ),
    );
    await page.evaluate(createShopAuditGame);
    const legacy = await read();
    assert.equal(legacy.collection.ownedUnits.length, 10);
    assert.equal(legacy.settings.speed, 2);
    assert.equal(legacy.stages['stage-1'].bestLife, 3);
    assert.deepEqual(errors, []);
    assert.deepEqual(
      await page.evaluate(() => window.shopAudit.events.filter((e) => e.type === 'commandRejected')),
      [],
    );
    report.push({
      viewport: `${width}x${height}`,
      firstClear: 720,
      repeatClear: 320,
      defeatReward: 2,
      purchase: 2,
      unlockedDeployment: true,
      storageRollback: true,
      duplicateRefund: 30,
      guaranteedBatch: true,
      legacy: true,
      reload: true,
      dialog,
      errors,
    });
    console.log(JSON.stringify(report.at(-1)));
    await context.close();
    await writeFile(`docs/verification/${prefix}-shop.json`, `${JSON.stringify(report, null, 2)}\n`);
  }
} catch (error) {
  for (const context of browser.contexts())
    for (const page of context.pages())
      await page.screenshot({ path: `docs/verification/${prefix}-shop-failure.png` }).catch(() => {});
  throw error;
} finally {
  await browser.close();
}
