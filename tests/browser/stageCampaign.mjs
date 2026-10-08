import assert from 'node:assert/strict';
import { readFile, writeFile } from 'node:fs/promises';
import { chromium } from 'playwright';
import { deploy, frame, pause, resume, tilePoint } from './helpers.mjs';

const scenarios = await Promise.all(
  [1, 2, 3, 4, 5, 6].map(async (level) => ({
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
    await page.clock.pauseAt(time);
    await page.addInitScript(() => {
      window.requestAnimationFrame = (callback) => setTimeout(() => callback(performance.now()), 100);
      window.cancelAnimationFrame = (id) => clearTimeout(id);
    });
    await page.goto('http://127.0.0.1:43195/');
    await page.locator('.title-screen').waitFor();
    assert(moduleUrl);
    await page.evaluate(async (url) => {
      const { Battle } = await import(url);
      window.campaign = { battle: null, rejected: [] };
      for (const name of ['step', 'flush']) {
        const original = Battle.prototype[name];
        Battle.prototype[name] = function (...args) {
          const events = original.apply(this, args);
          window.campaign.battle = this;
          window.campaign.rejected.push(...events.filter((event) => event.type === 'commandRejected'));
          return events;
        };
      }
    }, moduleUrl);
    const click = async (locator) => (mobile ? locator.tap() : locator.click());
    const cdp = mobile ? await context.newCDPSession(page) : null;
    await click(page.getByRole('button', { name: '스테이지 선택', exact: true }));
    assert.equal(await page.locator('.stage-card').count(), 6);
    assert.equal(await page.locator('.stage-card:disabled').count(), 5);
    assert(
      await page
        .locator('.stage-stars')
        .evaluateAll((nodes) => nodes.every((node) => node.textContent === '☆☆☆')),
    );
    await click(page.locator('.stage-card[data-stage-id="stage-1"]'));
    await frame(page);
    for (const [index, { scenario, stage }] of scenarios.entries()) {
      await pause(page);
      assert.equal(await page.locator('#app').getAttribute('data-stage-id'), stage.id);
      assert.equal(await page.locator('.stage-title small').textContent(), stage.name);
      const placed = new Map();
      for (const command of scenario.commands) {
        const target = Math.round(command.atSec * 30);
        let tick = await page.evaluate(() => window.campaign.battle.state.tick);
        if (tick < target) {
          await resume(page);
          tick = await page.evaluate(() => window.campaign.battle.state.tick);
          let frames = 0;
          while (tick < target) {
            assert(frames++ < 10, `${label}/${stage.id}: ${target}틱까지 전투 시간이 진행되지 않음`);
            await frame(page, ((target - tick) / 30) * 1000);
            tick = await page.evaluate(() => window.campaign.battle.state.tick);
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
            `${label}/${stage.id}: ${command.unitId} 스킬 준비`,
          );
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
        };
      });
      assert.equal(result.life, 3);
      assert.equal(result.leaked, 0);
      assert.equal(result.enemies, 0);
      assert.equal(result.killed, result.totalEnemies);
      assert.equal(result.wave, Math.max(...stage.spawns.map((spawn) => spawn.wave)));
      assert.deepEqual(result.rejected, []);
      const records = await page.evaluate(() => JSON.parse(localStorage.getItem('mallang-guard:v1')).stages);
      assert.equal(Object.keys(records).length, index + 1);
      for (let i = 1; i <= index + 1; i++)
        assert.deepEqual(records[`stage-${i}`], { cleared: true, bestLife: 3 });
      await page.screenshot({ path: `docs/verification/t4.2-${label}-${stage.id}-clear.png` });
      report.push({ viewport: label, stage: stage.id, ...result });
      console.log(JSON.stringify(report.at(-1)));
      if (index < 5) {
        await click(page.getByRole('button', { name: '다음 스테이지', exact: true }));
        await frame(page);
      } else assert.equal(await page.getByRole('button', { name: '다음 스테이지', exact: true }).count(), 0);
    }
    const completed = await page.evaluate(() => JSON.parse(localStorage.getItem('mallang-guard:v1')).stages);
    await click(page.getByRole('button', { name: '스테이지 선택', exact: true }));
    assert.equal(await page.locator('.stage-card:disabled').count(), 0);
    assert(
      await page
        .locator('.stage-stars')
        .evaluateAll((nodes) => nodes.every((node) => node.textContent === '★★★')),
    );
    await page.reload();
    await page.locator('.title-screen').waitFor();
    await click(page.getByRole('button', { name: '스테이지 선택', exact: true }));
    assert.equal(await page.locator('.stage-card:disabled').count(), 0);
    assert(
      await page
        .locator('.stage-stars')
        .evaluateAll((nodes) => nodes.every((node) => node.textContent === '★★★')),
    );
    await page.screenshot({ path: `docs/verification/t4.2-${label}-all-stars.png` });
    await click(page.locator('.stage-card[data-stage-id="stage-6"]'));
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
  await writeFile('docs/verification/t4.2-campaign.json', `${JSON.stringify(report, null, 2)}\n`);
} finally {
  await browser.close();
}
