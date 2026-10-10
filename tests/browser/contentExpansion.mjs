import assert from 'node:assert/strict';
import { readFile, writeFile } from 'node:fs/promises';
import { chromium } from 'playwright';
import { installCampaignAudit, skillRetryMs } from './campaignAudit.mjs';
import { deploy, finishBattle, frame, pause, resume, tilePoint } from './helpers.mjs';

const browser = await chromium.launch({ channel: 'msedge', headless: true });
const modes = process.argv.includes('--desktop')
  ? [false]
  : process.argv.includes('--mobile')
    ? [true]
    : [false, true];
const levels = process.argv.includes('--stage7')
  ? [7]
  : process.argv.includes('--stage2')
    ? [2]
    : process.argv.includes('--stage6')
      ? [6]
      : [2, 6, 7];
const rear = process.argv.includes('--rear');
const wide = process.argv.includes('--wide');
const line = process.argv.includes('--line');
const prefix = process.env.MALLANG_SCREENSHOT_PREFIX ?? 't4.4';
const report = [];
try {
  for (const mobile of modes) {
    for (const level of levels) {
      const variant = level === 7 ? (line ? '-line' : wide ? '-wide' : rear ? '-rear' : '') : '';
      const scenario = JSON.parse(
        await readFile(`tests/scenarios/stage-${level}${variant}-clear.json`, 'utf8'),
      );
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
        window.requestAnimationFrame = (callback) => setTimeout(() => callback(performance.now()), 33);
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
      await installCampaignAudit(page, battleModule);
      const click = async (locator) => (mobile ? locator.tap() : locator.click());
      await click(page.getByRole('button', { name: '스테이지 선택', exact: true }));
      assert.equal(await page.locator('.stage-card').count(), 7);
      assert.equal(await page.locator('[data-stage-id="stage-1"] .stage-stars').textContent(), '★☆☆');
      if (level === 2) assert(await page.locator('[data-stage-id="stage-3"]').isDisabled());
      const label = `${mobile ? 'mobile' : 'desktop'}-${level}${variant}`;
      await page.screenshot({ path: `docs/verification/${prefix}-${label}-select.png` });
      const card = page.locator(`.stage-card[data-stage-id="stage-${level}"]`);
      await card.scrollIntoViewIfNeeded();
      await frame(page);
      await click(card);
      await page.locator('[data-action="pause"]').waitFor();
      await frame(page);
      await pause(page);
      assert.equal(await page.locator('#app').getAttribute('data-stage-id'), `stage-${level}`);
      const cdp = mobile ? await context.newCDPSession(page) : null;
      const placed = new Map();
      let disruptionShown = false;
      for (const command of scenario.commands) {
        const target = Math.round(command.atSec * 30);
        let tick = await page.evaluate(() => window.campaign.battle.state.tick);
        if (tick < target) {
          await resume(page);
          if (await page.locator('.battle-preparation').isVisible()) await frame(page, 10000);
          tick = await page.evaluate(() => window.campaign.battle.state.tick);
          let frames = 0;
          while (tick < target) {
            assert(frames++ < 200, `${label}: ${target}틱까지 전투 시간이 진행되지 않음`);
            const remaining = ((target - tick) / 30) * 1000;
            // 가상 시계의 소수 밀리초 반올림으로 마지막 한 틱을 계속 기다리지 않게 한다.
            await frame(
              page,
              Math.max(34, Math.ceil(level >= 6 && !disruptionShown ? Math.min(600, remaining) : remaining)),
            );
            if (level >= 6 && !disruptionShown) {
              const tile = await page.evaluate(() => {
                const state = window.campaign.battle.state;
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
                  return [...panel.querySelectorAll('button')]
                    .filter((button) => button.getClientRects().length > 0)
                    .every((button) => {
                      const rect = button.getBoundingClientRect();
                      return rect.height >= 44 && rect.top >= bounds.top && rect.bottom <= bounds.bottom;
                    });
                });
                assert(popupFits, '방해 상태 표시 중에도 스킬 팝업 버튼 전체 노출');
                await page.screenshot({ path: `docs/verification/${prefix}-${label}-disruption.png` });
                disruptionShown = true;
                await click(page.locator('.unit-popup-close'));
                await resume(page);
              }
            }
            tick = await page.evaluate(() => window.campaign.battle.state.tick);
          }
          await pause(page);
        }
        if (command.type === 'deploy') {
          const tile = { x: command.tile[0], y: command.tile[1] };
          for (let attempt = 0; ; attempt++) {
            const check = await page.evaluate(
              ({ unitId, tile }) => window.campaign.battle.checkDeploy(unitId, tile),
              { unitId: command.unitId, tile },
            );
            if (check.ok) break;
            assert(attempt < 40 && ['noDp', 'notReady'].includes(check.reason), check.reason);
            await resume(page);
            await frame(page, 300);
            await pause(page);
          }
          await deploy(page, cdp, command.unitId, tile, command.dir);
          placed.set(command.unitId, tile);
          if (level === 7 && (placed.size === 7 || command.unitId === 'bear'))
            await page.screenshot({ path: `docs/verification/${prefix}-${label}-battle.png` });
        } else if (command.type === 'retreat') {
          const before = await page.evaluate(() => window.campaign.battle.state.dp);
          const point = await tilePoint(page, placed.get(command.unitId));
          if (mobile) await page.touchscreen.tap(point.x, point.y);
          else await page.mouse.click(point.x, point.y);
          await frame(page);
          await click(page.locator('.unit-retreat'));
          await frame(page);
          assert.equal(await page.evaluate(() => window.campaign.battle.state.dp), before);
          placed.delete(command.unitId);
        } else {
          // 공격 충전은 조작 시점에 따라 다음 적 무리까지 기다려야 할 수 있다.
          for (let attempt = 0; attempt < 80; attempt++) {
            const point = await tilePoint(page, placed.get(command.unitId));
            if (mobile) await page.touchscreen.tap(point.x, point.y);
            else await page.mouse.click(point.x, point.y);
            await frame(page);
            if (!(await page.locator('.skill-button').isDisabled())) break;
            const wait = await skillRetryMs(page, command.unitId);
            await click(page.locator('.unit-popup-close'));
            await resume(page, 1);
            await frame(page, wait);
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
          if (level === 7 && ['bear', 'owl', 'wolf'].includes(command.unitId))
            await page.screenshot({
              path: `docs/verification/${prefix}-${label}-skill.png`,
              animations: 'disabled',
            });
          await click(page.locator('.unit-popup-close'));
          await frame(page);
        }
      }
      await resume(page);
      await finishBattle(page);
      assert.equal(await page.locator('.battle-result h2').textContent(), '방어 성공!');
      assert.equal(await page.locator('.result-stars').textContent(), '★★★');
      const details = await page.locator('.result-detail').textContent();
      const counters = await page.evaluate(() => ({
        disruptions: window.campaign.disruptions,
        children: window.campaign.children,
        rejected: window.campaign.rejected,
        killed: window.campaign.battle.state.killed,
        total: window.campaign.battle.state.totalEnemies,
        leaked: window.campaign.battle.state.leaked,
        life: window.campaign.battle.state.life,
      }));
      assert.deepEqual(counters.rejected, []);
      assert.equal(counters.leaked, 0);
      assert.equal(counters.killed, counters.total);
      assert.equal(counters.life, 3);
      if (level >= 6) {
        assert(counters.disruptions > 0 && counters.children > 0);
        assert(disruptionShown);
      }
      assert.equal(
        await page.getByRole('button', { name: '다음 스테이지', exact: true }).count(),
        level === 7 ? 0 : 1,
      );
      const bounds = await page.locator('.battle-result').evaluate((dialog) => ({
        client: dialog.clientHeight,
        scroll: dialog.scrollHeight,
        buttons: [...dialog.querySelectorAll('button')].map((button) => ({
          width: button.offsetWidth,
          height: button.offsetHeight,
        })),
      }));
      assert(bounds.buttons.every((button) => button.width >= 44 && button.height >= 44));
      await page.screenshot({ path: `docs/verification/${prefix}-${label}-clear.png` });
      assert(bounds.scroll <= bounds.client + 1, `결과 버튼을 스크롤 없이 표시: ${JSON.stringify(bounds)}`);
      const saved = await page.evaluate(() => JSON.parse(localStorage.getItem('mallang-guard:v1')));
      assert.deepEqual(saved.stages[`stage-${level}`], { cleared: true, bestLife: 3 });
      assert.deepEqual(saved.stages['stage-1'], { cleared: true, bestLife: 1 });
      if (level < 7) {
        await click(page.getByRole('button', { name: '다음 스테이지', exact: true }));
        await frame(page);
        assert.equal(await page.locator('#app').getAttribute('data-stage-id'), `stage-${level + 1}`);
      }
      await page.reload();
      await page.locator('.title-screen').waitFor();
      await click(page.getByRole('button', { name: '스테이지 선택', exact: true }));
      assert.equal(
        await page.locator(`.stage-card[data-stage-id="stage-${level}"] .stage-stars`).textContent(),
        '★★★',
      );
      if (level < 7)
        assert.equal(
          await page.locator(`.stage-card[data-stage-id="stage-${level + 1}"]`).isDisabled(),
          false,
        );
      assert.deepEqual(errors, []);
      const result = {
        viewport: label,
        result: details,
        ...counters,
        disruptionShown,
        saved: true,
        errors,
      };
      report.push(result);
      console.log(JSON.stringify(result));
      await context.close();
    }
  }
  const run = `${levels.join('-')}${line ? '-line' : wide ? '-wide' : rear ? '-rear' : ''}${modes.length === 1 ? (modes[0] ? '-mobile' : '-desktop') : ''}`;
  await writeFile(`docs/verification/${prefix}-content-${run}.json`, `${JSON.stringify(report, null, 2)}\n`);
} finally {
  await browser.close();
}
