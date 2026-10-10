import assert from 'node:assert/strict';
import { readFile, writeFile } from 'node:fs/promises';
import { chromium } from 'playwright';
import { installCampaignAudit, skillRetryMs } from './campaignAudit.mjs';
import { deploy, frame, pause, resume, tilePoint } from './helpers.mjs';

const earlyOnly = process.argv.includes('--early');
const scenarios = await Promise.all(
  (earlyOnly ? [1, 2, 3] : [1, 2, 3, 4, 5, 6, 7]).map(async (level) => ({
    scenario: JSON.parse(await readFile(`tests/scenarios/stage-${level}-clear.json`, 'utf8')),
    stage: JSON.parse(await readFile(`src/data/stages/stage-${level}.json`, 'utf8')),
  })),
);
const modes = process.argv.includes('--desktop')
  ? [false]
  : process.argv.includes('--mobile')
    ? [true]
    : [false, true];
const report = [];
const prefix = process.env.MALLANG_SCREENSHOT_PREFIX ?? 't4.3';
const browser = await chromium.launch({ channel: 'msedge', headless: true });
try {
  for (const mobile of modes) {
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
    const time = new Date('2026-10-08T11:00:00Z');
    await page.clock.install({ time });
    await page.clock.pauseAt(new Date(time.getTime() + 1000));
    await page.addInitScript(() => {
      window.requestAnimationFrame = (callback) => setTimeout(() => callback(performance.now()), 33);
      window.cancelAnimationFrame = (id) => clearTimeout(id);
    });
    await page.goto('http://127.0.0.1:43195/');
    await page.locator('.title-screen').waitFor();
    assert(moduleUrl);
    await installCampaignAudit(page, moduleUrl);
    const click = async (locator) => (mobile ? locator.tap() : locator.click());
    const cdp = mobile ? await context.newCDPSession(page) : null;
    await click(page.getByRole('button', { name: '스테이지 선택', exact: true }));
    assert.equal(await page.locator('.stage-card').count(), 7);
    assert.equal(await page.locator('.stage-card:disabled').count(), 6);
    assert(
      await page
        .locator('.stage-stars')
        .evaluateAll((nodes) => nodes.every((node) => node.textContent === '☆☆☆')),
    );
    await click(page.locator('.stage-card[data-stage-id="stage-1"]'));
    await page.locator('.deploy-bar').waitFor();
    await page.locator('[data-action="pause"]').waitFor();
    await frame(page);
    for (const [index, { scenario, stage }] of scenarios.entries()) {
      await pause(page);
      assert.equal(await page.locator('#app').getAttribute('data-stage-id'), stage.id);
      assert.equal(await page.locator('.stage-title small').textContent(), stage.name);
      if (stage.id === 'stage-7') {
        await page.screenshot({ path: `docs/verification/${prefix}-${label}-large-map.png` });
        if (mobile) {
          await page.setViewportSize({ width: 740, height: 360 });
          await frame(page);
          await page.screenshot({ path: `docs/verification/${prefix}-compact-large-map.png` });
          await frame(page);
          await page.screenshot({ path: `docs/verification/${prefix}-compact-large-map.png` });
          await page.setViewportSize({ width: 844, height: 390 });
          await frame(page);
          await page.screenshot({ path: `docs/verification/${prefix}-${label}-large-map.png` });
          await frame(page);
        }
      }
      const placed = new Map();
      let pressureCaptured = false;
      const lateSec =
        Math.max(...stage.spawns.map((spawn) => spawn.atSec + (spawn.count - 1) * spawn.intervalSec)) * 0.7;
      for (const command of scenario.commands) {
        const target = Math.round(command.atSec * 30);
        let tick = await page.evaluate(() => window.campaign.battle.state.tick);
        if (tick < target) {
          await resume(page, 1);
          if (await page.locator('.battle-preparation').isVisible()) {
            await frame(page, 9000);
            while (await page.locator('.battle-preparation').isVisible()) await frame(page, 10);
          }
          tick = await page.evaluate(() => window.campaign.battle.state.tick);
          let frames = 0;
          while (tick < target) {
            assert(frames++ < 10, `${label}/${stage.id}: ${target}틱까지 전투 시간이 진행되지 않음`);
            // 가상 시계의 소수 밀리초 반올림으로 마지막 한 틱을 계속 기다리지 않게 한다.
            await frame(page, Math.max(34, Math.ceil(((target - tick) / 30) * 1000)));
            tick = await page.evaluate(() => window.campaign.battle.state.tick);
          }
          await pause(page);
        }
        if (!pressureCaptured && command.atSec >= lateSec) {
          const enemies = await page.evaluate(() => window.campaign.battle.state.enemies.length);
          if (enemies >= [6, 12, 12, 7, 8, 6, 9][Number(stage.id.slice(-1)) - 1]) {
            await page.screenshot({
              path: `docs/verification/${prefix}-${label}-${stage.id}-pressure.png`,
            });
            pressureCaptured = true;
          }
        }
        if (command.type === 'deploy') {
          const tile = { x: command.tile[0], y: command.tile[1] };
          for (let attempt = 0; ; attempt++) {
            const check = await page.evaluate(
              ({ unitId, tile }) => window.campaign.battle.checkDeploy(unitId, tile),
              { unitId: command.unitId, tile },
            );
            if (check.ok) break;
            assert(
              attempt < 40 && ['noDp', 'notReady'].includes(check.reason),
              `${label}/${stage.id}/${command.unitId}: ${check.reason}`,
            );
            await resume(page);
            await frame(page, 300);
            await pause(page);
          }
          await deploy(page, cdp, command.unitId, tile, command.dir);
          placed.set(command.unitId, tile);
          if (stage.id === 'stage-7' && command.unitId === 'cat')
            await page.screenshot({ path: `docs/verification/${prefix}-${label}-large-map-battle.png` });
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
            `${label}/${stage.id}: ${command.unitId} 스킬 준비`,
          );
          await click(page.locator('.skill-button'));
          await frame(page);
          if (stage.id === 'stage-7' && command.unitId === 'bear' && command.atSec > 120)
            await page.screenshot({ path: `docs/verification/${prefix}-${label}-large-map-skill.png` });
          await click(page.locator('.unit-popup-close'));
          await frame(page);
        }
      }
      await resume(page);
      const lastSpawn =
        Math.max(...stage.spawns.map((spawn) => spawn.atSec + (spawn.count - 1) * spawn.intervalSec)) +
        (stage.waveRepeat?.count - 1 || 0) * (stage.waveRepeat?.periodSec ?? 0);
      for (let seconds = 0; seconds <= lastSpawn + 300; seconds += 30) {
        if ((await page.evaluate(() => window.campaign.battle.state.phase)) !== 'running') break;
        await frame(page, 30000);
      }
      await frame(page, 1000);
      assert.equal(await page.locator('.battle-result h2').textContent(), '방어 성공!');
      assert.equal(await page.locator('.result-stars').textContent(), '★★★');
      const result = await page.evaluate(() => {
        const { state } = window.campaign.battle;
        return {
          phase: state.phase,
          life: state.life,
          killed: state.killed,
          leaked: state.leaked,
          totalEnemies: state.totalEnemies,
          wave: state.currentWave,
          totalWaves: state.totalWaves,
          enemies: state.enemies.length,
          seconds: state.tick / 30,
          rejected: window.campaign.rejected,
          seenEnemies: [...window.campaign.seen].sort(),
          heals: window.campaign.heals,
          shieldHits: window.campaign.shieldHits,
          rewards: window.campaign.rewards,
          invalidRewards: window.campaign.invalidRewards,
          latePressure: window.campaign.latePressure[window.campaign.battle.stage.definition.id],
        };
      });
      assert.equal(result.life, 3);
      assert.equal(result.leaked, 0);
      assert.equal(result.enemies, 0);
      assert.equal(result.killed, result.totalEnemies);
      assert.equal(
        result.wave,
        Math.max(...stage.spawns.map((spawn) => spawn.wave)) * (stage.waveRepeat?.count ?? 1),
      );
      assert.deepEqual(result.rejected, []);
      assert.deepEqual(result.invalidRewards, []);
      const records = await page.evaluate(() => JSON.parse(localStorage.getItem('mallang-guard:v1')).stages);
      assert.equal(Object.keys(records).length, index + 1);
      for (let i = 1; i <= index + 1; i++)
        assert.deepEqual(records[`stage-${i}`], { cleared: true, bestLife: 3 });
      await page.screenshot({ path: `docs/verification/${prefix}-${label}-${stage.id}-clear.png` });
      report.push({ viewport: label, stage: stage.id, ...result });
      console.log(JSON.stringify(report.at(-1)));
      if (index < scenarios.length - 1) {
        await click(page.getByRole('button', { name: '다음 스테이지', exact: true }));
        await page.locator('.deploy-bar').waitFor();
        await frame(page);
      } else
        assert.equal(
          await page.getByRole('button', { name: '다음 스테이지', exact: true }).count(),
          earlyOnly ? 1 : 0,
        );
    }
    const completed = await page.evaluate(() => JSON.parse(localStorage.getItem('mallang-guard:v1')).stages);
    assert.equal(await page.evaluate(() => window.campaign.seen.size), earlyOnly ? 10 : 16, '실제 적 종류');
    if (!earlyOnly) {
      assert((await page.evaluate(() => window.campaign.heals)) > 0, '실제 치유 발동');
      assert((await page.evaluate(() => window.campaign.shieldHits)) > 0, '실제 보호막 피해');
    }
    await click(page.getByRole('button', { name: '스테이지 선택', exact: true }));
    assert.equal(await page.locator('.stage-card:disabled').count(), earlyOnly ? 3 : 0);
    assert(
      await page
        .locator('.stage-stars')
        .evaluateAll(
          (nodes, count) =>
            nodes.every((node, index) => node.textContent === (index < count ? '★★★' : '☆☆☆')),
          scenarios.length,
        ),
    );
    await page.reload();
    await page.locator('.title-screen').waitFor();
    await click(page.getByRole('button', { name: '스테이지 선택', exact: true }));
    assert.equal(await page.locator('.stage-card:disabled').count(), earlyOnly ? 3 : 0);
    assert(
      await page
        .locator('.stage-stars')
        .evaluateAll(
          (nodes, count) =>
            nodes.every((node, index) => node.textContent === (index < count ? '★★★' : '☆☆☆')),
          scenarios.length,
        ),
    );
    await page.screenshot({ path: `docs/verification/${prefix}-${label}-all-stars.png` });
    await click(page.locator(`.stage-card[data-stage-id="${scenarios.at(-1).stage.id}"]`));
    await frame(page, 60000);
    assert.equal(await page.locator('.battle-result').getAttribute('data-result'), 'lost');
    assert.equal(await page.getByRole('button', { name: '다음 스테이지', exact: true }).count(), 0);
    assert.deepEqual(
      await page.evaluate(() => JSON.parse(localStorage.getItem('mallang-guard:v1')).stages),
      completed,
    );
    assert.deepEqual(errors, []);
    console.log(
      JSON.stringify({
        viewport: label,
        sequentialUnlock: true,
        reload: true,
        defeatPreservesBest: true,
        errors,
      }),
    );
    await context.close();
  }
  const run = modes.length === 1 ? (modes[0] ? '-mobile' : '-desktop') : '';
  await writeFile(`docs/verification/${prefix}-campaign${run}.json`, `${JSON.stringify(report, null, 2)}\n`);
} finally {
  await browser.close();
}
