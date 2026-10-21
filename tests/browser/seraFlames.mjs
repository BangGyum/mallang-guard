import assert from 'node:assert/strict';
import { writeFile } from 'node:fs/promises';
import { chromium } from 'playwright';
import { installAudioProbe } from './audioProbe.mjs';

const prefix = process.env.MALLANG_SCREENSHOT_PREFIX ?? 't4.41';
const browser = await chromium.launch({ channel: 'msedge', headless: true });
const report = [];
try {
  for (const viewport of [
    { width: 1280, height: 720 },
    { width: 844, height: 390 },
  ]) {
    const page = await browser.newPage({ viewport });
    const errors = [];
    page.on('pageerror', (error) => errors.push(error.message));
    await page.addInitScript(installAudioProbe);
    await page.route('**/sera-flames', (route) =>
      route.fulfill({
        contentType: 'text/html; charset=utf-8',
        body: '<style>body{margin:0;background:#eef4e7}canvas{width:100vw;height:100vh;display:block}</style><canvas></canvas>',
      }),
    );
    await page.goto('http://127.0.0.1:43195/sera-flames');
    await page.evaluate(async () => {
      const { loadArtAssets } = await import('/src/app/artAssets.ts');
      const { createSfx } = await import('/src/audio/sfx.ts');
      window.flameImages = await loadArtAssets();
      window.flameSfx = createSfx(0.7);
    });
    await page.mouse.click(10, 10);
    await page.waitForFunction(() => window.audioProbe.contexts[0]?.state === 'running');
    for (const active of [false, true])
      for (const mode of ['normal', 'reduced', 'low']) {
        const before = await page.evaluate(
          async ({ active, mode }) => {
            const { rareFixture } = await import('/tests/sim/rareFixtures.ts');
            const { lineEnemy } = await import('/tests/sim/lineSniperFixtures.ts');
            const { attackEnemies } = await import('/src/sim/systems/attack.ts');
            const { hashState } = await import('/src/sim/hash.ts');
            const { createBoardView } = await import('/src/view/boardView.ts');
            const { impactDelays } = await import('/src/view/eventTiming.ts');
            const { unitAttackSound } = await import('/src/audio/combatSounds.ts');
            const f = rareFixture('deer', active);
            f.state.enemies = [
              lineEnemy(10, 4),
              lineEnemy(11, 3),
              lineEnemy(12, 2),
              lineEnemy(13, 1),
              lineEnemy(14, 1, 1),
            ];
            const canvas = document.createElement('canvas');
            document.querySelector('canvas').replaceWith(canvas);
            const view = createBoardView(canvas, f.stage.board, f.content, window.flameImages);
            view.setOptions({ reducedMotion: mode === 'reduced', quality: mode === 'low' ? 'low' : 'high' });
            view.resize();
            view.onEvents(f.deployment, f.state, true);
            view.render(f.state, 1, 0.5);
            const events = [];
            attackEnemies(f.content, f.stage, f.state, events);
            view.onEvents(events, f.state);
            window.flameSfx.reset();
            window.audioProbe.starts.length = 0;
            window.flameSfx.onEvents(events, impactDelays(events), () => unitAttackSound('deer'));
            window.flameScene = { f, view };
            return {
              hash: hashState(f.state),
              targets: events.filter((event) => event.type === 'attack').length,
              audio: [...window.audioProbe.starts],
            };
          },
          { active, mode },
        );
        assert.equal(before.targets, active ? 5 : 3);
        assert.equal(before.audio.length, 1, '연쇄 발사음은 한 번');
        assert(Math.abs(before.audio[0].duration - 0.24) < 0.0001, '세라 전용 화염 발사음');
        const label = `${prefix}-${viewport.width}-sera-${active ? 'skill' : 'normal'}-${mode}`;
        for (const [phase, dt] of [
          ['flight', 0.12],
          ['impact', 0.15],
          ['bloom', 0.07],
        ]) {
          const voices = await page.evaluate((dt) => {
            const { f, view } = window.flameScene;
            view.render(f.state, 1, dt);
            window.flameSfx.update(dt);
            return [...window.audioProbe.starts];
          }, dt);
          assert.equal(voices.length, phase === 'flight' ? 1 : 2, '도착 후 한 번의 연쇄 명중음');
          if (phase !== 'flight') assert(Math.abs(voices[1].duration - 0.21) < 0.0001, '화염 명중음');
          await page.screenshot({ path: `docs/verification/${label}-${phase}.png` });
        }
        const paused = await page.screenshot();
        await page.evaluate(() => {
          const { f, view } = window.flameScene;
          view.render(f.state, 1, 0);
          window.flameSfx.update(0);
        });
        assert(paused.equals(await page.screenshot()), '정지 중 불꽃 고정');
        const result = await page.evaluate(async () => {
          const { hashState } = await import('/src/sim/hash.ts');
          const { f, view } = window.flameScene;
          const metrics = view.metrics;
          view.render(f.state, 1, 0.6);
          view.dispose();
          return { hash: hashState(f.state), metrics, memory: view.memory };
        });
        assert.equal(result.hash, before.hash);
        assert(result.metrics.particles <= 200 && result.metrics.drawCalls <= 120);
        assert.deepEqual(result.memory, { geometries: 0, textures: 0 });
        report.push({ viewport, active, mode, targets: before.targets, ...result.metrics });
      }
    assert.deepEqual(errors, []);
    await page.evaluate(() => window.flameSfx.dispose());
    await page.waitForFunction(() =>
      window.audioProbe.contexts.every((context) => context.state === 'closed'),
    );
    await page.close();
  }
  await writeFile(`docs/verification/${prefix}-sera-flames.json`, JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report));
} finally {
  await browser.close();
}
