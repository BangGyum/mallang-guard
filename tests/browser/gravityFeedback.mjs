import assert from 'node:assert/strict';
import { writeFile } from 'node:fs/promises';
import { chromium } from 'playwright';

const prefix = process.env.MALLANG_SCREENSHOT_PREFIX ?? 't4.44';
const browser = await chromium.launch({ channel: 'msedge', headless: true });
const report = [];
try {
  for (const [width, height] of [
    [1280, 720],
    [844, 390],
  ]) {
    const page = await browser.newPage({ viewport: { width, height } });
    const errors = [];
    page.on('pageerror', (error) => errors.push(error.message));
    await page.route('**/gravity-feedback', (route) =>
      route.fulfill({
        contentType: 'text/html; charset=utf-8',
        body: '<style>body{margin:0;background:#eef4e7}canvas{width:100vw;height:100vh;display:block}</style><canvas></canvas>',
      }),
    );
    await page.goto('http://127.0.0.1:43195/gravity-feedback');
    await page.evaluate(async () => {
      const { loadArtAssets } = await import('/src/app/artAssets.ts');
      window.gravityImages = await loadArtAssets();
    });
    for (const mode of ['normal', 'reduced', 'low']) {
      await page.evaluate(async (mode) => {
        const { rareFixture } = await import('/tests/sim/rareFixtures.ts');
        const { lineEnemy } = await import('/tests/sim/lineSniperFixtures.ts');
        const { applyCommand } = await import('/src/sim/systems/commands.ts');
        const { updateSkillTimers } = await import('/src/sim/systems/skills.ts');
        const { updateStatus } = await import('/src/sim/systems/status.ts');
        const { createBoardView } = await import('/src/view/boardView.ts');
        const { hashState } = await import('/src/sim/hash.ts');
        window.gravityCase?.view.dispose();
        const canvas = document.createElement('canvas');
        document.querySelector('canvas').replaceWith(canvas);
        const f = rareFixture('snowLeopard');
        f.state.enemies = [lineEnemy(10, 3)];
        f.unit.sp = f.skill.spCost;
        f.unit.skillState = 'ready';
        const view = createBoardView(canvas, f.stage.board, f.content, window.gravityImages);
        view.setOptions({ quality: mode === 'low' ? 'low' : 'high', reducedMotion: mode === 'reduced' });
        view.resize();
        view.render(f.state, 1, 1);
        const events = [];
        applyCommand(f.content, f.stage, f.state, { type: 'activateSkill', uid: f.unit.uid }, events);
        if (f.unit.skillState !== 'active' || !f.unit.gravityCenter) throw new Error('중력장 발동 실패');
        view.onEvents(events, f.state);
        window.gravityCase = { ...f, view };
        window.renderGravity = (phase, dt) => {
          if (phase === 'charge') f.state.tick = f.unit.skillEndTick - 12;
          if (phase === 'burst') {
            f.state.tick = f.unit.skillEndTick;
            const events = [];
            updateSkillTimers(f.content, f.stage, f.state, events);
            if (!events.some((e) => e.type === 'gravityField' && e.phase === 'burst'))
              throw new Error('폭발 누락');
            view.onEvents(events, f.state);
          }
          if (phase === 'done') updateStatus(f.content, f.stage, f.state, []);
          const before = hashState(f.state);
          view.render(f.state, 1, dt);
          return { ...view.metrics, stateUnchanged: hashState(f.state) === before };
        };
      }, mode);
      const samples = [];
      for (const phase of ['start', 'charge', 'burst']) {
        const sample = await page.evaluate((phase) => window.renderGravity(phase, 0.3), phase);
        assert(sample.stateUnchanged);
        assert(sample.drawCalls <= 120 && sample.particles <= 200);
        samples.push({ phase, ...sample });
        const shot = await page.screenshot({
          path: `docs/verification/${prefix}-${width}-${mode}-gravity-${phase}.png`,
        });
        await page.evaluate(() => window.renderGravity('pause', 0));
        assert(shot.equals(await page.screenshot()), '중력장 일시정지 화면 고정');
      }
      const done = await page.evaluate(() => window.renderGravity('done', 1));
      assert.equal(done.particles, 0, '종료 후 잔여 파티클 없음');
      assert(done.stateUnchanged);
      report.push({ width, height, mode, samples, done });
    }
    const memory = await page.evaluate(() => {
      window.gravityCase.view.dispose();
      return window.gravityCase.view.memory;
    });
    assert.deepEqual(memory, { geometries: 0, textures: 0 });
    assert.deepEqual(errors, []);
    await page.close();
  }
  await writeFile(`docs/verification/${prefix}-gravity-feedback.json`, JSON.stringify(report, null, 2));
  console.log(JSON.stringify({ cases: report.length, paused: true, errors: [] }));
} finally {
  await browser.close();
}
