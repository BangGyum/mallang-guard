import assert from 'node:assert/strict';
import { writeFile } from 'node:fs/promises';
import { chromium } from 'playwright';
import { installAudioProbe } from './audioProbe.mjs';
import { bossSkillPoint, createBossSkillGame } from './bossSkillScene.mjs';
import { enterBattle, frame, pause, resume } from './helpers.mjs';

const prefix = process.env.MALLANG_SCREENSHOT_PREFIX ?? 't4.23';
const browser = await chromium.launch({ channel: 'msedge', headless: true });
const ids = [
  'bigJelly',
  'gateJelly',
  'splitCaptain',
  'greenhouseKeeper',
  'stormCrow',
  'kingJelly',
  'gardenKing',
];
const report = [];
try {
  for (const [width, height] of [
    [1920, 1080],
    [844, 390],
    [740, 360],
    [390, 844],
    [320, 568],
  ]) {
    const touch = width < 1000;
    const context = await browser.newContext({
      viewport: { width, height },
      hasTouch: touch,
      isMobile: touch,
    });
    await context.grantPermissions(['local-network-access']);
    const page = await context.newPage();
    const cdp = touch ? await context.newCDPSession(page) : null;
    const errors = [];
    page.on('pageerror', (error) => errors.push(error.message));
    page.on('console', (message) => {
      if (['error', 'warning'].includes(message.type())) errors.push(message.text());
    });
    const time = new Date('2026-10-12T12:00:00Z');
    await page.clock.install({ time });
    await page.clock.pauseAt(new Date(time.getTime() + 1000));
    await page.addInitScript(installAudioProbe);
    await page.addInitScript(() => {
      window.requestAnimationFrame = (cb) => setTimeout(() => cb(performance.now()), 100);
      window.cancelAnimationFrame = (id) => clearTimeout(id);
    });
    await page.route('**/boss-skills-check', (route) =>
      route.fulfill({
        contentType: 'text/html; charset=utf-8',
        body: '<meta name="viewport" content="width=device-width, initial-scale=1"><link rel="stylesheet" href="/src/ui/styles.css"><div id="app"></div>',
      }),
    );
    await page.goto('http://127.0.0.1:43195/boss-skills-check');
    const click = async (locator) => {
      if (touch) await locator.tap();
      else await locator.click();
      await frame(page, 120);
    };
    const tap = async (tile) => {
      const point = await page.evaluate(bossSkillPoint, tile);
      if (touch) await page.touchscreen.tap(point.x, point.y);
      else await page.mouse.click(point.x, point.y);
      await frame(page, 220);
    };
    const read = () =>
      page.evaluate(() => {
        const { battle, events } = window.bossSkillAudit;
        const boss = battle.state.enemies.find((e) => battle.content.enemies.get(e.enemyId)?.boss);
        return {
          tick: battle.state.tick,
          boss,
          events: events.filter(
            (e) =>
              e.type === 'bossSkill' ||
              e.type === 'enemyHeal' ||
              e.type === 'unitDisrupt' ||
              e.type === 'commandRejected',
          ),
          state: JSON.stringify(battle.state),
        };
      });
    const inspect = () =>
      page.locator('.boss-hud').evaluate((panel) => {
        const boss = panel.getBoundingClientRect();
        const top = document.querySelector('.battle-top').getBoundingClientRect();
        const bar = document.querySelector('.deploy-bar').getBoundingClientRect();
        const popup = document.querySelector('.unit-panel:not([hidden])');
        const box = popup?.getBoundingClientRect();
        return {
          fits:
            boss.left >= 0 && boss.right <= innerWidth && boss.top >= top.bottom && boss.bottom <= bar.top,
          separated:
            !box ||
            boss.right <= box.left ||
            box.right <= boss.left ||
            boss.bottom <= box.top ||
            box.bottom <= boss.top,
          buttons:
            !popup ||
            [...popup.querySelectorAll('button')]
              .filter((b) => b.getClientRects().length)
              .every((b) => {
                const r = b.getBoundingClientRect();
                return r.width >= 44 && r.height >= 44 && r.top >= box.top && r.bottom <= box.bottom;
              }),
          skillVisible: panel.querySelector('.boss-skill').getBoundingClientRect().bottom <= boss.bottom,
        };
      });
    const checks = [];
    for (const id of ids) {
      const def = await page.evaluate(createBossSkillGame, id);
      await enterBattle(page, { waitForStart: false });
      await pause(page);
      const actors =
        id === 'kingJelly'
          ? [
              ['squirrel', 2],
              ['cat', 1],
              ['bear', 3],
            ]
          : [[def.flying ? 'penguin' : 'squirrel', 2]];
      for (const [unitId, x] of actors) {
        await click(page.locator(`.deploy-card[data-unit-id="${unitId}"]`));
        if (width <= 320) {
          const box = await page.locator(`.deploy-card[data-unit-id="${unitId}"]`).boundingBox();
          const point = await page.evaluate(bossSkillPoint, { x, y: 2 });
          assert(box);
          await cdp.send('Input.dispatchTouchEvent', {
            type: 'touchStart',
            touchPoints: [{ x: box.x + box.width / 2, y: box.y + box.height / 2, id: 1 }],
          });
          await frame(page);
          await cdp.send('Input.dispatchTouchEvent', {
            type: 'touchMove',
            touchPoints: [{ ...point, id: 1 }],
          });
          await frame(page);
          await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
          await frame(page);
        } else await tap({ x, y: 2 });
        assert(await page.locator('.aim-directions').isVisible());
        await click(page.locator('[data-dir="up"]'));
      }
      await resume(page);
      await click(page.locator('[data-action="start"]'));
      await frame(page, 3000);
      for (let seconds = 0; seconds < 10 && !(await read()).boss?.bossCastUntilTick; seconds += 0.25)
        await frame(page, 250);
      await pause(page);
      const preparing = await read();
      assert(preparing.boss?.bossCastUntilTick > 0, `${id}: 자연 충전으로 예고 시작`);
      assert(await page.locator('.boss-skill').isVisible());
      assert.match(await page.locator('.boss-skill').textContent(), new RegExp(def.bossSkill.name));
      assert.equal(await page.locator('.boss-hud').getAttribute('data-skill-phase'), 'windup');
      assert.match(await page.locator('.boss-announcement').textContent(), /기절로 중단/);
      const voices = await page.evaluate(async (id) => {
        const { bossSkillSound, createBossBuffers } = await import('/src/audio/bossSounds.ts');
        const offline = new OfflineAudioContext(1, 1, 48000);
        const buffers = createBossBuffers(offline);
        const expected = buffers.get(bossSkillSound(id, 'windup')).duration;
        return {
          expected,
          heard: window.audioProbe.starts.some((v) => Math.abs(v.duration - expected) < 0.0001),
        };
      }, id);
      assert(voices.heard, `${id}: 실제 예고 버퍼`);
      await tap({ x: 2, y: 2 });
      const layout = await inspect();
      assert(Object.values(layout).every(Boolean), `${id}/${width}x${height}: ${JSON.stringify(layout)}`);
      assert.equal((await read()).state, preparing.state, '선택과 정지 중 준비 시간·상태 유지');
      if (['bigJelly', 'gateJelly', 'gardenKing'].includes(id) && [1920, 740].includes(width))
        await page.screenshot({
          path: `docs/verification/${prefix}-${width}x${height}-${id}-windup.png`,
          animations: 'disabled',
        });
      await click(page.locator('.unit-popup-close'));
      await resume(page);
      for (
        let count = 0;
        count < 10 && !(await read()).events.some((e) => e.type === 'bossSkill' && e.phase === 'cast');
        count++
      )
        await frame(page, 200);
      const fired = await read();
      assert(
        fired.events.some((e) => e.type === 'bossSkill' && e.phase === 'cast'),
        `${id}: 실제 발동`,
      );
      assert.deepEqual(
        fired.events.filter((e) => e.type === 'commandRejected'),
        [],
      );
      const castVoice = await page.evaluate(async (id) => {
        const { bossSkillSound, createBossBuffers } = await import('/src/audio/bossSounds.ts');
        const buffers = createBossBuffers(new OfflineAudioContext(1, 1, 48000));
        const expected = buffers.get(bossSkillSound(id, 'cast')).duration;
        return window.audioProbe.starts.some((v) => Math.abs(v.duration - expected) < 0.0001);
      }, id);
      assert(castVoice, `${id}: 실제 발동 버퍼`);
      if (id === 'kingJelly') assert.equal(fired.events.filter((e) => e.type === 'unitDisrupt').length, 3);
      if (id === 'greenhouseKeeper') assert(fired.events.some((e) => e.type === 'enemyHeal' && e.amount > 0));
      checks.push({
        id,
        name: def.name,
        skill: def.bossSkill.name,
        layout,
        windupSound: voices.heard,
        castSound: castVoice,
        windups: fired.events.filter((e) => e.type === 'bossSkill' && e.phase === 'windup').length,
        casts: fired.events.filter((e) => e.type === 'bossSkill' && e.phase === 'cast').length,
      });
      await click(page.locator('[data-action="exit"]'));
      assert(await page.locator('.title-screen').isVisible());
      assert.equal(await page.locator('.boss-hud').count(), 0);
    }
    assert.deepEqual(errors, []);
    report.push({ viewport: `${width}x${height}`, checks, errors });
    await context.close();
    await writeFile(`docs/verification/${prefix}-boss-skills.json`, `${JSON.stringify(report, null, 2)}\n`);
    console.log(JSON.stringify({ viewport: `${width}x${height}`, checks: checks.length, errors }));
  }
} finally {
  await browser.close();
}
