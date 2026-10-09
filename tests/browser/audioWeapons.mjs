import assert from 'node:assert/strict';
import { writeFile } from 'node:fs/promises';
import { chromium } from 'playwright';
import { installAudioProbe } from './audioProbe.mjs';
import { enterBattle, frame, pause, resume } from './helpers.mjs';
import { createUnitAuditGame, unitAuditPoint } from './unitAuditScene.mjs';

const expected = {
  squirrel: 0.16,
  cat: 0.18,
  bear: 0.24,
  penguin: 0.26,
  sheep: 0.2,
  bunny: 0.16,
  mole: 0.3,
  snail: 0.22,
  owl: 0.28,
  wolf: 0.26,
};
const report = [];
const prefix = process.env.MALLANG_SCREENSHOT_PREFIX ?? 't4.12';
const browser = await chromium.launch({ channel: 'msedge', headless: true });
try {
  for (const mobile of [false, true]) {
    const context = await browser.newContext({
      viewport: mobile ? { width: 844, height: 390 } : { width: 1920, height: 1080 },
      hasTouch: mobile,
      isMobile: mobile,
    });
    await context.grantPermissions(['local-network-access']);
    const page = await context.newPage();
    const errors = [];
    page.on('pageerror', (error) => errors.push(error.message));
    page.on('console', (message) => {
      if (['error', 'warning'].includes(message.type())) errors.push(message.text());
    });
    const time = new Date('2026-10-09T04:00:00Z');
    await page.clock.install({ time });
    await page.clock.pauseAt(new Date(time.getTime() + 1000));
    await page.addInitScript(installAudioProbe);
    await page.addInitScript(() => {
      window.requestAnimationFrame = (callback) => setTimeout(() => callback(performance.now()), 100);
      window.cancelAnimationFrame = (id) => clearTimeout(id);
    });
    await page.route('**/unit-audit', (route) =>
      route.fulfill({
        contentType: 'text/html',
        body: '<meta name="viewport" content="width=device-width, initial-scale=1"><link rel="stylesheet" href="/src/ui/styles.css"><div id="app"></div>',
      }),
    );
    await page.goto('http://127.0.0.1:43195/unit-audit');
    const click = async (locator) => {
      if (mobile) await locator.tap();
      else await locator.click();
      await frame(page);
    };
    for (const [id, duration] of Object.entries(expected)) {
      await page.evaluate(createUnitAuditGame, { dir: 'right' });
      await enterBattle(page);
      await pause(page);
      const card = page.locator(`.deploy-card[data-unit-id="${id}"]`);
      await card.scrollIntoViewIfNeeded();
      await click(card);
      const point = await page.evaluate(unitAuditPoint);
      if (mobile) await page.touchscreen.tap(point.x, point.y);
      else await page.mouse.click(point.x, point.y);
      await frame(page);
      await click(page.locator('[data-dir="right"]'));
      await page.evaluate(() => {
        window.audioProbe.starts.length = 0;
      });
      await resume(page);
      await frame(page, 500);
      const state = await page.evaluate(() => ({
        attacks: window.unitAudit.events.filter((event) => event.type === 'attack').length,
        rejected: window.unitAudit.events.filter((event) => event.type === 'commandRejected'),
        voices: window.audioProbe.starts,
        contexts: window.audioProbe.contexts.map((context) => context.state),
      }));
      assert(state.attacks > 0, `${id}: 실제 기본 공격`);
      assert.deepEqual(state.rejected, []);
      assert(
        state.voices.some((voice) => Math.abs(voice.duration - duration) < 0.0001),
        `${id}: 무장에 맞는 실제 버퍼`,
      );
      assert(
        state.contexts.slice(0, -1).every((state) => state === 'closed'),
        '이전 게임 컨텍스트 정리',
      );
      await pause(page);
      await page.waitForTimeout(400);
      assert.equal(await page.evaluate(() => window.audioProbe.active.size), 0, '정지 후 버퍼 소스 종료');
      report.push({
        label: mobile ? 'touch' : 'desktop',
        unit: id,
        duration,
        attacks: state.attacks,
        voices: state.voices,
        pausedSources: 0,
      });
    }
    await page.evaluate(() => window.unitAudit.game.dispose());
    await page.waitForFunction(() =>
      window.audioProbe.contexts.every((context) => context.state === 'closed'),
    );
    assert.deepEqual(errors, []);
    await context.close();
  }
  await writeFile(`docs/verification/${prefix}-audio-weapons.json`, `${JSON.stringify(report, null, 2)}\n`);
  console.log(
    JSON.stringify({ cases: report.length, units: Object.keys(expected), pausedSources: 0, errors: [] }),
  );
} finally {
  await browser.close();
}
