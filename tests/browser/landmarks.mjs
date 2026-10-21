import assert from 'node:assert/strict';
import { chromium } from 'playwright';
import { createTestScene } from './scene.mjs';

const browser = await chromium.launch({ channel: 'msedge', headless: true });
try {
  for (const mobile of [false, true]) {
    const context = await browser.newContext({
      viewport: mobile ? { width: 844, height: 390 } : { width: 1920, height: 1080 },
    });
    await context.grantPermissions(['local-network-access']);
    const page = await context.newPage();
    const errors = [];
    page.on('pageerror', (error) => errors.push(error.message));
    await page.route('**/landmarks-check', (route) =>
      route.fulfill({
        contentType: 'text/html',
        body: '<link rel="stylesheet" href="/src/ui/styles.css"><div id="app"><canvas id="board"></canvas><canvas id="overlay"></canvas></div>',
      }),
    );
    await page.goto('http://127.0.0.1:43195/landmarks-check');
    await page.evaluate(createTestScene, 3);
    const checks = await page.evaluate(async () => {
      const { createLandmarks } = await import('/src/view/landmarks.ts');
      const { createTextures } = await import('/src/view/textures.ts');
      const { loadArtAssets } = await import('/src/app/artAssets.ts');
      const { battle, view } = window.testScene;
      const cache = createTextures(await loadArtAssets());
      const markers = createLandmarks(battle.stage.board, cache.textures);
      const portal = markers.group.children[0];
      const pudding = markers.group.children[1].children[0];
      markers.update(view.camera, 0.1);
      const rotation = portal.rotation.y;
      markers.update(view.camera, 0);
      const paused = portal.rotation.y === rotation;
      markers.onEvents([{ type: 'enemyLeak', uid: 1, lifeLeft: 2 }]);
      markers.update(view.camera, 0.05);
      const shake = pudding.position.x !== 0;
      markers.setReducedMotion(true);
      markers.update(view.camera, 0.05);
      const reduced = portal.rotation.y === 0 && pudding.position.x === 0;
      markers.update(view.camera, 1);
      const reset = pudding.material.uniforms.uFlash.value === 0;
      const count = markers.group.children.length;
      markers.dispose();
      cache.dispose();
      return { count, paused, shake, reduced, reset };
    });
    assert.deepEqual(checks, { count: 2, paused: true, shake: true, reduced: true, reset: true });
    const label = mobile ? 'mobile' : 'desktop';
    await page.screenshot({ path: `docs/verification/t3.4-${label}.png` });
    await page.evaluate(() => {
      window.testScene.deliver([{ type: 'enemyLeak', uid: -1, lifeLeft: 2 }]);
      window.testScene.render(0.05);
    });
    await page.screenshot({ path: `docs/verification/t3.4-${label}-leak.png` });
    assert.deepEqual(errors, []);
    console.log(JSON.stringify({ label, checks, errors }));
    await context.close();
  }
} finally {
  await browser.close();
}
