import assert from 'node:assert/strict';
import { writeFile } from 'node:fs/promises';
import { chromium } from 'playwright';
import { installAudioProbe } from './audioProbe.mjs';
import { deploy, enterBattle, frame, pause, resume, tilePoint } from './helpers.mjs';

const prefix = process.env.MALLANG_SCREENSHOT_PREFIX ?? 't4.13';
const report = [];
const savedStages = { 'stage-1': { cleared: true, bestLife: 3 }, 'stage-2': { cleared: true, bestLife: 2 } };
const browser = await chromium.launch({ channel: 'msedge', headless: true });
try {
  for (const [width, height, touch] of [
    [1920, 1080, false],
    [844, 390, true],
    [740, 360, true],
    [390, 844, true],
  ]) {
    const context = await browser.newContext({
      viewport: { width, height },
      hasTouch: touch,
      isMobile: touch,
    });
    await context.grantPermissions(['local-network-access']);
    const page = await context.newPage();
    const errors = [];
    let moduleUrl;
    page.on('request', (request) => {
      if (new URL(request.url()).pathname === '/src/sim/battle.ts') moduleUrl = request.url();
    });
    page.on('pageerror', (error) => errors.push(error.message));
    page.on('console', (message) => {
      if (['error', 'warning'].includes(message.type())) errors.push(message.text());
    });
    const time = new Date('2026-10-09T08:00:00Z');
    await page.clock.install({ time });
    await page.clock.pauseAt(new Date(time.getTime() + 1000));
    await page.addInitScript(installAudioProbe);
    await page.addInitScript(
      ({ stages }) => {
        localStorage.setItem(
          'mallang-guard:v1',
          JSON.stringify({
            version: 1,
            stages,
            settings: { speed: 1, quality: 'low', sfxVolume: 0.7, reducedMotion: false },
          }),
        );
        window.gameFrames = new Set();
        window.requestAnimationFrame = (callback) => {
          const id = setTimeout(() => {
            window.gameFrames.delete(id);
            callback(performance.now());
          }, 100);
          window.gameFrames.add(id);
          return id;
        };
        window.cancelAnimationFrame = (id) => {
          clearTimeout(id);
          window.gameFrames.delete(id);
        };
      },
      { stages: savedStages },
    );
    await page.goto('http://127.0.0.1:43195/');
    await page.locator('.title-screen').waitFor();
    assert(moduleUrl);
    await page.evaluate(async (url) => {
      const { Battle } = await import(url);
      for (const name of ['step', 'flush']) {
        const original = Battle.prototype[name];
        Battle.prototype[name] = function (...args) {
          window.exitBattle = this;
          return original.apply(this, args);
        };
      }
    }, moduleUrl);
    const cdp = await context.newCDPSession(page);
    const doc = await cdp.send('Runtime.evaluate', { expression: 'document' });
    const listeners = async () =>
      (await cdp.send('DOMDebugger.getEventListeners', { objectId: doc.result.objectId })).listeners.filter(
        (listener) =>
          ['keydown', 'pointermove', 'pointerup', 'pointercancel', 'visibilitychange'].includes(
            listener.type,
          ),
      ).length;
    const baseline = await listeners();
    const modes = [
      'preparing',
      'running',
      'paused',
      'preview',
      'aiming',
      ...Array.from({ length: 5 }, () => 'preparing'),
    ];
    for (const [index, mode] of modes.entries()) {
      await enterBattle(page, { waitForStart: mode === 'running' || mode === 'paused' });
      if (mode === 'running' || mode === 'paused') {
        await deploy(page, touch ? cdp : null, 'squirrel', { x: 2, y: 0 }, 'down');
        await resume(page);
        await frame(page, 4200);
        if (mode === 'paused') await pause(page);
      }
      if (mode === 'preview' || mode === 'aiming') {
        await page.locator('.deploy-card[data-unit-id="squirrel"]').click();
        if (mode === 'aiming') {
          const point = await tilePoint(page, { x: 2, y: 0 });
          if (touch) await page.touchscreen.tap(point.x, point.y);
          else await page.mouse.click(point.x, point.y);
        }
        await frame(page);
      }
      const bounds = await page.locator('[data-action="exit"]').boundingBox();
      assert(
        bounds &&
          bounds.width >= 44 &&
          bounds.height >= 44 &&
          bounds.x >= 0 &&
          bounds.y >= 0 &&
          bounds.x + bounds.width <= width &&
          bounds.y + bounds.height <= height,
      );
      assert.equal(
        await page.locator('.battle-wave').textContent(),
        `WAVE ${mode === 'running' || mode === 'paused' ? 1 : 0}/12`,
      );
      if (index === 0)
        await page.screenshot({ path: `docs/verification/${prefix}-${width}x${height}-exit-button.png` });
      if (index === 0 && !touch) {
        await page.locator('[data-action="exit"]').focus();
        await page.keyboard.press('Enter');
      } else if (touch) await page.locator('[data-action="exit"]').tap();
      else await page.locator('[data-action="exit"]').click();
      await frame(page);
      assert.equal(await page.locator('#app').getAttribute('data-screen'), 'title');
      assert.equal(await page.locator('#hud').evaluate((node) => node.children.length), 0);
      assert.equal(await page.evaluate(() => window.gameFrames.size), 0);
      const stopped = await page.evaluate(async () => {
        const { hashState } = await import('/src/sim/hash.ts');
        return hashState(window.exitBattle.state);
      });
      await frame(page, 2000);
      assert.equal(
        await page.evaluate(async () => {
          const { hashState } = await import('/src/sim/hash.ts');
          return hashState(window.exitBattle.state);
        }),
        stopped,
      );
      assert.deepEqual(
        await page.evaluate(() => JSON.parse(localStorage.getItem('mallang-guard:v1')).stages),
        savedStages,
      );
      assert.equal(await listeners(), baseline);
      await page.waitForTimeout(50);
      assert.equal(await page.evaluate(() => window.audioProbe.active.size), 0);
      assert.equal(await page.evaluate(() => window.audioProbe.contexts.length), 1);
    }
    assert.deepEqual(errors, []);
    report.push({
      width,
      height,
      touch,
      cycles: modes.length,
      modes: [...new Set(modes)],
      minButton: 44,
      listeners: baseline,
      pendingFrames: 0,
      activeAudio: 0,
      savesUnchanged: true,
      errors,
    });
    console.log(JSON.stringify(report.at(-1)));
    await context.close();
  }
  await writeFile(`docs/verification/${prefix}-battle-exit.json`, `${JSON.stringify(report, null, 2)}\n`);
} finally {
  await browser.close();
}
