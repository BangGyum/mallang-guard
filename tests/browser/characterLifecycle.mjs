import assert from 'node:assert/strict';
import { writeFile } from 'node:fs/promises';
import { chromium } from 'playwright';
import { enterBattle, frame, pause, resume } from './helpers.mjs';
import { createUnitAuditGame, unitAuditPoint } from './unitAuditScene.mjs';

const report = [];
const prefix = process.env.MALLANG_SCREENSHOT_PREFIX ?? 't3.9';
const browser = await chromium.launch({ channel: 'msedge', headless: true });
try {
  for (const mobile of process.argv.includes('--mobile') ? [true] : [false, true]) {
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
    const time = new Date('2026-10-08T12:00:00Z');
    await page.clock.install({ time });
    await page.clock.pauseAt(new Date(time.getTime() + 1000));
    await page.addInitScript(() => {
      window.requestAnimationFrame = (callback) => setTimeout(() => callback(performance.now()), 100);
      window.cancelAnimationFrame = (id) => clearTimeout(id);
    });
    await page.route('**/unit-audit', (route) =>
      route.fulfill({
        contentType: 'text/html',
        body: '<meta name="viewport" content="width=device-width, initial-scale=1"><link rel="stylesheet" href="/src/ui/styles.css"><div id="app"></div>',
      }),
    );
    await page.goto('http://127.0.0.1:43195/unit-audit');
    const click = async (locator) => {
      if (mobile) await locator.tap();
      else await locator.click();
      await frame(page);
    };
    const units = await page.evaluate(async () => {
      const { content } = await import('/src/data/index.ts');
      return [...content.units.values()].map((unit) => ({
        ...unit,
        skillDef: content.skills.get(unit.skill),
      }));
    });
    const read = () =>
      page.evaluate(() => {
        const { battle, events } = window.unitAudit;
        return {
          tick: battle.state.tick,
          dp: battle.state.dp,
          units: battle.state.units,
          roster: battle.rosterView(),
          attacks: events.filter((e) => e.type === 'attack').length,
          starts: events.filter((e) => e.type === 'skillStart').length,
          ends: events.filter((e) => e.type === 'skillEnd').length,
          rejected: events.filter((e) => e.type === 'commandRejected'),
        };
      });
    const select = async (unitId) => {
      const point = await page.evaluate(unitAuditPoint);
      if (mobile) await page.touchscreen.tap(point.x, point.y);
      else await page.mouse.click(point.x, point.y);
      await frame(page, 220);
      assert.equal(await page.locator('.unit-panel').getAttribute('data-unit-id'), unitId);
      assert(await page.locator('.unit-panel').isVisible());
    };
    const deploy = async (unitId, dir) => {
      await pause(page);
      const card = page.locator(`.deploy-card[data-unit-id="${unitId}"]`);
      await card.scrollIntoViewIfNeeded();
      const box = await card.boundingBox();
      const point = await page.evaluate(unitAuditPoint);
      assert(box);
      const x = box.x + box.width / 2,
        y = box.y + box.height / 2;
      if (mobile) {
        const cdp = await context.newCDPSession(page);
        await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x, y, id: 1 }] });
        await frame(page);
        await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ ...point, id: 1 }] });
        await frame(page);
        await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
        await cdp.detach();
      } else {
        await page.mouse.move(x, y);
        await page.mouse.down();
        await frame(page);
        await page.mouse.move(point.x, point.y, { steps: 5 });
        await frame(page);
        await page.mouse.up();
      }
      await frame(page);
      assert(await page.locator('.aim-directions').isVisible());
      await click(page.locator(`[data-dir="${dir}"]`));
      assert.equal(await card.isVisible(), false);
      assert.equal((await read()).units[0].dir, dir);
    };
    for (const [index, unit] of units.entries()) {
      const dir = ['up', 'right', 'down', 'left'][index % 4];
      await page.evaluate(createUnitAuditGame, { dir });
      await enterBattle(page);
      await deploy(unit.id, dir);
      const initial = await read();
      assert.equal(initial.units.length, 1);
      assert.equal(initial.units[0].sp, unit.skillDef.spStart);
      const oldUid = initial.units[0].uid;
      await select(unit.id);
      assert.equal(await page.locator('.skill-name').textContent(), unit.skillDef.name);
      assert.equal(await page.locator('.skill-button').isVisible(), unit.skillDef.trigger === 'manual');
      if (unit.skillDef.trigger === 'manual') assert(await page.locator('.skill-button').isDisabled());
      await click(page.getByRole('button', { name: '캐릭터 정보 닫기' }));
      await resume(page);
      for (let second = 0; second < 40; second++) {
        await frame(page, 1000);
        const current = await read();
        if (current.starts > 0 || current.units[0].skillState === 'ready') break;
      }
      await pause(page);
      const charged = await read();
      assert(charged.attacks > 0, `${unit.id} 기본 공격`);
      await select(unit.id);
      if (unit.skillDef.trigger === 'manual') {
        assert.equal(charged.units[0].skillState, 'ready');
        assert.equal(await page.locator('.skill-button').isDisabled(), false);
        await click(page.locator('.skill-button'));
      }
      const started = await read();
      assert.equal(started.starts, 1, `${unit.id} 스킬 발동`);
      const notice = page.locator(`.skill-notice[data-unit-id="${unit.id}"]`);
      assert(await notice.isVisible(), `${unit.id} 발동 알림`);
      assert.match(await notice.innerText(), new RegExp(`${unit.name}[\\s\\S]*${unit.skillDef.name}`));
      const bounds = await page.locator('.unit-panel').boundingBox();
      assert(
        bounds &&
          bounds.x >= 0 &&
          bounds.y >= 0 &&
          bounds.x + bounds.width <= page.viewportSize().width &&
          bounds.y + bounds.height <= page.viewportSize().height,
        `${unit.id} 정보창 경계: ${JSON.stringify(bounds)}`,
      );
      await page.screenshot({
        path: `docs/verification/${prefix}-${label}-${unit.id}-skill.png`,
        animations: 'disabled',
      });
      await click(page.getByRole('button', { name: '캐릭터 정보 닫기' }));
      await resume(page);
      await frame(page, (unit.skillDef.durationSec + 0.5) * 1000);
      await pause(page);
      const finished = await read();
      assert.equal(finished.ends, 1, `${unit.id} 스킬 종료`);
      assert.deepEqual(finished.units[0].buffs, []);
      await select(unit.id);
      await click(page.locator('.unit-retreat'));
      assert.equal((await read()).units.length, 0);
      const card = page.locator(`.deploy-card[data-unit-id="${unit.id}"]`);
      assert(await card.isVisible());
      assert.equal(await card.getAttribute('data-state'), 'cooldown');
      await resume(page);
      await frame(page, (unit.redeploySec + 0.5) * 1000);
      await pause(page);
      assert.equal(await card.getAttribute('data-state'), 'ready');
      const nextDir = ['down', 'left', 'up', 'right'][index % 4];
      await deploy(unit.id, nextDir);
      const redeployed = await read();
      assert(redeployed.units[0].uid > oldUid);
      assert.equal(redeployed.units[0].sp, unit.skillDef.spStart);
      assert.deepEqual(redeployed.units[0].buffs, []);
      assert.deepEqual(redeployed.rejected, []);
      report.push({
        viewport: label,
        unit: unit.id,
        dir,
        skill: unit.skillDef.name,
        trigger: unit.skillDef.trigger,
        attacks: finished.attacks,
        starts: finished.starts,
        ends: finished.ends,
        redeployDir: nextDir,
        rejected: redeployed.rejected,
      });
      console.log(`${label}: ${unit.id} 공격·스킬·후퇴·재배치 통과`);
    }
    await page.evaluate(() => window.unitAudit.game.dispose());
    assert.deepEqual(errors, []);
    await context.close();
  }
  await writeFile(`docs/verification/${prefix}-characters.json`, `${JSON.stringify(report, null, 2)}\n`);
} finally {
  await browser.close();
}
