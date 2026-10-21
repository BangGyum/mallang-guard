import assert from 'node:assert/strict';
import { writeFile } from 'node:fs/promises';
import { chromium } from 'playwright';

const uncapped = process.argv.includes('--uncapped');
const speed = process.argv.includes('--double-speed') ? 2 : 1;
const suffix = `${uncapped ? '-uncapped' : ''}${speed === 2 ? '-2x' : ''}`;
const prefix = process.env.MALLANG_SCREENSHOT_PREFIX ?? 't4.27-refine';
const browser = await chromium.launch({
  channel: 'msedge',
  headless: true,
  args: uncapped ? ['--disable-frame-rate-limit', '--disable-gpu-vsync'] : [],
});
const report = [];
try {
  for (const viewport of [
    { width: 1920, height: 1080 },
    { width: 844, height: 390 },
  ]) {
    const page = await browser.newPage({ viewport });
    const errors = [];
    page.on('pageerror', (error) => errors.push(error.message));
    await page.addInitScript(() => {
      const request = window.requestAnimationFrame.bind(window);
      window.requestAnimationFrame = (callback) =>
        request((now) => {
          const start = performance.now();
          callback(now);
          const probe = window.frameProbe;
          if (!probe?.active) return;
          probe.costs.push(performance.now() - start);
          if (probe.last !== null) probe.intervals.push(now - probe.last);
          probe.last = now;
        });
    });
    await page.route('**/gameplay-performance', (route) =>
      route.fulfill({
        contentType: 'text/html; charset=utf-8',
        body: '<meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="/src/ui/styles.css"><div id="app"><canvas id="board"></canvas><canvas id="overlay"></canvas><div id="hud"></div></div><button id="measure" style="position:fixed;bottom:0;left:0;z-index:999">측정 시작</button>',
      }),
    );
    await page.goto('http://127.0.0.1:43195/gameplay-performance');
    await page.evaluate(async (speed) => {
      const { rawContent } = await import('/src/data/index.ts');
      const { validateContent } = await import('/src/data/validate.ts');
      const { loadArtAssets } = await import('/src/app/artAssets.ts');
      const { createBattleSession } = await import('/src/app/battleSession.ts');
      const { createSfx } = await import('/src/audio/sfx.ts');
      const { unitAttackSound } = await import('/src/audio/combatSounds.ts');
      const { impactDelays } = await import('/src/view/eventTiming.ts');
      const { skillHasTarget } = await import('/src/sim/systems/skills.ts');
      const raw = structuredClone(rawContent);
      // 22×12 원본 보드 위에 전체 14유닛/60적을 유지하는 부하 전용 데이터입니다.
      for (const unit of raw.units) unit.cost = 1;
      for (const skill of raw.skills) skill.spStart = skill.spCost;
      for (const enemy of raw.enemies) {
        enemy.hp = 1000000;
        enemy.speed = 0.025;
      }
      const stage = raw.stages.find((entry) => entry.id === 'stage-7');
      stage.startDp = raw.units.length;
      stage.deployLimit = raw.units.length;
      stage.spawns = Array.from({ length: 60 }, (_, i) => ({
        wave: 1,
        atSec: 0,
        enemy: ['jelly', 'hardJelly', 'crow'][i % 3],
        count: 1,
        intervalSec: 0,
        route: i % 3 === 2 ? 'air' : i % 2 ? 'lower' : 'ground',
      }));
      const content = validateContent(raw);
      const sound = createSfx(0.7);
      const counts = { attacks: 0, skills: 0, gravityBursts: 0, rejected: 0, peakCalls: 0, peakParticles: 0 };
      let spread = false;
      let lastCommandTick = -1;
      const session = createBattleSession(
        content,
        document.querySelector('#app'),
        {
          stageId: 'stage-7',
          speed,
          automaticQuality: false,
          options: { quality: 'high', reducedMotion: false },
          onMenu() {},
          onExit() {},
          onEnd() {},
          onSpeed() {},
          onEvents(events) {
            const { battle } = session;
            if (!spread && battle.state.enemies.length === 60) {
              // 겹치지 않는 초기 위치 이후에는 실제 이동·공격·스킬 시스템만 사용합니다.
              battle.state.enemies.forEach((enemy, index) => {
                const route = battle.stage.routes.get(enemy.routeId);
                enemy.dist = route.length * (0.08 + (index % 20) * 0.035);
                const p = route.positionAt(enemy.dist, 0);
                enemy.x = enemy.px = p.x;
                enemy.y = enemy.py = p.y;
                enemy.segIndex = p.segIndex;
              });
              spread = true;
            }
            for (const event of events) {
              if (event.type === 'attack') counts.attacks++;
              if (event.type === 'skillStart') counts.skills++;
              if (event.type === 'gravityField' && event.phase === 'burst') counts.gravityBursts++;
              if (event.type === 'commandRejected') counts.rejected++;
            }
            sound.onEvents(events, impactDelays(events), (uid) => {
              const unit = battle.state.units.find((entry) => entry.uid === uid);
              return unit && unitAttackSound(content.units.get(unit.unitId).art);
            });
          },
          onFrame(dt) {
            sound.update(dt);
            counts.peakCalls = Math.max(counts.peakCalls, session.view.metrics.drawCalls);
            counts.peakParticles = Math.max(counts.peakParticles, session.view.metrics.particles);
            if (window.frameProbe?.active && lastCommandTick !== session.battle.state.tick) {
              lastCommandTick = session.battle.state.tick;
              for (const unit of session.battle.state.units)
                if (
                  unit.skillState === 'ready' &&
                  content.skills.get(content.units.get(unit.unitId).skill).trigger === 'manual' &&
                  skillHasTarget(content, session.battle.stage, session.battle.state, unit)
                )
                  session.battle.enqueue({ type: 'activateSkill', uid: unit.uid });
            }
          },
        },
        await loadArtAssets(),
      );
      const tiles = [
        [4, 3],
        [6, 3],
        [9, 3],
        [11, 3],
        [12, 3],
        [15, 3],
        [16, 3],
        [18, 3],
        [6, 5],
        [9, 5],
        [12, 5],
        [18, 5],
        [20, 5],
        [4, 8],
      ];
      raw.units.forEach((unit, i) => {
        session.battle.enqueue({
          type: 'deploy',
          unitId: unit.id,
          tile: { x: tiles[i][0], y: tiles[i][1] },
          dir: i < 8 ? 'up' : 'down',
        });
      });
      session.controls.startInSec = 0;
      window.gameplayPerf = { session, sound, counts };
      window.frameProbe = { active: false, last: null, costs: [], intervals: [] };
    }, speed);
    await page.waitForTimeout(2000);
    await page.getByRole('button', { name: '측정 시작', exact: true }).click();
    await page.evaluate(() => {
      window.frameProbe.active = true;
      document.querySelector('#measure').remove();
    });
    await page.waitForTimeout(8000);
    const result = await page.evaluate(() => {
      const { session, sound, counts } = window.gameplayPerf;
      const probe = window.frameProbe;
      probe.active = false;
      const percentile = (values, ratio) =>
        [...values].sort((a, b) => a - b)[Math.floor(values.length * ratio)];
      const gl = document.querySelector('#board').getContext('webgl2');
      const debug = gl.getExtension('WEBGL_debug_renderer_info');
      const data = {
        renderer: debug ? gl.getParameter(debug.UNMASKED_RENDERER_WEBGL) : 'unavailable',
        board: '22x12',
        units: session.battle.state.units.length,
        enemies: session.battle.state.enemies.length,
        frames: probe.intervals.length,
        fps: 1000 / (probe.intervals.reduce((sum, n) => sum + n, 0) / probe.intervals.length),
        frameP95Ms: percentile(probe.intervals, 0.95),
        frameP99Ms: percentile(probe.intervals, 0.99),
        callbackP95Ms: percentile(probe.costs, 0.95),
        callbackP99Ms: percentile(probe.costs, 0.99),
        framesOver17_7Ms: probe.intervals.filter((n) => n > 17.7).length,
        framesOver8_33Ms: probe.intervals.filter((n) => n > 1000 / 120).length,
        ...counts,
      };
      session.setPaused(true);
      sound.stop();
      return data;
    });
    await page.screenshot({
      path: `docs/verification/${prefix}-${viewport.width}-gameplay-performance${suffix}.png`,
    });
    const pausedTick = await page.evaluate(() => window.gameplayPerf.session.battle.state.tick);
    await page.waitForTimeout(250);
    assert.equal(await page.evaluate(() => window.gameplayPerf.session.battle.state.tick), pausedTick);
    await page.evaluate(() => window.gameplayPerf.session.setPaused(false));
    await page.waitForTimeout(600);
    const resumedTick = await page.evaluate(() => window.gameplayPerf.session.battle.state.tick);
    assert(resumedTick > pausedTick, '정지 후 전투 재개');
    const disposed = await page.evaluate(() => {
      window.gameplayPerf.session.dispose();
      window.gameplayPerf.sound.dispose();
      return window.gameplayPerf.session.view.memory;
    });
    assert.equal(result.units, 14);
    assert.equal(result.enemies, 60);
    assert(result.attacks > 50 && result.skills >= 10, JSON.stringify(result));
    assert(result.gravityBursts > 0, '중력장과 마지막 폭발을 포함한 부하');
    assert.equal(result.rejected, 0);
    assert(result.peakCalls <= 120 && result.peakParticles <= 200, JSON.stringify(result));
    assert.deepEqual(disposed, { geometries: 0, textures: 0 });
    assert.deepEqual(errors, []);
    report.push({
      mode: uncapped ? 'uncapped-throughput' : 'display-paced',
      speed,
      pausedTick,
      resumedTick,
      viewport,
      ...result,
      disposed,
      errors,
    });
    console.log(JSON.stringify(report.at(-1)));
    await page.close();
  }
  await writeFile(
    `docs/verification/${prefix}-gameplay-performance${suffix}.json`,
    `${JSON.stringify(report, null, 2)}\n`,
  );
} finally {
  await browser.close();
}
