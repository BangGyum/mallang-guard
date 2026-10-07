import assert from 'node:assert/strict';
import { chromium } from 'playwright';
import { deploy, enterBattle, frame } from './helpers.mjs';

const browser = await chromium.launch({
  channel: 'msedge',
  headless: true,
  args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'],
});
try {
  for (const mobile of process.argv.includes('--mobile') ? [true] : [false, true]) {
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
      if (['warning', 'error'].includes(message.type())) errors.push(message.text());
    });
    const time = new Date('2026-10-07T03:00:00Z');
    await page.clock.install({ time });
    await page.clock.pauseAt(time);
    await page.addInitScript(() => {
      const frames = new Set();
      window.requestAnimationFrame = (callback) => {
        const id = setTimeout(() => {
          frames.delete(id);
          callback(performance.now());
        }, 100);
        frames.add(id);
        return id;
      };
      window.cancelAnimationFrame = (id) => {
        clearTimeout(id);
        frames.delete(id);
      };
      window.pendingGameFrames = () => frames.size;
      localStorage.setItem(
        'mallang-guard:v1',
        JSON.stringify({
          version: 1,
          settings: { speed: 2, quality: 'low', sfxVolume: 0.35, reducedMotion: true },
          stages: { 'stage-1': { cleared: true, bestLife: 2 } },
        }),
      );
    });
    await page.goto('http://127.0.0.1:43195/');
    await page.locator('.title-screen').waitFor();
    await page.evaluate(() => {
      window.flowMarker = true;
    });
    assert.match(await page.locator('.title-record').textContent(), /최고 푸딩 2개/);
    await page.screenshot({ path: `docs/verification/t2.4-${mobile ? 'mobile' : 'desktop'}-title.png` });
    const cdp = await context.newCDPSession(page);
    const documentObject = await cdp.send('Runtime.evaluate', { expression: 'document' });
    const listenerCount = async () => {
      const { listeners } = await cdp.send('DOMDebugger.getEventListeners', {
        objectId: documentObject.result.objectId,
      });
      return listeners.filter((listener) =>
        ['keydown', 'pointermove', 'pointerup', 'pointercancel', 'visibilitychange'].includes(listener.type),
      ).length;
    };
    const baseline = await listenerCount();
    await enterBattle(page);
    assert.equal(await page.getByRole('button', { name: '전투 배속 변경' }).textContent(), '×2');
    await page.keyboard.press('1');
    await frame(page);
    await page.locator('[data-action="pause"]').click();
    await frame(page);
    assert.equal(await page.locator('.pause-menu').isVisible(), true);
    assert.equal(await page.locator('#hud').evaluate((node) => node.inert), true);
    await page.keyboard.press('2');
    await frame(page, 2000);
    assert.equal(
      await page.getByRole('button', { name: '전투 배속 변경', includeHidden: true }).textContent(),
      '×1',
    );
    assert.equal(await page.locator('.dp-panel strong').textContent(), '10');
    await page.screenshot({ path: `docs/verification/t2.4-${mobile ? 'mobile' : 'desktop'}-pause.png` });
    await page.keyboard.press('Escape');
    await frame(page);
    assert.equal(await page.locator('.pause-menu').count(), 0);
    await deploy(page, mobile ? cdp : null, 'squirrel', { x: 2, y: 0 }, 'down');
    assert.equal(await page.locator('.dp-panel strong').textContent(), '1');
    await frame(page, 2000);
    assert.equal(await page.locator('.dp-panel strong').textContent(), '1');
    await page.keyboard.press('Escape');
    await frame(page);
    assert.equal(await page.locator('.pause-menu').isVisible(), true);
    await page.getByRole('button', { name: '다시 시작', exact: true }).click();
    await frame(page);
    assert.equal(await page.locator('.deploy-card[data-unit-id="squirrel"]').isVisible(), true);
    assert.equal(await page.locator('.dp-panel strong').textContent(), '10');
    await frame(page, 27000);
    assert.equal(await page.locator('.battle-result').getAttribute('data-result'), 'lost');
    assert.equal(await page.evaluate(() => window.pendingGameFrames()), 0);
    await page.screenshot({ path: `docs/verification/t2.4-${mobile ? 'mobile' : 'desktop'}-lost.png` });
    await page.getByRole('button', { name: '타이틀로', exact: true }).click();
    await frame(page);
    // 반복 검증은 작은 화면에서 진행해 소프트웨어 WebGL 렌더 비용을 줄입니다.
    await page.setViewportSize({ width: 740, height: 360 });
    for (let i = 0; i < 10; i++) {
      await enterBattle(page);
      await frame(page, 27000);
      assert.equal(await page.locator('.battle-result').getAttribute('data-result'), 'lost');
      await page.getByRole('button', { name: '다시 하기', exact: true }).click();
      await frame(page);
      assert.equal(await page.locator('.dp-panel strong').textContent(), '10');
      assert.equal(await page.locator('.deploy-card').count(), 8);
      await page.locator('[data-action="pause"]').click();
      await frame(page);
      await page.getByRole('button', { name: '타이틀로', exact: true }).click();
      await frame(page);
      assert.equal(await page.locator('#hud').evaluate((node) => node.childElementCount), 0);
      assert.equal(await page.locator('.rotate-guide').count(), 0);
      assert.equal(await page.locator('dialog').count(), 0);
      assert.equal(await page.evaluate(() => window.pendingGameFrames()), 0);
      assert.equal(await listenerCount(), baseline);
    }
    assert.equal(await page.evaluate(() => window.flowMarker), true, '새로고침 없이 재시작');
    const save = await page.evaluate(() => JSON.parse(localStorage.getItem('mallang-guard:v1')));
    assert.deepEqual(save.settings, { speed: 1, quality: 'low', sfxVolume: 0.35, reducedMotion: true });
    assert.deepEqual(save.stages['stage-1'], { cleared: true, bestLife: 2 });
    assert.deepEqual(errors, []);
    console.log(
      JSON.stringify({
        input: mobile ? 'touch' : 'mouse',
        cycles: 10,
        storedSpeed: save.settings.speed,
        listeners: baseline,
        errors,
      }),
    );
    await context.close();
  }
} finally {
  await browser.close();
}
