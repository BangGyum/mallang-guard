import assert from 'node:assert/strict';
import { writeFile } from 'node:fs/promises';
import { chromium } from 'playwright';
import { createTestScene } from './scene.mjs';

const prefix = process.env.MALLANG_SCREENSHOT_PREFIX ?? 't4.27';
const browser = await chromium.launch({ channel: 'msedge', headless: true });
const report = [];
try {
  for (const [width, height] of [
    [1920, 1080],
    [844, 390],
  ]) {
    for (const mode of ['normal', 'reduced', 'low']) {
      const page = await browser.newPage({ viewport: { width, height } });
      const errors = [];
      page.on('pageerror', (error) => errors.push(error.message));
      await page.route('**/skill-feedback', (route) =>
        route.fulfill({
          contentType: 'text/html; charset=utf-8',
          body: '<meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="/src/ui/styles.css"><div id="app"><canvas id="board"></canvas><canvas id="overlay"></canvas></div>',
        }),
      );
      await page.goto('http://127.0.0.1:43195/skill-feedback');
      await page.evaluate(createTestScene, 20);
      const start = await page.evaluate(async (mode) => {
        const { hashState } = await import('/src/sim/hash.ts');
        const { battle, view, deliver, render } = window.testScene;
        view.setOptions({ reducedMotion: mode === 'reduced', quality: mode === 'low' ? 'low' : 'high' });
        for (const unit of battle.state.units) {
          const skill = battle.content.skills.get(battle.content.units.get(unit.unitId).skill);
          unit.skillState = skill.durationSec > 0 ? 'active' : 'charging';
        }
        render(1);
        const before = hashState(battle.state);
        const events = battle.state.units.map((unit) => ({
          type: 'skillStart',
          uid: unit.uid,
          skillId: battle.content.units.get(unit.unitId).skill,
        }));
        deliver(events);
        render(0.08);
        window.skillFeedbackHash = before;
        return { ...view.metrics, skills: events.length, stateUnchanged: hashState(battle.state) === before };
      }, mode);
      const shot = () =>
        page.screenshot({ path: `docs/verification/${prefix}-${width}-${mode}-skill-start.png` });
      const first = await shot();
      await page.evaluate(() => window.testScene.render(0));
      const paused = await page.screenshot();
      assert(first.equals(paused), '정지 중 스킬 이펙트 화면 고정');
      const active = await page.evaluate(() => {
        window.testScene.render(0.6);
        return window.testScene.view.metrics;
      });
      await page.screenshot({ path: `docs/verification/${prefix}-${width}-${mode}-skill-active.png` });
      const firing = await page.evaluate(async () => {
        const { hashState } = await import('/src/sim/hash.ts');
        const { battle, view, deliver, render } = window.testScene;
        const events = battle.state.units.flatMap((unit, index) => {
          const def = battle.content.units.get(unit.unitId);
          const count = unit.unitId === 'deer' ? 5 : unit.unitId === 'wolf' ? 3 : 1;
          const targets = Array.from({ length: count }, (_, i) => battle.state.enemies[(index + i) % 20]);
          return targets.map((enemy, i) => ({
            type: 'attack',
            src: { kind: 'unit', uid: unit.uid },
            dst: { kind: 'enemy', uid: enemy.uid },
            damageType: def.damageType,
            ranged: true,
            ...(unit.unitId === 'deer' && i > 0 ? { chainFrom: targets[i - 1].uid } : {}),
          }));
        });
        deliver(events);
        render(0.03);
        return { ...view.metrics, stateUnchanged: hashState(battle.state) === window.skillFeedbackHash };
      });
      await page.screenshot({ path: `docs/verification/${prefix}-${width}-${mode}-skill-fire.png` });
      const attacks = await page.evaluate(async () => {
        const { hashState } = await import('/src/sim/hash.ts');
        const { battle, view, render } = window.testScene;
        render(0.27);
        return { ...view.metrics, stateUnchanged: hashState(battle.state) === window.skillFeedbackHash };
      });
      await page.screenshot({ path: `docs/verification/${prefix}-${width}-${mode}-skill-hits.png` });
      const disposed = await page.evaluate(() => {
        window.testScene.view.dispose();
        return window.testScene.view.memory;
      });
      assert(start.stateUnchanged && firing.stateUnchanged && attacks.stateUnchanged);
      assert.equal(start.skills, 14);
      for (const sample of [start, active, firing, attacks]) {
        assert(sample.particles > 0 && sample.particles <= 200);
        assert(sample.drawCalls <= 120);
      }
      assert.deepEqual(disposed, { geometries: 0, textures: 0 });
      assert.deepEqual(errors, []);
      report.push({
        viewport: `${width}x${height}`,
        mode,
        start,
        active,
        firing,
        attacks,
        paused: true,
        disposed,
        errors,
      });
      console.log(JSON.stringify(report.at(-1)));
      await page.close();
    }
  }
  await writeFile(`docs/verification/${prefix}-skill-feedback.json`, `${JSON.stringify(report, null, 2)}\n`);
} finally {
  await browser.close();
}
