import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { chromium } from 'playwright';
import { deploy, frame, pause, resume, tilePoint } from './helpers.mjs';

const browser = await chromium.launch({ channel: 'msedge', headless: true });
const modes = process.argv.includes('--desktop')
  ? [false]
  : process.argv.includes('--mobile')
    ? [true]
    : [false, true];
const levels = process.argv.includes('--stage2') ? [2] : process.argv.includes('--stage6') ? [6] : [2, 6];
try {
  for (const mobile of modes) {
    for (const level of levels) {
      const scenario = JSON.parse(await readFile(`tests/scenarios/stage-${level}-clear.json`, 'utf8'));
      const context = await browser.newContext({
        viewport: mobile ? { width: 844, height: 390 } : { width: 1920, height: 1080 },
        hasTouch: mobile,
        isMobile: mobile,
      });
      await context.grantPermissions(['local-network-access']);
      const page = await context.newPage();
      const errors = [];
      let battleModule;
      page.on('request', (request) => {
        if (new URL(request.url()).pathname === '/src/sim/battle.ts') battleModule = request.url();
      });
      page.on('pageerror', (error) => errors.push(error.message));
      page.on('console', (message) => {
        if (['error', 'warning'].includes(message.type())) errors.push(message.text());
      });
      const time = new Date('2026-10-08T03:00:00Z');
      await page.clock.install({ time });
      await page.clock.pauseAt(time);
      await page.addInitScript((level) => {
        window.requestAnimationFrame = (callback) => setTimeout(() => callback(performance.now()), 100);
        window.cancelAnimationFrame = (id) => clearTimeout(id);
        if (!localStorage.getItem('mallang-guard:v1')) {
          const stages = {};
          for (let i = 1; i < level; i++) stages[`stage-${i}`] = { cleared: true, bestLife: 1 };
          localStorage.setItem('mallang-guard:v1', JSON.stringify({ version: 1, stages }));
        }
      }, level);
      await page.goto('http://127.0.0.1:43195/');
      await page.locator('.title-screen').waitFor();
      assert(battleModule);
      await page.evaluate(async (moduleUrl) => {
        const { Battle } = await import(moduleUrl);
        const step = Battle.prototype.step;
        window.expansionCheck = { battle: null, disruptions: 0, children: 0 };
        Battle.prototype.step = function () {
          const events = step.call(this);
          window.expansionCheck.battle = this;
          window.expansionCheck.disruptions += events.filter((event) => event.type === 'unitDisrupt').length;
          window.expansionCheck.children += events.filter(
            (event) => event.type === 'enemySpawn' && event.parentUid !== undefined,
          ).length;
          return events;
        };
      }, battleModule);
      const click = async (locator) => (mobile ? locator.tap() : locator.click());
      await click(page.getByRole('button', { name: '스테이지 선택', exact: true }));
      assert.equal(await page.locator('.stage-card').count(), 7);
      assert.equal(await page.locator('[data-stage-id="stage-1"] .stage-stars').textContent(), '★☆☆');
      if (level === 2) assert(await page.locator('[data-stage-id="stage-3"]').isDisabled());
      const label = `${mobile ? 'mobile' : 'desktop'}-${level}`;
      await page.screenshot({ path: `docs/verification/t4.1-${label}-select.png` });
      await click(page.locator(`.stage-card[data-stage-id="stage-${level}"]`));
      await frame(page);
      await pause(page);
      assert.equal(await page.locator('#app').getAttribute('data-stage-id'), `stage-${level}`);
      const cdp = mobile ? await context.newCDPSession(page) : null;
      const placed = new Map();
      let disruptionShown = false;
      for (const command of scenario.commands) {
        const target = Math.round(command.atSec * 30);
        let tick = await page.evaluate(() => window.expansionCheck.battle.state.tick);
        if (tick < target) {
          await resume(page);
          tick = await page.evaluate(() => window.expansionCheck.battle.state.tick);
          while (tick < target) {
            const remaining = ((target - tick) / 30) * 1000;
            await frame(page, level === 6 && !disruptionShown ? Math.min(600, remaining) : remaining);
            if (level === 6 && !disruptionShown) {
              const tile = await page.evaluate(() => {
                const state = window.expansionCheck.battle.state;
                return state.units.find((unit) => unit.disruptedUntilTick > state.tick)?.tile;
              });
              if (tile) {
                await pause(page);
                const point = await tilePoint(page, tile);
                if (mobile) await page.touchscreen.tap(point.x, point.y);
                else await page.mouse.click(point.x, point.y);
                await frame(page);
                assert(await page.locator('.unit-disruption').isVisible());
                assert.match(await page.locator('.unit-disruption').textContent(), /공격/);
                await page.locator('.unit-popup-card').evaluate(async (node) => {
                  await Promise.all(node.getAnimations().map((animation) => animation.finished));
                });
                const popupFits = await page.locator('.unit-panel').evaluate((panel) => {
                  const bounds = panel.getBoundingClientRect();
                  return [...panel.querySelectorAll('button')].every((button) => {
                    const rect = button.getBoundingClientRect();
                    return rect.height >= 44 && rect.top >= bounds.top && rect.bottom <= bounds.bottom;
                  });
                });
                assert(popupFits, '방해 상태 표시 중에도 스킬 팝업 버튼 전체 노출');
                await page.screenshot({ path: `docs/verification/t4.1-${label}-disruption.png` });
                disruptionShown = true;
                await click(page.locator('.unit-popup-close'));
                await resume(page);
              }
            }
            tick = await page.evaluate(() => window.expansionCheck.battle.state.tick);
          }
          await pause(page);
        }
        if (command.type === 'deploy') {
          const tile = { x: command.tile[0], y: command.tile[1] };
          await deploy(page, cdp, command.unitId, tile, command.dir);
          placed.set(command.unitId, tile);
        } else {
          for (let attempt = 0; attempt < 12; attempt++) {
            const point = await tilePoint(page, placed.get(command.unitId));
            if (mobile) await page.touchscreen.tap(point.x, point.y);
            else await page.mouse.click(point.x, point.y);
            await frame(page);
            if (!(await page.locator('.skill-button').isDisabled())) break;
            await click(page.locator('.unit-popup-close'));
            await resume(page);
            await frame(page, 300);
            await pause(page);
          }
          assert.equal(
            await page.locator('.skill-button').isDisabled(),
            false,
            `${label}: ${command.unitId} @ ${command.atSec}`,
          );
          if (await page.locator('.unit-disruption').isVisible()) disruptionShown = true;
          await click(page.locator('.skill-button'));
          await frame(page);
          await click(page.locator('.unit-popup-close'));
          await frame(page);
        }
      }
      await resume(page);
      await frame(page, 60000);
      assert.equal(await page.locator('.battle-result h2').textContent(), '방어 성공!');
      assert.equal(await page.locator('.result-stars').textContent(), '★★★');
      const details = await page.locator('.result-detail').textContent();
      const counters = await page.evaluate(() => ({
        disruptions: window.expansionCheck.disruptions,
        children: window.expansionCheck.children,
      }));
      if (level === 6) {
        assert(counters.disruptions > 0 && counters.children > 0);
        assert(disruptionShown);
        assert.equal(await page.getByRole('button', { name: '다음 스테이지', exact: true }).count(), 0);
      }
      const bounds = await page.locator('.battle-result').evaluate((dialog) => ({
        client: dialog.clientHeight,
        scroll: dialog.scrollHeight,
        buttons: [...dialog.querySelectorAll('button')].map((button) => ({
          width: button.offsetWidth,
          height: button.offsetHeight,
        })),
      }));
      assert(bounds.buttons.every((button) => button.width >= 44 && button.height >= 44));
      await page.screenshot({ path: `docs/verification/t4.1-${label}-clear.png` });
      assert(bounds.scroll <= bounds.client + 1, `결과 버튼을 스크롤 없이 표시: ${JSON.stringify(bounds)}`);
      const saved = await page.evaluate(() => JSON.parse(localStorage.getItem('mallang-guard:v1')));
      assert.deepEqual(saved.stages[`stage-${level}`], { cleared: true, bestLife: 3 });
      assert.deepEqual(saved.stages['stage-1'], { cleared: true, bestLife: 1 });
      if (level === 2) {
        await click(page.getByRole('button', { name: '다음 스테이지', exact: true }));
        await frame(page);
        assert.equal(await page.locator('#app').getAttribute('data-stage-id'), 'stage-3');
        assert.match(await page.locator('.stage-title small').textContent(), /방울 정원/);
      }
      await page.reload();
      await page.locator('.title-screen').waitFor();
      await click(page.getByRole('button', { name: '스테이지 선택', exact: true }));
      assert.equal(
        await page.locator(`.stage-card[data-stage-id="stage-${level}"] .stage-stars`).textContent(),
        '★★★',
      );
      if (level === 2)
        assert.equal(await page.locator('.stage-card[data-stage-id="stage-3"]').isDisabled(), false);
      assert.deepEqual(errors, []);
      console.log(
        JSON.stringify({
          viewport: label,
          result: details,
          ...counters,
          disruptionShown,
          saved: true,
          errors,
        }),
      );
      await context.close();
    }
  }
} finally {
  await browser.close();
}
