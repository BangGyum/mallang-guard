import assert from 'node:assert/strict';
import { readFile, writeFile } from 'node:fs/promises';
import { chromium } from 'playwright';
import { installCampaignAudit } from './campaignAudit.mjs';
import { deploy, finishBattle, frame, pause, resume } from './helpers.mjs';

const scenario = JSON.parse(await readFile('tests/scenarios/stage-4-no-skills.json', 'utf8'));
const prefix = process.env.MALLANG_SCREENSHOT_PREFIX ?? 't4.16';
const report = [];
const browser = await chromium.launch({ channel: 'msedge', headless: true });
try {
  for (const mobile of [false, true]) {
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
    const time = new Date('2026-10-10T00:00:00Z');
    await page.clock.install({ time });
    await page.clock.pauseAt(time);
    await page.addInitScript(() => {
      window.requestAnimationFrame = (callback) => setTimeout(() => callback(performance.now()), 100);
      window.cancelAnimationFrame = (id) => clearTimeout(id);
      const stages = {};
      for (let i = 1; i <= 3; i++) stages[`stage-${i}`] = { cleared: true, bestLife: 3 };
      localStorage.setItem('mallang-guard:v1', JSON.stringify({ version: 1, stages }));
    });
    await page.goto('http://127.0.0.1:43195/');
    await page.locator('.title-screen').waitFor();
    assert(moduleUrl);
    await installCampaignAudit(page, moduleUrl);
    const click = async (locator) => (mobile ? locator.tap() : locator.click());
    await click(page.getByRole('button', { name: '스테이지 선택', exact: true }));
    await click(page.locator('.stage-card[data-stage-id="stage-4"]'));
    await page.locator('[data-action="pause"]').waitFor();
    await frame(page);
    await pause(page);
    const saved = await page.evaluate(() => JSON.parse(localStorage.getItem('mallang-guard:v1')).stages);
    const cdp = mobile ? await context.newCDPSession(page) : null;
    for (const command of scenario.commands) {
      const target = Math.round(command.atSec * 30);
      let tick = await page.evaluate(() => window.campaign.battle.state.tick);
      if (tick < target) {
        await resume(page);
        if (await page.locator('.battle-preparation').isVisible()) await frame(page, 10000);
        for (let attempt = 0; tick < target; attempt++) {
          assert(attempt < 10, '배치 시각까지 전투 진행');
          tick = await page.evaluate(() => window.campaign.battle.state.tick);
          if (tick < target) await frame(page, Math.max(100, Math.ceil(((target - tick) / 30) * 1000)));
          tick = await page.evaluate(() => window.campaign.battle.state.tick);
        }
        await pause(page);
      }
      const tile = { x: command.tile[0], y: command.tile[1] };
      for (let attempt = 0; ; attempt++) {
        const check = await page.evaluate(
          ({ unitId, tile }) => window.campaign.battle.checkDeploy(unitId, tile),
          { unitId: command.unitId, tile },
        );
        if (check.ok) break;
        assert(attempt < 40 && check.reason === 'noDp', check.reason);
        await resume(page);
        await frame(page, 300);
        await pause(page);
      }
      await deploy(page, cdp, command.unitId, tile, command.dir);
    }
    await resume(page);
    await finishBattle(page);
    const state = await page.evaluate(() => ({
      life: window.campaign.battle.state.life,
      phase: window.campaign.battle.state.phase,
      seconds: window.campaign.battle.state.tick / 30,
      rejected: window.campaign.rejected,
    }));
    const hud = await page.locator('.battle-life').textContent();
    const result = await page.locator('.result-detail').textContent();
    const entry = { viewport: mobile ? 'mobile' : 'desktop', ...state, hud, result, errors };
    console.log(JSON.stringify(entry));
    await page.screenshot({ path: `docs/verification/${prefix}-${entry.viewport}-defeat.png` });
    assert.equal(state.phase, 'lost');
    assert(state.life < 0, '누수 피해가 남은 푸딩보다 큰 상황 재현');
    assert.equal(hud, '♥ 푸딩 0');
    assert.match(result, /^푸딩 0개/);
    assert.equal(await page.locator('.result-stars').textContent(), '☆☆☆');
    assert.equal(await page.getByRole('button', { name: '다음 스테이지', exact: true }).count(), 0);
    assert.deepEqual(
      await page.evaluate(() => JSON.parse(localStorage.getItem('mallang-guard:v1')).stages),
      saved,
    );
    assert.deepEqual(state.rejected, []);
    assert.deepEqual(errors, []);
    report.push({ ...entry, recordUnchanged: true });
    await context.close();
  }
  await writeFile(`docs/verification/${prefix}-defeat.json`, `${JSON.stringify(report, null, 2)}\n`);
} finally {
  await browser.close();
}
