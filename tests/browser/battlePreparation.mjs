import assert from 'node:assert/strict';
import { writeFile } from 'node:fs/promises';
import { chromium } from 'playwright';
import { drag, enterBattle, frame, tilePoint } from './helpers.mjs';

const report = [];
const prefix = process.env.MALLANG_SCREENSHOT_PREFIX ?? 't3.10';
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
    const time = new Date('2026-10-08T13:00:00Z');
    await page.clock.install({ time });
    await page.clock.pauseAt(time);
    await page.addInitScript(() => {
      window.requestAnimationFrame = (callback) => setTimeout(() => callback(performance.now()), 100);
      window.cancelAnimationFrame = (id) => clearTimeout(id);
    });
    await page.goto('http://127.0.0.1:43195/');
    await page.locator('.title-screen').waitFor();
    await page.evaluate(async () => {
      const { Battle } = await import('/src/sim/battle.ts');
      const original = Battle.prototype.flush;
      Battle.prototype.flush = function (...args) {
        window.preparationBattle = this;
        return original.apply(this, args);
      };
    });
    const read = () =>
      page.evaluate(() => ({
        now: performance.now(),
        tick: window.preparationBattle.state.tick,
        dp: window.preparationBattle.state.dp,
        enemies: window.preparationBattle.state.enemies.length,
        units: window.preparationBattle.state.units,
      }));
    const click = async (locator) => {
      if (mobile) await locator.tap();
      else await locator.click();
      await frame(page);
    };
    const runUntil = async (start, ms) => {
      const remaining = ms - ((await read()).now - start);
      if (remaining > 0) await frame(page, remaining);
    };
    const restart = async () => {
      await click(page.locator('[data-action="pause"]'));
      const start = (await read()).now;
      await click(page.getByRole('button', { name: '다시 시작', exact: true }));
      assert.equal((await read()).tick, 0);
      assert.equal((await read()).dp, 10);
      assert.equal((await read()).units.length, 0);
      assert.match(await page.locator('.battle-countdown').textContent(), /10초/);
      return start;
    };
    const initialTime = await page.evaluate(() => performance.now());
    await enterBattle(page, { waitForStart: false });
    assert.equal((await read()).tick, 0);
    assert.equal((await read()).dp, 10);
    assert.equal((await read()).enemies, 0);
    assert.match(await page.locator('.battle-countdown').textContent(), /10초/);
    const cdp = mobile ? await context.newCDPSession(page) : null;
    await drag(page, cdp, 'squirrel', { x: 2, y: 0 });
    await click(page.locator('[data-dir="down"]'));
    const point = await tilePoint(page, { x: 2, y: 0 });
    if (mobile) await page.touchscreen.tap(point.x, point.y);
    else await page.mouse.click(point.x, point.y);
    await frame(page, 220);
    assert.equal(await page.locator('.unit-popup-name').textContent(), '토리');
    assert.match(await page.locator('.unit-stats').innerText(), /공격력 280[\s\S]*물리[\s\S]*지상 공격/);
    const initialSp = (await read()).units[0].sp;
    await click(page.getByRole('button', { name: '전투 배속 변경' }));
    await runUntil(initialTime, 9200);
    const waiting = await read();
    assert.equal(waiting.tick, 0);
    assert.equal(waiting.dp, 1);
    assert.equal(waiting.units[0].sp, initialSp);
    assert.equal(waiting.enemies, 0);
    const checkPanel = async () => {
      await page.locator('.unit-popup-card').evaluate(async (node) => {
        await Promise.all(node.getAnimations().map((animation) => animation.finished));
      });
      await frame(page);
      const layout = await page.evaluate(() => {
        const rect = (selector) => document.querySelector(selector).getBoundingClientRect().toJSON();
        return {
          panel: rect('.unit-panel'),
          skill: rect('.skill-name'),
          top: rect('.battle-top'),
          bar: rect('.deploy-bar'),
          width: innerWidth,
          buttons: [...document.querySelectorAll('.unit-popup-actions button')]
            .filter((button) => !button.hidden)
            .map((button) => button.getBoundingClientRect().toJSON()),
        };
      });
      assert(Math.abs(layout.width - 8 - layout.panel.right) < 1, '정보창은 오른쪽 고정');
      assert(
        Math.abs(layout.bar.top - 8 - layout.panel.bottom) < 1,
        `정보창은 배치 바 위에 고정: ${JSON.stringify(layout)}`,
      );
      assert(layout.panel.top >= layout.top.bottom + 7, '상단 바와 겹치지 않음');
      assert(layout.top.right <= layout.width, '작은 화면 상단 버튼 잘림 없음');
      assert(
        layout.skill.top >= layout.panel.top && layout.skill.bottom <= layout.panel.bottom,
        '스크롤 없이 스킬 이름 표시',
      );
      for (const button of layout.buttons) {
        assert(button.width >= 44 && button.height >= 44, '터치 영역 유지');
        assert(button.bottom <= layout.panel.bottom && button.top >= layout.panel.top, '버튼 전체 표시');
      }
      return layout;
    };
    const layout = await checkPanel();
    await page.screenshot({
      path: `docs/verification/${prefix}-${label}-preparation.png`,
      animations: 'disabled',
    });
    await runUntil(initialTime, 10400);
    assert((await read()).tick > 0);
    assert((await read()).units[0].sp > initialSp);
    assert.equal(await page.locator('.battle-preparation').isVisible(), false);
    await click(page.getByRole('button', { name: '캐릭터 정보 닫기' }));
    await frame(page, 2000);
    assert((await read()).enemies > 0, '기존 3초 스폰 일정부터 적 등장');

    await restart();
    const quickStart = (await read()).now;
    await click(page.locator('[data-action="start"]'));
    assert.match(await page.locator('.battle-countdown').textContent(), /3초/);
    assert.equal(await page.locator('[data-action="start"]').isEnabled(), false);
    await runUntil(quickStart, 1100);
    const beforePause = await page.locator('.battle-countdown').textContent();
    await click(page.locator('[data-action="pause"]'));
    await frame(page, 3000);
    assert.equal(await page.locator('.battle-countdown').textContent(), beforePause);
    assert.equal((await read()).tick, 0);
    assert.equal((await read()).dp, 10);
    const resumed = (await read()).now;
    await click(page.locator('#screens').getByRole('button', { name: '계속하기', exact: true }));
    await runUntil(resumed, 1700);
    assert.equal((await read()).tick, 0);
    await runUntil(resumed, 2100);
    assert((await read()).tick > 0, '3초 빠른 시작과 일시정지 시간 제외');
    assert.equal(await page.locator('.battle-preparation').isVisible(), false);

    const lateStart = await restart();
    await runUntil(lateStart, 8200);
    assert.equal((await read()).tick, 0);
    assert.equal(await page.locator('[data-action="start"]').isEnabled(), false, '남은 2초를 늘리지 않음');
    await runUntil(lateStart, 10400);
    assert((await read()).tick > 0);
    await restart();
    await drag(page, cdp, 'squirrel', { x: 2, y: 0 });
    await click(page.locator('[data-dir="down"]'));
    if (mobile) {
      await page.setViewportSize({ width: 740, height: 360 });
      await frame(page, 220);
    }
    const nextPoint = await tilePoint(page, { x: 2, y: 0 });
    if (mobile) await page.touchscreen.tap(nextPoint.x, nextPoint.y);
    else await page.mouse.click(nextPoint.x, nextPoint.y);
    await frame(page, 220);
    const compact = await checkPanel();
    await page.screenshot({ path: `docs/verification/${prefix}-${label}-info.png`, animations: 'disabled' });
    await click(page.locator('.unit-retreat'));
    assert.equal((await read()).units.length, 0);
    assert.equal(await page.locator('.unit-panel').isVisible(), false);
    assert.equal((await read()).tick, 0);
    await click(page.locator('[data-action="pause"]'));
    await click(page.getByRole('button', { name: '타이틀로', exact: true }));
    assert.equal(await page.locator('.title-screen').isVisible(), true);
    assert.equal(await page.locator('.battle-preparation').count(), 0);
    assert.deepEqual(errors, []);
    report.push({
      viewport: label,
      defaultStart: true,
      quickStart: true,
      pause: true,
      restart: true,
      layout,
      compact,
      errors,
    });
    console.log(`${label}: 10초·3초 시작, 정지·재시작·후퇴, 오른쪽 하단 정보 통과`);
    await context.close();
  }
  await writeFile(`docs/verification/${prefix}-preparation.json`, `${JSON.stringify(report, null, 2)}\n`);
} finally {
  await browser.close();
}
