import assert from 'node:assert/strict';
import { writeFile } from 'node:fs/promises';
import { chromium } from 'playwright';
import { createTestScene } from './scene.mjs';

const uncapped = process.argv.includes('--uncapped');
const browser = await chromium.launch({
  channel: 'msedge',
  headless: true,
  args: uncapped ? ['--disable-frame-rate-limit', '--disable-gpu-vsync'] : [],
});
try {
  const context = await browser.newContext({ viewport: { width: 1920, height: 1080 } });
  await context.grantPermissions(['local-network-access']);
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.route('**/performance-check', (route) =>
    route.fulfill({
      contentType: 'text/html',
      body: '<link rel="stylesheet" href="/src/ui/styles.css"><div id="app"><canvas id="board"></canvas><canvas id="overlay"></canvas></div>',
    }),
  );
  await page.goto('http://127.0.0.1:43195/performance-check');
  await page.evaluate(createTestScene, 60);
  const result = await page.evaluate(async () => {
    const { battle, deliver, render, view } = window.testScene;
    const gl = document.querySelector('#board').getContext('webgl2');
    const debug = gl.getExtension('WEBGL_debug_renderer_info');
    const renderer = debug ? gl.getParameter(debug.UNMASKED_RENDERER_WEBGL) : 'unavailable';
    const intervals = [];
    const baselineIntervals = [];
    const renderTimes = [];
    let last = 0;
    for (let frame = 0; frame < 120; frame++) {
      const now = await new Promise((resolve) => requestAnimationFrame(resolve));
      if (frame > 0) baselineIntervals.push(now - last);
      last = now;
    }
    let peakCalls = 0;
    let peakParticles = 0;
    for (let frame = 0; frame < 480; frame++) {
      const now = await new Promise((resolve) => requestAnimationFrame(resolve));
      if (frame >= 120) intervals.push(now - last);
      last = now;
      if (frame % 8 === 0) {
        const unit = battle.state.units[3];
        const enemy = battle.state.enemies[frame % 60];
        deliver([
          {
            type: 'attack',
            src: { kind: 'unit', uid: unit.uid },
            dst: { kind: 'enemy', uid: enemy.uid },
            ranged: true,
            damageType: 'physical',
          },
          {
            type: 'damage',
            src: { kind: 'unit', uid: unit.uid },
            dst: { kind: 'enemy', uid: enemy.uid },
            amount: 120,
            damageType: 'physical',
          },
        ]);
      }
      if (frame % 30 === 0) deliver([{ type: 'skillPulse', uid: battle.state.units[4].uid }]);
      const start = performance.now();
      render(1 / 60);
      if (frame >= 120) renderTimes.push(performance.now() - start);
      peakCalls = Math.max(peakCalls, view.metrics.drawCalls);
      peakParticles = Math.max(peakParticles, view.metrics.particles);
    }
    renderTimes.sort((a, b) => a - b);
    return {
      renderer,
      baselineFps: 1000 / (baselineIntervals.reduce((sum, n) => sum + n, 0) / baselineIntervals.length),
      enemies: 60,
      units: 8,
      viewport: '1920x1080',
      fps: 1000 / (intervals.reduce((sum, n) => sum + n, 0) / intervals.length),
      renderP95Ms: renderTimes[Math.floor(renderTimes.length * 0.95)],
      peakCalls,
      peakParticles,
      memory: view.memory,
    };
  });
  await writeFile(
    `docs/verification/t3.3-performance${uncapped ? '-uncapped' : ''}.json`,
    `${JSON.stringify({ mode: uncapped ? 'uncapped-throughput' : 'display-paced', ...result, errors }, null, 2)}\n`,
  );
  assert(result.peakCalls <= 120);
  assert(result.peakParticles <= 200);
  assert.deepEqual(errors, []);
  console.log(JSON.stringify(result));
  // Headless의 rAF 자체가 60Hz 미만이면 표시 주기와 렌더 처리량을 별도로 측정합니다.
  const target = uncapped ? 60 : Math.min(58, result.baselineFps * 0.95);
  assert(result.fps >= target, `렌더 성능 목표 ${target.toFixed(1)}fps`);
} finally {
  await browser.close();
}
