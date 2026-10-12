import assert from 'node:assert/strict';
import { writeFile } from 'node:fs/promises';
import { chromium } from 'playwright';
import { createBossScene } from './bossScene.mjs';

const prefix = process.env.MALLANG_SCREENSHOT_PREFIX ?? 't4.21';
const report = [];
const browser = await chromium.launch({ channel: 'msedge', headless: true });
try {
  for (const [width, height, touch, reduced] of [
    [1920, 1080, false, false],
    [844, 390, true, false],
    [740, 360, true, true],
    [390, 844, true, false],
  ]) {
    const context = await browser.newContext({
      viewport: { width, height },
      hasTouch: touch,
      isMobile: touch,
    });
    await context.grantPermissions(['local-network-access']);
    const page = await context.newPage();
    const errors = [];
    page.on('pageerror', (error) => errors.push(error.message));
    page.on('console', (message) => {
      if (['warning', 'error'].includes(message.type())) errors.push(message.text());
    });
    await page.route('**/boss-check', (route) =>
      route.fulfill({
        contentType: 'text/html; charset=utf-8',
        body: '<meta name="viewport" content="width=device-width, initial-scale=1"><link rel="stylesheet" href="/src/ui/styles.css"><div id="app"></div>',
      }),
    );
    await page.goto('http://127.0.0.1:43195/boss-check');
    await page.evaluate((reduced) => {
      document.querySelector('#app').dataset.reducedMotion = String(reduced);
    }, reduced);
    const checks = [];
    for (let stage = 1; stage <= 7; stage++) {
      const def = await page.evaluate(createBossScene, `stage-${stage}`);
      const panel = page.locator('.boss-hud');
      assert(await panel.isVisible());
      assert.equal(await panel.getAttribute('data-enemy-id'), def.id);
      assert.equal(await page.locator('.boss-name').textContent(), def.name);
      assert.match(await page.locator('.boss-announcement').textContent(), /보스 출현/);
      assert.equal(await page.locator('.boss-hp').getAttribute('max'), String(def.hp));
      assert.equal(await page.locator('.boss-hp').getAttribute('value'), String(def.hp));
      assert.equal(await page.locator('.boss-shield').isVisible(), def.shield > 0);
      assert(await page.locator('.wave-notice').isVisible(), '보스 출현 때도 마지막 웨이브 알림 유지');
      const layout = await panel.evaluate((node) => {
        const box = node.getBoundingClientRect();
        const top = document.querySelector('.battle-top').getBoundingClientRect();
        const notice = document.querySelector('.wave-notice').getBoundingClientRect();
        const overflowing = [...node.querySelectorAll('.boss-name, .boss-hp-value')].some((child) => {
          const bounds = child.getBoundingClientRect();
          return bounds.left < box.left || bounds.right > box.right;
        });
        return {
          center: box.x + box.width / 2,
          inViewport: box.left >= 0 && box.right <= innerWidth && box.bottom <= innerHeight,
          underHeader: box.top >= top.bottom,
          underWave: box.top >= notice.bottom,
          pointerEvents: getComputedStyle(node).pointerEvents,
          overflowing,
        };
      });
      assert(Math.abs(layout.center - width / 2) <= 1, '등장 애니메이션 중에도 가로 중앙 유지');
      assert(layout.inViewport && layout.underHeader && layout.underWave && !layout.overflowing);
      assert.equal(layout.pointerEvents, 'none');
      await page.locator('[data-action="pause"]').click();
      await page.locator('[data-action="pause"]').click();
      await page.locator('.battle-speed').click();
      const controls = await page.evaluate(() => window.bossScene.clicks);
      assert.deepEqual(controls, { pause: 2, speed: 1 });
      await page.evaluate(() => window.bossScene.advanceToMiddle());
      await page.evaluate(() => window.bossScene.deployAttacker());
      const before = await page.evaluate(() => {
        const enemy = window.bossScene.battle.state.enemies.find(
          (enemy) => window.bossScene.battle.content.enemies.get(enemy.enemyId).boss,
        );
        return { hp: enemy.hp, shield: enemy.shield };
      });
      await page.evaluate(() => window.bossScene.step(180));
      const after = await page.evaluate(() => {
        const enemy = window.bossScene.battle.state.enemies.find(
          (enemy) => window.bossScene.battle.content.enemies.get(enemy.enemyId).boss,
        );
        const hp = document.querySelector('.boss-hp');
        const shield = document.querySelector('.boss-shield');
        return {
          hp: enemy.hp,
          shield: enemy.shield,
          hpValue: hp.value,
          shieldValue: shield.value,
          label: document.querySelector('.boss-hp-value').textContent,
        };
      });
      assert(
        after.hp < before.hp || after.shield < before.shield,
        `${stage}: 실제 공격으로 피해 발생 ${JSON.stringify({ before, after })}`,
      );
      assert.equal(after.hpValue, after.hp);
      assert.equal(after.shieldValue, after.shield);
      assert.equal(after.label, `${Math.ceil(after.hp)} / ${def.hp}`);
      await page.evaluate(() => {
        for (const node of document.querySelectorAll('.boss-name'))
          for (const animation of node.getAnimations()) animation.finish();
      });
      if ((width === 1920 || width === 844) && [1, 2, 5, 7].includes(stage))
        await page.screenshot({ path: `docs/verification/${prefix}-${width}x${height}-boss-${stage}.png` });
      if (stage === 7 && width === 740)
        await page.screenshot({ path: `docs/verification/${prefix}-compact-boss.png` });
      if (stage === 7 && width === 390)
        await page.screenshot({ path: `docs/verification/${prefix}-portrait-boss.png` });
      const phase = await page.evaluate(() => {
        const { battle, step } = window.bossScene;
        for (const unit of battle.state.units) battle.enqueue({ type: 'retreat', uid: unit.uid });
        return step(12000);
      });
      assert.notEqual(phase, 'running');
      assert.equal(await panel.isVisible(), false, '전투 종료 시 보스 HUD 숨김');
      assert.equal(await page.locator('.boss-announcement').textContent(), '');
      await page.locator('[data-action="exit"]').click();
      assert.equal(await page.locator('.boss-hud').count(), 0);
      assert.equal(await page.locator('.boss-announcement').count(), 0);
      checks.push({ stage, boss: def.id, layout, before, after, ended: phase });
    }
    assert.deepEqual(errors, []);
    report.push({ width, height, touch, reduced, checks, errors });
    console.log(JSON.stringify({ width, height, stages: checks.length, errors }));
    await context.close();
  }
  await writeFile(`docs/verification/${prefix}-boss-ui.json`, `${JSON.stringify(report, null, 2)}\n`);
} finally {
  await browser.close();
}
