import assert from 'node:assert/strict';
import { writeFile } from 'node:fs/promises';
import { chromium } from 'playwright';

const browser = await chromium.launch({ channel: 'msedge', headless: true });
try {
  const page = await browser.newPage({ viewport: { width: 844, height: 390 } });
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.route('**/theme-resources', (route) =>
    route.fulfill({
      contentType: 'text/html; charset=utf-8',
      body: '<meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="/src/ui/styles.css"><div id="app"><canvas id="board"></canvas><canvas id="overlay"></canvas><div id="hud"></div></div>',
    }),
  );
  await page.goto('http://127.0.0.1:43195/theme-resources');
  const samples = await page.evaluate(async () => {
    const { content } = await import('/src/data/index.ts');
    const { createBattleSession } = await import('/src/app/battleSession.ts');
    const { loadArtAssets } = await import('/src/app/artAssets.ts');
    const images = await loadArtAssets();
    const samples = [];
    for (let cycle = 0; cycle < 2; cycle++) {
      for (const stage of content.stages.values()) {
        const session = createBattleSession(
          content,
          document.querySelector('#app'),
          {
            stageId: stage.id,
            speed: 1,
            onMenu() {},
            onExit() {},
            onEnd() {},
            onSpeed() {},
          },
          images,
        );
        session.setPaused(true);
        const tile = stage.map.flatMap((row, y) =>
          [...row].flatMap((char, x) => (char === 'H' ? [{ x, y }] : [])),
        )[0];
        session.battle.enqueue({ type: 'deploy', unitId: 'squirrel', tile, dir: 'down' });
        session.battle.flush();
        session.view.setHighlights({
          range: [tile],
          ghost: { unitId: 'penguin', tile, dir: 'left' },
        });
        session.view.render(session.battle.state, 1, 0);
        const active = session.view.memory;
        const calls = session.view.metrics.drawCalls;
        const canvas = document.querySelector('#board');
        const theme = canvas.dataset.stageTheme;
        session.dispose();
        samples.push({
          cycle,
          stage: stage.id,
          theme,
          active,
          calls,
          disposed: session.view.memory,
          cleaned: !canvas.dataset.stageTheme && canvas.style.background === '',
        });
      }
    }
    return samples;
  });
  assert.equal(samples.length, 14);
  for (const sample of samples) {
    assert(sample.active.geometries > 0 && sample.active.textures > 0);
    assert.deepEqual(sample.disposed, { geometries: 0, textures: 0 });
    assert(sample.cleaned);
    assert(sample.calls <= 120);
    if (sample.cycle === 1)
      assert.deepEqual(
        sample.active,
        samples.find((first) => first.cycle === 0 && first.stage === sample.stage).active,
        '같은 테마 재진입 시 활성 GPU 자원 수 유지',
      );
  }
  assert.deepEqual(errors, []);
  const result = { cycles: 14, samples, errors };
  await writeFile('docs/verification/t4.29-theme-resources.json', `${JSON.stringify(result, null, 2)}\n`);
  console.log(JSON.stringify(result));
} finally {
  await browser.close();
}
