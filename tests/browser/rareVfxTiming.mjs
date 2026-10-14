import assert from 'node:assert/strict';
import { writeFile } from 'node:fs/promises';
import { chromium } from 'playwright';

const prefix = process.env.MALLANG_SCREENSHOT_PREFIX ?? 't4.26-review';
const browser = await chromium.launch({ channel: 'msedge', headless: true });
const report = [];
try {
  for (const viewport of [
    { width: 1280, height: 720 },
    { width: 844, height: 390 },
  ]) {
    const context = await browser.newContext({ viewport });
    await context.grantPermissions(['local-network-access']);
    const page = await context.newPage();
    const errors = [];
    page.on('pageerror', (error) => errors.push(error.message));
    page.on('console', (message) => {
      if (['error', 'warning'].includes(message.type())) errors.push(message.text());
    });
    await page.route('**/rare-vfx-timing', (route) =>
      route.fulfill({
        contentType: 'text/html; charset=utf-8',
        body: '<style>body{margin:0;background:#eef4e7}canvas{width:100vw;height:100vh;display:block}</style><canvas></canvas>',
      }),
    );
    await page.goto('http://127.0.0.1:43195/rare-vfx-timing');
    await page.evaluate(async () => {
      const { loadArtAssets } = await import('/src/app/artAssets.ts');
      window.rareTimingImages = await loadArtAssets();
    });
    for (const id of ['fox', 'redPanda', 'deer']) {
      const samples = [];
      for (const frameMs of [1000 / 120, 1000 / 60, 1000 / 30, 150, 300]) {
        const result = await page.evaluate(
          async ({ id, frameMs }) => {
            const { rareFixture } = await import('/tests/sim/rareFixtures.ts');
            const { lineEnemy } = await import('/tests/sim/lineSniperFixtures.ts');
            const { attackEnemies } = await import('/src/sim/systems/attack.ts');
            const { hashState } = await import('/src/sim/hash.ts');
            const { createBoardView } = await import('/src/view/boardView.ts');
            window.rareTimingView?.dispose();
            const canvas = document.createElement('canvas');
            document.querySelector('canvas').replaceWith(canvas);
            const f = rareFixture(id, true);
            f.state.enemies = [
              lineEnemy(10, 4),
              lineEnemy(11, 3),
              lineEnemy(12, 2),
              lineEnemy(13, 1),
              lineEnemy(14, 1, 1),
            ];
            const view = createBoardView(canvas, f.stage.board, f.content, window.rareTimingImages);
            window.rareTimingView = view;
            view.resize();
            view.onEvents(f.deployment, f.state, true);
            view.render(f.state, 1, 0.5);
            const events = [];
            attackEnemies(f.content, f.stage, f.state, events);
            const before = hashState(f.state);
            view.onEvents(events, f.state);
            for (let elapsed = 0; elapsed < 0.3 - 1e-9; ) {
              const dt = Math.min(frameMs / 1000, 0.3 - elapsed);
              view.render(f.state, 1, dt);
              elapsed += dt;
            }
            return { frameMs, ...view.metrics, stateUnchanged: hashState(f.state) === before };
          },
          { id, frameMs },
        );
        assert(result.stateUnchanged);
        assert(result.particles > 1 && result.particles <= 200);
        samples.push(result);
      }
      assert(samples.every((sample) => sample.particles === samples[0].particles));
      assert(samples.every((sample) => sample.drawCalls === samples[0].drawCalls));
      await page.screenshot({ path: `docs/verification/${prefix}-${viewport.width}-${id}-long-frame.png` });
      report.push({ viewport, unit: id, samples });
    }
    await page.evaluate(() => window.rareTimingView.dispose());
    assert.deepEqual(errors, []);
    console.log(JSON.stringify({ viewport, cases: 15, errors }));
    await context.close();
  }
  await writeFile(`docs/verification/${prefix}-vfx-timing.json`, `${JSON.stringify(report, null, 2)}\n`);
} finally {
  await browser.close();
}
