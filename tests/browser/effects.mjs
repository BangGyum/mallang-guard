import assert from 'node:assert/strict';
import { chromium } from 'playwright';
import { createTestScene } from './scene.mjs';

const screenshotPrefix = process.env.MALLANG_SCREENSHOT_PREFIX ?? 't3.3';

const browser = await chromium.launch({
  channel: 'msedge',
  headless: true,
  args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'],
});
try {
  for (const mobile of [false, true]) {
    const context = await browser.newContext({
      viewport: mobile ? { width: 844, height: 390 } : { width: 1920, height: 1080 },
    });
    await context.grantPermissions(['local-network-access']);
    const page = await context.newPage();
    const errors = [];
    page.on('pageerror', (error) => errors.push(error.message));
    page.on('console', (message) => {
      if (['error', 'warning'].includes(message.type())) errors.push(message.text());
    });
    await page.route('**/effects-check', (route) =>
      route.fulfill({
        contentType: 'text/html',
        body: '<link rel="stylesheet" href="/src/ui/styles.css"><div id="app"><canvas id="board"></canvas><canvas id="overlay"></canvas></div>',
      }),
    );
    await page.goto('http://127.0.0.1:43195/effects-check');
    await page.evaluate(createTestScene, 6);
    const start = await page.evaluate(() => {
      const { battle, deliver, render, view } = window.testScene;
      const enemy = battle.state.enemies[0];
      const source = battle.state.units.find((unit) => unit.unitId === 'penguin');
      deliver([
        {
          type: 'attack',
          src: { kind: 'unit', uid: source.uid },
          dst: { kind: 'enemy', uid: enemy.uid },
          damageType: 'physical',
          ranged: true,
        },
        {
          type: 'damage',
          src: { kind: 'unit', uid: source.uid },
          dst: { kind: 'enemy', uid: enemy.uid },
          amount: 123,
          damageType: 'physical',
        },
        { type: 'skillStart', uid: source.uid, skillId: 'snowballBarrage' },
        { type: 'skillPulse', uid: battle.state.units.find((unit) => unit.unitId === 'sheep').uid },
        { type: 'enemyDie', uid: enemy.uid },
      ]);
      battle.state.enemies = battle.state.enemies.filter((entry) => entry !== enemy);
      window.dyingUid = enemy.uid;
      render(0.12);
      return { visible: !!view.entityPosition(enemy.uid), metrics: view.metrics };
    });
    assert(start.visible, '투사체 도착 전 마지막 피격 대상을 유지');
    assert(start.metrics.particles > 5 && start.metrics.particles <= 200);
    const label = mobile ? 'mobile' : 'desktop';
    await page.screenshot({ path: `docs/verification/${screenshotPrefix}-${label}-projectile.png` });
    await page.evaluate(() => window.testScene.render(0.15));
    await page.screenshot({ path: `docs/verification/${screenshotPrefix}-${label}-impact.png` });
    assert(
      await page.evaluate(() => !!window.testScene.view.entityPosition(window.dyingUid)),
      '도착 시점에 사망 연출 진행',
    );
    await page.evaluate(() => window.testScene.render(0.3));
    assert.equal(await page.evaluate(() => !!window.testScene.view.entityPosition(window.dyingUid)), false);
    const capacity = await page.evaluate(() => {
      const { battle, deliver, render, view } = window.testScene;
      const uid = battle.state.units.find((unit) => unit.unitId === 'sheep').uid;
      for (let i = 0; i < 100; i++) deliver([{ type: 'skillPulse', uid }]);
      render(0);
      const peak = view.metrics.particles;
      render(1);
      return { peak, rest: view.metrics.particles };
    });
    assert.equal(capacity.peak, 200, '파티클 풀 상한');
    assert(capacity.rest < 30, '종료된 효과 슬롯 반환');
    const instantKill = await page.evaluate(() => {
      const { battle, deliver, render, view } = window.testScene;
      const uid = battle.state.nextUid;
      const src = { kind: 'unit', uid: battle.state.units[0].uid };
      const dst = { kind: 'enemy', uid };
      deliver([
        { type: 'enemySpawn', uid, enemyId: 'jelly', x: 1.5, y: 1.5 },
        { type: 'attack', src, dst, damageType: 'physical', ranged: true },
        { type: 'damage', src, dst, amount: 100, damageType: 'physical' },
        { type: 'enemyDie', uid },
      ]);
      render(0.12);
      const flying = !!view.entityPosition(uid);
      render(0.15);
      const impact = !!view.entityPosition(uid);
      return { uid, flying, impact };
    });
    assert(instantKill.flying && instantKill.impact, '같은 틱에 생성·처치된 적도 피격까지 표시');
    await page.screenshot({ path: `docs/verification/${screenshotPrefix}-${label}-instant-kill.png` });
    await page.evaluate(() => window.testScene.render(0.3));
    assert.equal(
      await page.evaluate((uid) => !!window.testScene.view.entityPosition(uid), instantKill.uid),
      false,
      '사망 연출이 끝난 즉시 생성 적도 정리',
    );
    await page.evaluate(() => {
      window.testScene.overlay.dispose();
      window.testScene.view.dispose();
    });
    assert.deepEqual(errors, []);
    console.log(JSON.stringify({ viewport: label, capacity, instantKill, errors }));
    await context.close();
  }
} finally {
  await browser.close();
}
