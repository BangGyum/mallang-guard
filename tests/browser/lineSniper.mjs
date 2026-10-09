import assert from 'node:assert/strict';
import { writeFile } from 'node:fs/promises';
import { chromium } from 'playwright';
import { enterBattle, frame, pause, resume } from './helpers.mjs';
import { createLineSniperGame, lineSniperPoint } from './lineSniperScene.mjs';

const prefix = process.env.MALLANG_SCREENSHOT_PREFIX ?? 't4.7';
const report = [];
const browser = await chromium.launch({ channel: 'msedge', headless: true });
try {
  for (const mobile of [false, true]) {
    const label = mobile ? 'mobile' : 'desktop';
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
      if (['error', 'warning'].includes(message.type())) errors.push(message.text());
    });
    const time = new Date('2026-10-09T06:00:00Z');
    await page.clock.install({ time });
    await page.clock.pauseAt(new Date(time.getTime() + 1000));
    await page.addInitScript(() => {
      window.requestAnimationFrame = (callback) => setTimeout(() => callback(performance.now()), 100);
      window.cancelAnimationFrame = (id) => clearTimeout(id);
    });
    await page.route('**/line-sniper-check', (route) =>
      route.fulfill({
        contentType: 'text/html',
        body: '<meta name="viewport" content="width=device-width, initial-scale=1"><link rel="stylesheet" href="/src/ui/styles.css"><div id="app"></div>',
      }),
    );
    await page.goto('http://127.0.0.1:43195/line-sniper-check');
    const click = async (locator) => {
      if (mobile) await locator.tap();
      else await locator.click();
      await frame(page);
    };
    const read = () =>
      page.evaluate(() => {
        const { battle, batches, uiRange } = window.lineSniperAudit;
        const unit = battle.state.units.find((unit) => unit.unitId === 'wolf');
        return {
          tick: battle.state.tick,
          uiRange,
          skillState: unit?.skillState,
          batches: batches.length,
          volleys: batches
            .map((batch) => ({
              tick: batch.tick,
              shots: batch.events
                .filter((event) => event.type === 'attack' && event.src.uid === unit?.uid)
                .map((event) => event.dst.uid),
              damage: batch.events
                .filter((event) => event.type === 'damage' && event.src?.uid === unit?.uid)
                .map((event) => event.amount),
            }))
            .filter((batch) => batch.shots.length),
          rejected: batches.flatMap((batch) =>
            batch.events.filter((event) => event.type === 'commandRejected'),
          ),
        };
      });
    const select = async () => {
      const point = await page.evaluate(lineSniperPoint);
      if (mobile) await page.touchscreen.tap(point.x, point.y);
      else await page.mouse.click(point.x, point.y);
      await frame(page, 250);
      assert.equal(await page.locator('.unit-panel').getAttribute('data-unit-id'), 'wolf');
    };
    for (const count of [3, 1]) {
      await page.evaluate(createLineSniperGame, count);
      await page.locator('.title-screen').waitFor();
      assert.equal(await page.locator('.title-friend svg').count(), 10);
      await enterBattle(page, { waitForStart: false });
      await pause(page);
      if (mobile && count === 3) {
        await page.setViewportSize({ width: 740, height: 360 });
        await frame(page, 300);
      }
      assert.equal(await page.locator('.deploy-card').count(), 10);
      const cardsFit = await page.locator('.deploy-cards').evaluate((strip) => {
        const rect = strip.getBoundingClientRect();
        return [...strip.querySelectorAll('.deploy-card')].every((card) => {
          const bounds = card.getBoundingClientRect();
          const contentFits = [
            ...card.querySelectorAll('.card-portrait, .card-name, .card-role, .card-status'),
          ].every((part) => {
            const box = part.getBoundingClientRect();
            return (
              box.left >= bounds.left - 1 &&
              box.right <= bounds.right + 1 &&
              box.top >= bounds.top &&
              box.bottom <= bounds.bottom + 1 &&
              part.scrollWidth <= part.clientWidth + 1
            );
          });
          return (
            bounds.width >= 44 &&
            bounds.height >= 44 &&
            bounds.left >= rect.left &&
            bounds.right <= rect.right + 1 &&
            contentFits
          );
        });
      });
      assert(cardsFit, '10개 카드의 그림·이름·역할·상태가 잘리지 않고 터치 영역은 44px 이상으로 표시');
      if (count === 3)
        await page.screenshot({ path: `docs/verification/${prefix}-${label}-line-roster.png` });
      if (mobile) {
        await page.setViewportSize({ width: 844, height: 390 });
        await frame(page, 300);
      }
      const card = page.locator('.deploy-card[data-unit-id="wolf"]');
      const bounds = await card.boundingBox();
      const point = await page.evaluate(lineSniperPoint);
      assert(bounds);
      const from = { x: bounds.x + bounds.width / 2, y: bounds.y + bounds.height / 2 };
      if (mobile) {
        const cdp = await context.newCDPSession(page);
        await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ ...from, id: 1 }] });
        await frame(page);
        await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ ...point, id: 1 }] });
        await frame(page);
        await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
        await cdp.detach();
      } else {
        await page.mouse.move(from.x, from.y);
        await page.mouse.down();
        await frame(page);
        await page.mouse.move(point.x, point.y, { steps: 5 });
        await frame(page);
        await page.mouse.up();
      }
      await frame(page);
      assert(await page.locator('.aim-directions').isVisible());
      await click(page.locator('[data-dir="right"]'));
      await resume(page);
      await frame(page, 10500);
      await frame(page, 3000);
      await pause(page);
      await select();
      const base = await read();
      assert.equal(base.uiRange, 5);
      assert(base.volleys.length > 0 && base.volleys.every((batch) => batch.shots.length === 1));
      assert(base.volleys.every((batch) => batch.damage.length === 1 && batch.damage[0] === 600));
      assert.match(await page.locator('.unit-stats').textContent(), /공격력 650.*2\.40초/s);
      await page.screenshot({ path: `docs/verification/${prefix}-${label}-line-${count}-base.png` });
      await click(page.locator('.unit-popup-close'));
      await resume(page);
      await frame(page, 23000);
      await pause(page);
      await select();
      assert.equal((await read()).skillState, 'ready');
      assert.equal(await page.locator('.skill-button').isDisabled(), false);
      await click(page.locator('.skill-button'));
      const active = await read();
      assert.equal(active.uiRange, 15);
      assert.equal(active.skillState, 'active');
      assert.match(await page.locator('.unit-stats').textContent(), /공격력 585.*2\.40초/s);
      assert.match(
        await page.locator('.skill-notice[data-unit-id="wolf"]').textContent(),
        /랑랑.*삼중 조준/s,
      );
      const mark = active.volleys.length;
      await resume(page);
      let loops = 0;
      while ((await read()).volleys.length === mark) {
        assert(loops++ < 120, '선택 슬로모션을 포함해 다음 사격까지 진행');
        await frame(page, 100);
      }
      await pause(page);
      await select();
      const volley = (await read()).volleys[mark];
      assert.equal(volley.shots.length, count);
      assert.equal(new Set(volley.shots).size, count);
      assert.deepEqual(volley.damage, Array(count).fill(535));
      await page.screenshot({
        path: `docs/verification/${prefix}-${label}-line-${count}-volley.png`,
        animations: 'disabled',
      });
      await click(page.locator('.unit-popup-close'));
      await resume(page);
      let waiting = 0;
      while ((await read()).skillState === 'active') {
        assert(waiting++ < 20, '삼중 조준 종료까지 진행');
        await frame(page, 5000);
      }
      await pause(page);
      await select();
      const restored = await read();
      assert.equal(restored.uiRange, 5);
      assert.match(await page.locator('.unit-stats').textContent(), /공격력 650.*2\.40초/s);
      await page.screenshot({ path: `docs/verification/${prefix}-${label}-line-${count}-restored.png` });
      assert.deepEqual(restored.rejected, []);
      assert.deepEqual(errors, []);
      const result = {
        viewport: label,
        enemies: count,
        cardsFit,
        baseRange: base.uiRange,
        activeRange: active.uiRange,
        restoredRange: restored.uiRange,
        baseShots: 1,
        skillShots: volley.shots.length,
        targets: volley.shots,
        damage: volley.damage,
        attack: [650, 585, 650],
        intervalSec: 2.4,
        naturalCharge: true,
        rejected: restored.rejected,
        errors: [...errors],
      };
      report.push(result);
      console.log(JSON.stringify(result));
    }
    await context.close();
  }
  await writeFile(`docs/verification/${prefix}-line-sniper.json`, `${JSON.stringify(report, null, 2)}\n`);
} finally {
  await browser.close();
}
