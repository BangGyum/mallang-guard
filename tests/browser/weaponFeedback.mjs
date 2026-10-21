import assert from 'node:assert/strict';
import { writeFile } from 'node:fs/promises';
import { chromium } from 'playwright';
import { createTestScene } from './scene.mjs';

const browser = await chromium.launch({ channel: 'msedge', headless: true });
const report = [];
const prefix = process.env.MALLANG_SCREENSHOT_PREFIX ?? 't4.34';
const all = process.argv.includes('--all');
try {
  for (const [width, height] of [
    [1280, 720],
    [844, 390],
  ]) {
    const page = await browser.newPage({ viewport: { width, height } });
    const errors = [];
    page.on('pageerror', (error) => errors.push(error.message));
    await page.route('**/weapon-feedback', (route) =>
      route.fulfill({
        contentType: 'text/html; charset=utf-8',
        body: '<meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="/src/ui/styles.css"><div id="app"><canvas id="board"></canvas><canvas id="overlay"></canvas></div>',
      }),
    );
    await page.goto('http://127.0.0.1:43195/weapon-feedback');
    await page.evaluate(createTestScene, 3);
    await page.evaluate((all) => {
      const { battle, render } = window.testScene;
      battle.state.units = battle.state.units.filter((u) => all || ['wolf', 'redPanda'].includes(u.unitId));
      window.weaponUnits = [...battle.state.units];
      battle.state.units.forEach((u, i) => {
        u.tile = { x: all ? 5 : i ? 5 : 2, y: 2 };
        u.dir = 'right';
      });
      battle.state.enemies = battle.state.enemies.slice(0, 1);
      const target = battle.state.enemies[0];
      target.x = target.px = 9.5;
      target.y = target.py = 2.5;
      target.slowAmount = 0;
      target.stunUntilTick = 0;
      render(1);
    }, all);
    const modes = all
      ? await page.evaluate(() =>
          window.weaponUnits.flatMap((u) => [
            { id: u.unitId, active: false, quiet: false, dir: 'right' },
            { id: u.unitId, active: true, quiet: false, dir: 'left' },
          ]),
        )
      : [
          { id: 'wolf', active: false, quiet: false, dir: 'right' },
          { id: 'redPanda', active: false, quiet: false, dir: 'right' },
          { id: 'redPanda', active: true, quiet: false, dir: 'right' },
          { id: 'redPanda', active: true, quiet: true, dir: 'left' },
        ];
    for (const mode of modes) {
      const label = `${mode.id}-${mode.active ? 'skill' : 'normal'}-${mode.quiet ? 'quiet' : 'full'}`;
      const before = await page.evaluate(async (mode) => {
        const { hashState } = await import('/src/sim/hash.ts');
        const { battle, view, render, deliver } = window.testScene;
        if (window.weaponUnits.length > 2)
          battle.state.units = window.weaponUnits.filter((u) => u.unitId === mode.id);
        view.setOptions({ reducedMotion: mode.quiet, quality: mode.quiet ? 'low' : 'high' });
        for (const u of battle.state.units) u.skillState = 'charging';
        const unit = battle.state.units.find((u) => u.unitId === mode.id);
        unit.skillState = mode.active ? 'active' : 'charging';
        unit.dir = mode.dir;
        const target = battle.state.enemies[0];
        target.x = target.px = mode.dir === 'left' ? 1.5 : 9.5;
        target.y = target.py = mode.dir === 'left' ? 1.5 : 2.5;
        render(1);
        deliver([
          {
            type: 'attack',
            src: { kind: 'unit', uid: unit.uid },
            dst: { kind: 'enemy', uid: target.uid },
            damageType: 'physical',
            ranged: true,
          },
        ]);
        render(0.025);
        return hashState(battle.state);
      }, mode);
      await page.screenshot({ path: `docs/verification/${prefix}-${width}-${label}-fire.png` });
      const paused = await page.screenshot();
      await page.evaluate(() => window.testScene.render(0));
      assert(paused.equals(await page.screenshot()), '정지 시 화면 고정');
      await page.evaluate(() => window.testScene.render(0.1));
      await page.screenshot({ path: `docs/verification/${prefix}-${width}-${label}-flight.png` });
      await page.evaluate(() => window.testScene.render(0.16));
      await page.screenshot({ path: `docs/verification/${prefix}-${width}-${label}-impact.png` });
      const after = await page.evaluate(async () => {
        const { hashState } = await import('/src/sim/hash.ts');
        return { hash: hashState(window.testScene.battle.state), metrics: window.testScene.view.metrics };
      });
      assert.equal(after.hash, before);
      assert(after.metrics.particles <= 200 && after.metrics.drawCalls <= 120);
      report.push({ width, height, ...mode, ...after.metrics });
    }
    const memory = await page.evaluate(() => {
      window.testScene.view.dispose();
      return window.testScene.view.memory;
    });
    assert.deepEqual(memory, { geometries: 0, textures: 0 });
    assert.deepEqual(errors, []);
    await page.close();
  }
  await writeFile(`docs/verification/${prefix}-weapon-feedback.json`, JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report));
} finally {
  await browser.close();
}
