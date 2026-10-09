import assert from 'node:assert/strict';
import { writeFile } from 'node:fs/promises';
import { chromium } from 'playwright';
import { deploy, frame, pause, resume, tilePoint } from './helpers.mjs';

const prefix = process.env.MALLANG_SCREENSHOT_PREFIX ?? 't4.5';
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
    let moduleUrl;
    page.on('request', (request) => {
      if (new URL(request.url()).pathname === '/src/sim/battle.ts') moduleUrl = request.url();
    });
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
      const stages = {};
      for (let i = 1; i <= 6; i++) stages[`stage-${i}`] = { cleared: true, bestLife: 1 };
      localStorage.setItem('mallang-guard:v1', JSON.stringify({ version: 1, stages }));
    });
    await page.goto('http://127.0.0.1:43195/');
    await page.locator('.title-screen').waitFor();
    assert.equal(await page.locator('.title-friend svg').count(), 10);
    assert(moduleUrl);
    await page.evaluate(async (url) => {
      const { Battle } = await import(url);
      window.wideRange = { battle: null, uiRange: 0, rejected: [], starts: 0 };
      for (const name of ['step', 'flush']) {
        const original = Battle.prototype[name];
        Battle.prototype[name] = function (...args) {
          const events = original.apply(this, args);
          window.wideRange.battle = this;
          window.wideRange.rejected.push(...events.filter((event) => event.type === 'commandRejected'));
          window.wideRange.starts += events.filter(
            (event) => event.type === 'skillStart' && event.skillId === 'wideBarrage',
          ).length;
          return events;
        };
      }
      const original = Battle.prototype.rangeTilesFor;
      Battle.prototype.rangeTilesFor = function (...args) {
        const result = original.apply(this, args);
        if (args[0] === 'owl') window.wideRange.uiRange = result.length;
        return result;
      };
    }, moduleUrl);
    const click = async (locator) => (mobile ? locator.tap() : locator.click());
    await click(page.getByRole('button', { name: '스테이지 선택', exact: true }));
    const stage = page.locator('[data-stage-id="stage-7"]');
    await stage.scrollIntoViewIfNeeded();
    await frame(page);
    await click(stage);
    await frame(page);
    await pause(page);
    if (mobile) {
      await page.setViewportSize({ width: 740, height: 360 });
      await frame(page);
      await page.screenshot({ path: `docs/verification/${prefix}-compact-roster.png` });
      await frame(page);
    }
    const cardsFit = await page.locator('.deploy-cards').evaluate((strip) => {
      const bounds = strip.getBoundingClientRect();
      return [...strip.querySelectorAll('.deploy-card')].every((card) => {
        const rect = card.getBoundingClientRect();
        return rect.width >= 44 && rect.left >= bounds.left && rect.right <= bounds.right;
      });
    });
    assert(cardsFit, '작은 화면에서도 새 캐릭터를 포함한 10개 카드를 바로 선택할 수 있음');
    assert.equal(await page.locator('.deploy-card').count(), 10);
    const tile = { x: 9, y: 5 };
    const cdp = mobile ? await context.newCDPSession(page) : null;
    await deploy(page, cdp, 'owl', tile, 'right');
    const select = async () => {
      const point = await tilePoint(page, tile);
      if (mobile) await page.touchscreen.tap(point.x, point.y);
      else await page.mouse.click(point.x, point.y);
      await frame(page, 220);
      assert.equal(await page.locator('.unit-popup-name').textContent(), '밤밤');
    };
    const read = () =>
      page.evaluate(() => {
        const { battle, uiRange, rejected, starts } = window.wideRange;
        const unit = battle.state.units.find((unit) => unit.unitId === 'owl');
        return {
          tick: battle.state.tick,
          phase: battle.state.phase,
          uiRange,
          skillState: unit.skillState,
          sp: unit.sp,
          rejected,
          starts,
        };
      });
    await select();
    assert.equal((await read()).uiRange, 25);
    assert.match(await page.locator('.unit-stats').textContent(), /공격력 320.*마법/s);
    assert.match(await page.locator('.unit-stats').textContent(), /1\.80초.*대공 가능/s);
    assert.match(await page.locator('.skill-description').textContent(), /5×5.*10×10.*공격력 \+50%.*2배/);
    await page.screenshot({
      path: `docs/verification/${prefix}-${label}-wide-base.png`,
      animations: 'disabled',
    });
    await click(page.locator('.unit-popup-close'));
    await resume(page);
    await frame(page, 10000);
    await frame(page, 25000);
    await pause(page);
    assert.equal((await read()).skillState, 'ready');
    await select();
    assert.equal(await page.locator('.skill-button').isDisabled(), false);
    await click(page.locator('.skill-button'));
    await frame(page);
    const active = await read();
    assert.equal(active.skillState, 'active');
    assert.equal(active.uiRange, 100);
    assert.equal(active.starts, 1);
    assert.match(await page.locator('.unit-stats').textContent(), /공격력 480.*0\.90초/s);
    assert.equal(await page.locator('.skill-name').textContent(), '전면 포격');
    assert.match(await page.locator('.skill-notice[data-unit-id="owl"]').textContent(), /밤밤.*전면 포격/s);
    const buttonsFit = await page.locator('.unit-panel').evaluate((panel) => {
      const bounds = panel.getBoundingClientRect();
      return [...panel.querySelectorAll('button')]
        .filter((button) => button.getClientRects().length > 0)
        .every((button) => {
          const rect = button.getBoundingClientRect();
          return (
            rect.width >= 44 && rect.height >= 44 && rect.top >= bounds.top && rect.bottom <= bounds.bottom
          );
        });
    });
    assert(buttonsFit, '범위 확대 중에도 정보·스킬·후퇴 버튼 전체 노출');
    if (mobile) {
      await page.screenshot({
        path: `docs/verification/${prefix}-compact-wide-active.png`,
        animations: 'disabled',
      });
      await page.setViewportSize({ width: 844, height: 390 });
      await frame(page);
      await page.screenshot({
        path: `docs/verification/${prefix}-${label}-wide-active.png`,
        animations: 'disabled',
      });
      await frame(page);
    }
    await page.screenshot({
      path: `docs/verification/${prefix}-${label}-wide-active.png`,
      animations: 'disabled',
    });
    await resume(page);
    let waiting = 0;
    while ((await read()).skillState === 'active') {
      assert(waiting++ < 20, '선택 중 슬로모션을 포함해 스킬 종료 틱까지 진행');
      await frame(page, 5000);
    }
    await pause(page);
    const restored = await read();
    assert.equal(restored.phase, 'running');
    assert.equal(restored.skillState, 'charging');
    assert.equal(restored.uiRange, 25);
    assert.match(await page.locator('.unit-stats').textContent(), /공격력 320.*1\.80초/s);
    await page.screenshot({
      path: `docs/verification/${prefix}-${label}-wide-restored.png`,
      animations: 'disabled',
    });
    assert.deepEqual(restored.rejected, []);
    assert.deepEqual(errors, []);
    const result = {
      viewport: label,
      cardsFit,
      baseRange: 25,
      activeRange: active.uiRange,
      restoredRange: restored.uiRange,
      attack: [320, 480, 320],
      intervalSec: [1.8, 0.9, 1.8],
      buttonsFit,
      naturalCharge: true,
      rejected: restored.rejected,
      errors,
    };
    report.push(result);
    console.log(JSON.stringify(result));
    await context.close();
  }
  await writeFile(`docs/verification/${prefix}-wide-range.json`, `${JSON.stringify(report, null, 2)}\n`);
} finally {
  await browser.close();
}
