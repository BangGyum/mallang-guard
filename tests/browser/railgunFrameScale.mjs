import assert from 'node:assert/strict';
import { writeFile } from 'node:fs/promises';
import { chromium } from 'playwright';
import { createTestScene } from './scene.mjs';

const prefix = process.env.MALLANG_SCREENSHOT_PREFIX ?? 't4.27-railgun-review';
const browser = await chromium.launch({ channel: 'msedge', headless: true });
const report = [];
try {
  for (const [from, to] of [
    [1, 2],
    [2, 1],
    [2, 2],
  ]) {
    const page = await browser.newPage({ viewport: { width: 844, height: 390 } });
    const errors = [];
    page.on('pageerror', (error) => errors.push(error.message));
    await page.route('**/railgun-scale', (route) =>
      route.fulfill({
        contentType: 'text/html',
        body: '<meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="/src/ui/styles.css"><div id="app"><canvas id="board"></canvas><canvas id="overlay"></canvas></div>',
      }),
    );
    await page.goto('http://127.0.0.1:43195/railgun-scale');
    await page.evaluate(createTestScene, 3);
    const result = await page.evaluate(
      async ({ from, to }) => {
        const { createOverlay } = await import('/src/view/overlay.ts');
        const { battle, view, overlay } = window.testScene;
        const canvas = document.querySelector('#overlay');
        const fox = battle.state.units.find((u) => u.unitId === 'fox');
        const event = [{ type: 'skillStart', uid: fox.uid, skillId: 'polarAim' }];
        const draw = (dt = 0) => overlay.render(battle.state, view.camera, 1, dt);
        Object.defineProperty(window, 'devicePixelRatio', { configurable: true, value: from });
        overlay.setOptions({ quality: 'high', reducedMotion: false });
        overlay.resize();
        overlay.onEvents(event, view.entityPosition);
        draw(1);
        if (from === to) {
          overlay.setOptions({ quality: 'low', reducedMotion: false });
          overlay.resize();
          draw();
          overlay.setOptions({ quality: 'high', reducedMotion: false });
        }
        Object.defineProperty(window, 'devicePixelRatio', { configurable: true, value: to });
        overlay.resize();
        draw();
        const freshCanvas = document.createElement('canvas');
        freshCanvas.style.cssText = `position:absolute;opacity:0;pointer-events:none;width:${canvas.clientWidth}px;height:${canvas.clientHeight}px;`;
        document.body.append(freshCanvas);
        const fresh = createOverlay(freshCanvas, battle.stage.board, battle.content);
        fresh.setOptions({ quality: 'high', reducedMotion: false });
        fresh.resize();
        fresh.onEvents(event, view.entityPosition);
        fresh.render(battle.state, view.camera, 1, 1);
        const current = canvas.getContext('2d').getImageData(0, 0, canvas.width, canvas.height).data;
        const expected = freshCanvas.getContext('2d').getImageData(0, 0, canvas.width, canvas.height).data;
        let changed = 0;
        let maxAlphaDelta = 0;
        for (let y = 0; y < canvas.height; y++)
          for (let x = 0; x < canvas.width; x++) {
            if (x >= 44 * to && y >= 44 * to && x < canvas.width - 44 * to && y < canvas.height - 44 * to)
              continue;
            const i = (y * canvas.width + x) * 4 + 3;
            const delta = Math.abs(current[i] - expected[i]);
            if (delta > 1) changed++;
            maxAlphaDelta = Math.max(maxAlphaDelta, delta);
          }
        fresh.dispose();
        freshCanvas.remove();
        return { changed, maxAlphaDelta, pixels: [canvas.width, canvas.height] };
      },
      { from, to },
    );
    await page.screenshot({ path: `docs/verification/${prefix}-dpr-${from}-${to}.png` });
    await page.evaluate(() => {
      window.testScene.overlay.dispose();
      window.testScene.view.dispose();
    });
    report.push({ from, to, qualityToggle: from === to, ...result, errors });
    console.log(JSON.stringify(report.at(-1)));
    await page.close();
  }
  await writeFile(`docs/verification/${prefix}-scale.json`, `${JSON.stringify(report, null, 2)}\n`);
  for (const result of report) {
    assert.equal(result.changed, 0, '배율/품질 변경 후 새 오버레이와 같은 테두리');
    assert.deepEqual(result.errors, []);
  }
} finally {
  await browser.close();
}
