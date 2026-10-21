import assert from 'node:assert/strict';
import { writeFile } from 'node:fs/promises';
import { chromium } from 'playwright';
import { installAudioProbe } from './audioProbe.mjs';

const prefix = process.env.MALLANG_SCREENSHOT_PREFIX ?? 't4.39';
const browser = await chromium.launch({ channel: 'msedge', headless: true });
const report = [];
try {
  for (const [width, height] of [
    [1280, 720],
    [844, 390],
    [320, 568],
  ]) {
    const page = await browser.newPage({ viewport: { width, height } });
    const errors = [];
    page.on('pageerror', (error) => errors.push(error.message));
    await page.addInitScript(installAudioProbe);
    await page.route('**/pulse-feedback', (route) =>
      route.fulfill({
        contentType: 'text/html; charset=utf-8',
        body: '<meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="/src/ui/styles.css"><div id="app"><canvas id="board"></canvas><canvas id="overlay"></canvas></div><button style="position:fixed;top:8px;left:8px">폭격 검사</button>',
      }),
    );
    await page.goto('http://127.0.0.1:43195/pulse-feedback');
    await page.evaluate(async () => {
      const { loadArtAssets } = await import('/src/app/artAssets.ts');
      const { createSfx } = await import('/src/audio/sfx.ts');
      window.pulseImages = await loadArtAssets();
      window.pulseSfx = createSfx(0.7);
    });
    await page.getByRole('button').click();
    await page.waitForFunction(() => window.audioProbe.contexts[0]?.state === 'running');
    for (const mode of ['normal', 'reduced', 'low']) {
      const start = await page.evaluate(async (mode) => {
        const { skillFixture } = await import('/tests/sim/skillFixtures.ts');
        const { removeDead } = await import('/src/sim/systems/death.ts');
        const { createBoardView } = await import('/src/view/boardView.ts');
        const { createOverlay } = await import('/src/view/overlay.ts');
        const { impactDelays } = await import('/src/view/eventTiming.ts');
        const { hashState } = await import('/src/sim/hash.ts');
        window.pulseCase?.view.dispose();
        window.pulseCase?.overlay.dispose();
        window.pulseSfx.reset();
        const canvas = document.createElement('canvas');
        canvas.id = 'board';
        document.querySelector('#board').replaceWith(canvas);
        const f = skillFixture('sheep');
        f.enemy.enemyId = 'splitJelly';
        f.enemy.hp = 1;
        const view = createBoardView(canvas, f.stage.board, f.content, window.pulseImages);
        const overlay = createOverlay(document.querySelector('#overlay'), f.stage.board, f.content);
        const options = { quality: mode === 'low' ? 'low' : 'high', reducedMotion: mode === 'reduced' };
        view.setOptions(options);
        overlay.setOptions(options);
        view.resize();
        overlay.resize();
        view.render(f.state, 1, 1);
        f.activate();
        removeDead(f.content, f.stage, f.state, f.events);
        const delays = impactDelays(f.events);
        const before = hashState(f.state),
          sources = window.audioProbe.sources;
        view.onEvents(f.events, f.state);
        overlay.onEvents(f.events, view.entityPosition);
        window.pulseSfx.onEvents(f.events, delays, () => 'magic');
        window.pulseCase = { ...f, view, overlay, before, sources };
        window.renderPulse = (dt) => {
          view.render(f.state, 1, dt);
          overlay.render(f.state, view.camera, 1, dt);
          window.pulseSfx.update(dt);
          return {
            ...view.metrics,
            sources: window.audioProbe.sources - sources,
            stateUnchanged: hashState(f.state) === before,
            parentVisible: !!view.entityPosition(f.enemy.uid),
          };
        };
        return f.events
          .filter((e) => ['damage', 'enemyDie', 'enemySpawn'].includes(e.type))
          .map((e) => ({ type: e.type, delay: delays.get(e) }));
      }, mode);
      assert(start.some((e) => e.type === 'damage') && start.some((e) => e.type === 'enemySpawn'));
      assert(start.every((e) => e.delay === 0.4));
      await page.evaluate(() => window.renderPulse(0.2));
      const shot = await page.screenshot({
        path: `docs/verification/${prefix}-${width}-${mode}-pulse-falling.png`,
      });
      await page.evaluate(() => window.renderPulse(0));
      assert(shot.equals(await page.screenshot()), '일시정지 동안 낙하·피해 연출 고정');
      const falling = await page.evaluate(() => window.renderPulse(0.19));
      assert.equal(falling.sources, 1, '폭격 도착 전에는 스킬 발동음만 재생');
      assert(falling.parentVisible);
      const impact = await page.evaluate(() => window.renderPulse(0.02));
      assert.equal(impact.sources, 3, '도착 시 명중음·처치음 동시 재생');
      await page.screenshot({ path: `docs/verification/${prefix}-${width}-${mode}-pulse-impact.png` });
      const done = await page.evaluate(() => window.renderPulse(0.26));
      assert.equal(done.parentVisible, false);
      for (const sample of [falling, impact, done]) {
        assert(sample.stateUnchanged);
        assert(sample.particles <= 200 && sample.drawCalls <= 120);
      }
      report.push({ width, height, mode, delays: start, falling, impact, done });
    }
    const memory = await page.evaluate(() => {
      window.pulseCase.view.dispose();
      window.pulseCase.overlay.dispose();
      window.pulseSfx.dispose();
      return window.pulseCase.view.memory;
    });
    assert.deepEqual(memory, { geometries: 0, textures: 0 });
    assert.deepEqual(errors, []);
    await page.close();
  }
  await writeFile(`docs/verification/${prefix}-pulse-feedback.json`, JSON.stringify(report, null, 2));
  console.log(JSON.stringify({ cases: report.length, paused: true, audioSynced: true, errors: [] }));
} finally {
  await browser.close();
}
