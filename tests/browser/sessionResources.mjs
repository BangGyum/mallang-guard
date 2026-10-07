import assert from 'node:assert/strict';
import { chromium } from 'playwright';

const browser = await chromium.launch({
  channel: 'msedge',
  headless: true,
  args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'],
});
try {
  const context = await browser.newContext({ viewport: { width: 740, height: 360 } });
  await context.grantPermissions(['local-network-access']);
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.route('**/session-resources', (route) =>
    route.fulfill({
      contentType: 'text/html',
      body: '<link rel="stylesheet" href="/src/ui/styles.css"><div id="app"><canvas id="board"></canvas><canvas id="overlay"></canvas><div id="hud"></div><div id="screens"></div></div>',
    }),
  );
  await page.goto('http://127.0.0.1:43195/session-resources');
  const memories = await page.evaluate(async () => {
    const { createBattleSession } = await import('/src/app/battleSession.ts');
    const { content } = await import('/src/data/index.ts');
    const samples = [];
    for (let i = 0; i < 10; i++) {
      const session = createBattleSession(content, document.querySelector('#app'), {
        speed: 1,
        onMenu() {},
        onEnd() {},
        onSpeed() {},
      });
      session.controls.paused = true;
      session.battle.enqueue({ type: 'deploy', unitId: 'squirrel', tile: { x: 2, y: 0 }, dir: 'down' });
      session.battle.flush();
      session.view.setHighlights({ ghost: { unitId: 'penguin', tile: { x: 5, y: 2 }, dir: 'left' } });
      session.view.render(session.battle.state, 1, 0);
      const active = session.view.memory;
      session.dispose();
      samples.push({ active, disposed: session.view.memory });
    }
    return samples;
  });
  assert.equal(memories.length, 10);
  assert(memories[0].active.geometries > 0 && memories[0].active.textures > 0);
  for (const memory of memories) {
    assert.deepEqual(
      memory.active,
      memories[0].active,
      '반복 배치와 고스트 렌더에서 GPU 자원이 증가하지 않음',
    );
    assert.deepEqual(memory.disposed, { geometries: 0, textures: 0 }, '세션 종료 시 GPU 자원 정리');
  }
  assert.deepEqual(errors, []);
  console.log(JSON.stringify({ cycles: 10, memory: memories[0], errors }));
  await context.close();
} finally {
  await browser.close();
}
