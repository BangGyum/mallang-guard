import assert from 'node:assert/strict';
import { frame, pause, resume } from './helpers.mjs';
import { createShopAuditGame, shopPoint } from './shopScene.mjs';

export async function screenFlowContext(browser, width, height) {
  const touch = width < 1000;
  const context = await browser.newContext({ viewport: { width, height }, hasTouch: touch, isMobile: touch });
  await context.grantPermissions(['local-network-access']);
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => {
    if (['error', 'warning'].includes(m.type())) errors.push(m.text());
  });
  const time = new Date('2026-10-13T02:00:00Z');
  await page.clock.install({ time });
  await page.clock.pauseAt(new Date(time.getTime() + 1000));
  await page.addInitScript(() => {
    const frames = new Set();
    window.requestAnimationFrame = (cb) => {
      const id = setTimeout(() => {
        frames.delete(id);
        cb(performance.now());
      }, 100);
      frames.add(id);
      return id;
    };
    window.cancelAnimationFrame = (id) => {
      frames.delete(id);
      clearTimeout(id);
    };
    window.pendingGameFrames = () => frames.size;
  });
  await page.route('**/screen-flow-check', (route) =>
    route.fulfill({
      contentType: 'text/html; charset=utf-8',
      body: '<!doctype html><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="/src/ui/styles.css"><div id="app"></div>',
    }),
  );
  await page.goto('http://127.0.0.1:43195/screen-flow-check');
  await page.evaluate(createShopAuditGame, { nextStage: true });
  const click = async (locator) => {
    if (touch) await locator.tap();
    else await locator.click();
    await frame(page);
  };
  const read = () => page.evaluate(() => JSON.parse(localStorage.getItem('mallang-guard:v1')));
  const deploy = async (id) => {
    await pause(page);
    const point = await page.evaluate(shopPoint);
    const card = page.locator(`.deploy-card[data-unit-id="${id}"]`);
    await card.scrollIntoViewIfNeeded();
    if (width === 320) {
      const cdp = await context.newCDPSession(page),
        box = await card.boundingBox();
      await cdp.send('Input.dispatchTouchEvent', {
        type: 'touchStart',
        touchPoints: [{ x: box.x + box.width / 2, y: box.y + box.height / 2, id: 1 }],
      });
      await frame(page);
      await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ ...point, id: 1 }] });
      await frame(page);
      await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
      await cdp.detach();
    } else {
      await click(card);
      if (touch) await page.touchscreen.tap(point.x, point.y);
      else await page.mouse.click(point.x, point.y);
    }
    await frame(page);
    assert(await page.locator('.aim-directions').isVisible());
    await click(page.locator('[data-dir="down"]'));
    assert(await page.evaluate((id) => window.shopAudit.battle.state.units.some((u) => u.unitId === id), id));
  };
  const finish = async (saveFailure = false) => {
    if (!(await page.locator('.deploy-bar').isVisible()))
      await click(
        page.getByRole('button', {
          name: (await page.locator('.battle-result').isVisible()) ? '다시 하기' : '시작',
          exact: true,
        }),
      );
    await deploy('squirrel');
    if (saveFailure)
      await page.evaluate(() => {
        window.savedSetItem = Storage.prototype.setItem;
        Storage.prototype.setItem = () => {
          throw new Error('blocked');
        };
      });
    await resume(page);
    await click(page.locator('[data-action="start"]'));
    await frame(page, 20000);
    await page.locator('.battle-result').waitFor();
  };
  return { context, page, errors, click, read, deploy, finish };
}

export async function resultBounds(page) {
  return page.locator('.battle-result').evaluate((dialog) => {
    const box = dialog.getBoundingClientRect();
    const body = dialog.querySelector('.result-content')?.getBoundingClientRect() ?? box;
    const money = dialog.querySelector('.result-money')?.getBoundingClientRect();
    const buttons = [...dialog.querySelectorAll('button')].map((button) => {
      const r = button.getBoundingClientRect();
      return {
        name: button.textContent,
        visible: r.top >= box.top && r.bottom <= box.bottom && r.left >= box.left && r.right <= box.right,
        size: r.width >= 44 && r.height >= 44,
      };
    });
    return {
      fits: box.top >= 0 && box.bottom <= innerHeight,
      noDialogScroll: dialog.scrollHeight <= dialog.clientHeight + 1,
      moneyVisible: !money || (money.top >= body.top && money.bottom <= body.bottom),
      buttons,
    };
  });
}
