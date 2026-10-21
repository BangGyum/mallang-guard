import assert from 'node:assert/strict';
import { writeFile } from 'node:fs/promises';
import { chromium } from 'playwright';
import { deploy, enterBattle, frame, pause, resume } from './helpers.mjs';

const prefix = process.env.MALLANG_SCREENSHOT_PREFIX ?? 't4.19';
const report = [];
const browser = await chromium.launch({ channel: 'msedge', headless: true });
try {
  for (const mobile of [false, true]) {
    const label = mobile ? 'mobile' : 'desktop';
    const context = await browser.newContext({
      viewport: mobile ? { width: 844, height: 390 } : { width: 1920, height: 1080 },
      hasTouch: mobile,
      isMobile: mobile,
    });
    await context.grantPermissions(['local-network-access']);
    const page = await context.newPage();
    const errors = [];
    let battleUrl;
    let threeUrl;
    page.on('request', (request) => {
      const path = new URL(request.url()).pathname;
      if (path === '/src/sim/battle.ts') battleUrl = request.url();
      if (path === '/node_modules/.vite/deps/three.js') threeUrl = request.url();
    });
    page.on('pageerror', (error) => errors.push(error.message));
    page.on('console', (message) => {
      if (['error', 'warning'].includes(message.type())) errors.push(message.text());
    });
    const time = new Date('2026-10-11T09:00:00Z');
    await page.clock.install({ time });
    await page.clock.pauseAt(new Date(time.getTime() + 1000));
    await page.addInitScript(() => {
      window.requestAnimationFrame = (callback) => setTimeout(() => callback(performance.now()), 100);
      window.cancelAnimationFrame = (id) => clearTimeout(id);
    });
    await page.goto('http://127.0.0.1:43195/');
    await page.locator('.title-screen').waitFor();
    assert(battleUrl && threeUrl);
    await page.evaluate(
      async ({ battleUrl, threeUrl }) => {
        const { Battle } = await import(battleUrl);
        const { Object3D, Scene, InstancedMesh, ShaderMaterial, Matrix4 } = await import(threeUrl);
        window.pausedDeployment = { battle: null, scene: null };
        const flush = Battle.prototype.flush;
        Battle.prototype.flush = function (...args) {
          const events = flush.apply(this, args);
          window.pausedDeployment.battle = this;
          return events;
        };
        const add = Object3D.prototype.add;
        Object3D.prototype.add = function (...args) {
          const result = add.apply(this, args);
          if (this instanceof Scene) window.pausedDeployment.scene = this;
          return result;
        };
        window.pausedDeployment.position = (unitId) => {
          const { battle, scene } = window.pausedDeployment;
          const unit = battle.state.units.find((unit) => unit.unitId === unitId);
          const x = unit.tile.x + 0.5 - battle.stage.board.width / 2;
          const z = unit.tile.y + 0.5 - battle.stage.board.height / 2;
          let position;
          scene.traverse((node) => {
            if (!(node instanceof InstancedMesh && node.material instanceof ShaderMaterial)) return;
            if (!node.material.uniforms.map || !node.geometry.getAttribute('aFlash')) return;
            for (let i = 0; i < node.count; i++) {
              const matrix = new Matrix4();
              node.getMatrixAt(i, matrix);
              const e = matrix.elements;
              if (Math.abs(e[12] - x) < 0.2 && Math.abs(e[14] - z) < 0.001)
                position = { x: e[12], y: e[13], z: e[14] };
            }
          });
          return position;
        };
      },
      { battleUrl, threeUrl },
    );
    const cdp = mobile ? await context.newCDPSession(page) : null;
    const read = (id) =>
      page.evaluate(
        (id) => ({
          position: window.pausedDeployment.position(id),
          state: JSON.parse(JSON.stringify(window.pausedDeployment.battle.state)),
        }),
        id,
      );
    await enterBattle(page, { waitForStart: false });
    await pause(page);
    await deploy(page, cdp, 'squirrel', { x: 2, y: 0 }, 'down');
    const initial = await read('squirrel');
    await frame(page, 2000);
    const held = await read('squirrel');
    await page.screenshot({ path: `docs/verification/${prefix}-${label}-paused-deploy.png` });
    report.push({ viewport: label, mode: 'preparation', ...held, errors });
    assert.equal(held.position?.y, 0.5, '정지 배치의 캐릭터가 고지대에 착지해야 한다');
    assert.deepEqual(held, initial, '정지 중 화면 위치·틱·도토리·SP·적 보존');
    await resume(page, 1);
    await frame(page, 10000);
    await frame(page, 14000);
    await pause(page);
    const before = await read('squirrel');
    assert(before.state.dp >= 8);
    await deploy(page, cdp, 'mole', { x: 3, y: 0 }, 'down');
    const deployed = await read('mole');
    await frame(page, 2000);
    const stopped = await read('mole');
    await page.screenshot({ path: `docs/verification/${prefix}-${label}-midbattle-deploy.png` });
    report.push({ viewport: label, mode: 'midbattle', ...stopped, errors });
    assert.equal(stopped.position?.y, 0.5);
    assert.equal(stopped.state.tick, before.state.tick);
    assert.equal(stopped.state.dp, before.state.dp - 8);
    assert.deepEqual(stopped.state.units[0], before.state.units[0]);
    assert.deepEqual(stopped.state.enemies, before.state.enemies);
    assert.deepEqual(stopped, deployed);
    await resume(page, 1);
    await frame(page, 100);
    assert.equal((await read('mole')).position?.y, 0.5, '재개해도 낙하를 다시 시작하지 않는다');
    assert.deepEqual(errors, []);
    console.log(
      JSON.stringify({ viewport: label, preparation: held.position, midbattle: stopped.position, errors }),
    );
    await context.close();
  }
} finally {
  await writeFile(
    `docs/verification/${prefix}-paused-deployment.json`,
    `${JSON.stringify(report, null, 2)}\n`,
  );
  await browser.close();
}
