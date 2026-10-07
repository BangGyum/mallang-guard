import assert from 'node:assert/strict';
import { chromium } from 'playwright';

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
    await page.route('**/animation-check', (route) =>
      route.fulfill({
        contentType: 'text/html',
        body: '<link rel="stylesheet" href="/src/ui/styles.css"><div id="app"><canvas id="board"></canvas><canvas id="overlay"></canvas></div>',
      }),
    );
    await page.goto('http://127.0.0.1:43195/animation-check');
    await page.evaluate(async () => {
      const { loadArtAssets } = await import('/src/app/artAssets.ts');
      const { rawContent } = await import('/src/data/index.ts');
      const { validateContent } = await import('/src/data/validate.ts');
      const { createBattle } = await import('/src/sim/battle.ts');
      const { createBoardView } = await import('/src/view/boardView.ts');
      const raw = structuredClone(rawContent);
      raw.units.forEach((unit) => {
        unit.cost = 1;
      });
      raw.stages[0].deployLimit = 8;
      raw.stages[0].spawns = raw.enemies.map((enemy) => ({
        wave: 1,
        atSec: 0,
        enemy: enemy.id,
        count: 1,
        intervalSec: 0,
        route: enemy.flying ? 'air' : 'ground',
      }));
      const content = validateContent(raw);
      const battle = createBattle(content, 'stage-1');
      const view = createBoardView(
        document.querySelector('#board'),
        battle.stage.board,
        content,
        await loadArtAssets(),
      );
      const tiles = [
        [2, 0],
        [3, 0],
        [7, 0],
        [8, 0],
        [1, 2],
        [2, 2],
        [5, 2],
        [8, 3],
      ];
      raw.units.forEach((unit, i) => {
        battle.enqueue({
          type: 'deploy',
          unitId: unit.id,
          tile: { x: tiles[i][0], y: tiles[i][1] },
          dir: i % 2 ? 'left' : 'down',
        });
      });
      const events = battle.step();
      battle.state.enemies.forEach((enemy, i) => {
        enemy.x = enemy.px = 3 + i * 2;
        enemy.y = enemy.py = 1.5;
      });
      view.resize();
      view.onEvents(events, battle.state);
      window.animationCheck = { battle, view };
      view.render(battle.state, 1, 0.1);
    });
    const label = mobile ? 'mobile' : 'desktop';
    await page.screenshot({ path: `docs/verification/t3.2-${label}-deploy.png` });
    await page.evaluate(() => {
      const { battle, view } = window.animationCheck;
      battle.state.units[3].skillState = 'active';
      battle.state.enemies[0].slowAmount = 0.6;
      battle.state.enemies[1].stunUntilTick = 100;
      view.render(battle.state, 1, 0.5);
      view.onEvents(
        [
          {
            type: 'attack',
            src: { kind: 'unit', uid: battle.state.units[0].uid },
            dst: { kind: 'enemy', uid: battle.state.enemies[0].uid },
            damageType: 'physical',
            ranged: true,
          },
          {
            type: 'damage',
            dst: { kind: 'enemy', uid: battle.state.enemies[0].uid },
            amount: 100,
            damageType: 'physical',
            src: null,
          },
        ],
        battle.state,
      );
      view.render(battle.state, 1, 0.02);
    });
    await page.screenshot({ path: `docs/verification/t3.2-${label}-active.png` });
    const paused = await page.locator('#board').screenshot();
    await page.evaluate(() => {
      const { battle, view } = window.animationCheck;
      for (let i = 0; i < 10; i++) view.render(battle.state, 1, 0);
    });
    assert.deepEqual(await page.locator('#board').screenshot(), paused, '정지 중 애니메이션 고정');
    await page.evaluate(() => {
      const { battle, view } = window.animationCheck;
      const events = battle.state.enemies.map((enemy, i) => ({
        type: i === 0 ? 'enemyDie' : 'enemyLeak',
        uid: enemy.uid,
        lifeLeft: 3,
      }));
      view.onEvents(events, battle.state);
      battle.state.enemies = [];
      view.render(battle.state, 1, 0.12);
    });
    await page.screenshot({ path: `docs/verification/t3.2-${label}-exit.png` });
    await page.evaluate(() => window.animationCheck.view.dispose());
    assert.deepEqual(errors, []);
    console.log(JSON.stringify({ viewport: label, errors }));
    await context.close();
  }
} finally {
  await browser.close();
}
