import assert from 'node:assert/strict';
import { writeFile } from 'node:fs/promises';
import { chromium } from 'playwright';
import { enterBattle, frame, pause, resume } from './helpers.mjs';
import { createTestScene } from './scene.mjs';
import { createUnitAuditGame, unitAuditPoint } from './unitAuditScene.mjs';

const prefix = process.env.MALLANG_SCREENSHOT_PREFIX ?? 't4.27-railgun';
const browser = await chromium.launch({ channel: 'msedge', headless: true });
const report = [];
const markup =
  '<meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="/src/ui/styles.css"><div id="app"><canvas id="board"></canvas><canvas id="overlay"></canvas></div>';
const corner = () => {
  const canvas = document.querySelector('#overlay');
  const pixels = canvas.getContext('2d').getImageData(0, 0, 32, 32).data;
  return pixels.some((n, i) => i % 4 === 3 && n > 0);
};
try {
  for (const viewport of [
    { width: 1920, height: 1080 },
    { width: 844, height: 390 },
    { width: 390, height: 844 },
  ]) {
    for (const mode of ['normal', 'reduced', 'low']) {
      const page = await browser.newPage({ viewport });
      const errors = [];
      page.on('pageerror', (error) => errors.push(error.message));
      await page.route('**/railgun-frame', (route) =>
        route.fulfill({ contentType: 'text/html; charset=utf-8', body: markup }),
      );
      await page.goto('http://127.0.0.1:43195/railgun-frame');
      await page.evaluate(createTestScene, 20);
      const result = await page.evaluate(async (mode) => {
        const { hashState } = await import('/src/sim/hash.ts');
        const { battle, view, overlay, deliver, render } = window.testScene;
        const options = { reducedMotion: mode === 'reduced', quality: mode === 'low' ? 'low' : 'high' };
        view.setOptions(options);
        overlay.setOptions(options);
        overlay.resize();
        battle.state.units.find((u) => u.unitId === 'squirrel').skillState = 'charging';
        const fox = battle.state.units.find((u) => u.unitId === 'fox');
        render(0);
        const canvas = document.querySelector('#overlay');
        const ctx = canvas.getContext('2d');
        const before = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
        const stateHash = hashState(battle.state);
        deliver([{ type: 'skillStart', uid: fox.uid, skillId: 'polarAim' }]);
        render(0);
        const after = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
        let edgeChanges = 0;
        let centerChanges = 0;
        let centerRgbDelta = 0;
        for (let y = 0; y < canvas.height; y++)
          for (let x = 0; x < canvas.width; x++) {
            const i = (y * canvas.width + x) * 4;
            if (
              after[i] === before[i] &&
              after[i + 1] === before[i + 1] &&
              after[i + 2] === before[i + 2] &&
              after[i + 3] === before[i + 3]
            )
              continue;
            if (x >= 44 && y >= 44 && x < canvas.width - 44 && y < canvas.height - 44) {
              if (before[i + 3] !== after[i + 3]) centerChanges++;
              // Canvas 읽기 전후의 premultiplied RGB 반올림(1/255)은 가림과 구분합니다.
              centerRgbDelta = Math.max(
                centerRgbDelta,
                ...[0, 1, 2].map((c) => Math.abs(before[i + c] - after[i + c])),
              );
            } else edgeChanges++;
          }
        window.railgunStateHash = stateHash;
        render(0.08);
        return {
          edgeChanges,
          centerChanges,
          centerRgbDelta,
          stateUnchanged: hashState(battle.state) === stateHash,
        };
      }, mode);
      assert(result.edgeChanges > 100);
      assert.equal(result.centerChanges, 0, '중앙 알파 값 유지');
      assert(result.centerRgbDelta <= 1, '중앙 RGB는 반올림 오차 이내');
      const base = `${prefix}-${viewport.width}x${viewport.height}-${mode}`;
      const first = await page.screenshot({ path: `docs/verification/${base}-start.png` });
      await page.evaluate(() => window.testScene.render(0));
      assert(first.equals(await page.screenshot()), '정지 중 화면 바이트 일치');
      await page.evaluate(() => window.testScene.render(0.9));
      await page.screenshot({ path: `docs/verification/${base}-active.png` });
      const firing = await page.evaluate(async () => {
        const { hashState } = await import('/src/sim/hash.ts');
        const { battle, view, deliver, render } = window.testScene;
        const fox = battle.state.units.find((u) => u.unitId === 'fox');
        deliver([
          {
            type: 'attack',
            src: { kind: 'unit', uid: fox.uid },
            dst: { kind: 'enemy', uid: battle.state.enemies[0].uid },
            damageType: 'physical',
            ranged: true,
          },
        ]);
        render(0.04);
        return { ...view.metrics, stateUnchanged: hashState(battle.state) === window.railgunStateHash };
      });
      await page.screenshot({ path: `docs/verification/${base}-fire.png` });
      const longFrame = await page.evaluate(() => {
        const { battle, deliver, render } = window.testScene;
        const canvas = document.querySelector('#overlay');
        const alpha = () =>
          canvas.getContext('2d').getImageData(1, Math.floor(canvas.height / 2), 1, 1).data[3];
        render(1);
        const steady = alpha();
        const fox = battle.state.units.find((u) => u.unitId === 'fox');
        deliver([
          {
            type: 'attack',
            src: { kind: 'unit', uid: fox.uid },
            dst: { kind: 'enemy', uid: battle.state.enemies[0].uid },
            damageType: 'physical',
            ranged: true,
          },
        ]);
        render(0.5);
        const pulse = alpha();
        render(0.21);
        return { steady, pulse, ended: alpha() };
      });
      if (mode === 'normal') assert(longFrame.pulse > longFrame.steady, '긴 프레임에도 사격 점등 표시');
      else assert.equal(longFrame.pulse, longFrame.steady, '모션 감소/낮은 품질은 사격 점등 생략');
      assert.equal(longFrame.ended, longFrame.steady, '사격 점등 만료');
      if (mode === 'normal') {
        await page.setViewportSize({ width: viewport.width - 40, height: viewport.height - 20 });
        await page.evaluate(() => {
          window.testScene.view.resize();
          window.testScene.overlay.resize();
          window.testScene.render(0);
        });
        assert(await page.evaluate(corner), '크기 변경 후 테두리 유지');
      }
      await page.evaluate(() => {
        const { battle, deliver, render } = window.testScene;
        const fox = battle.state.units.find((u) => u.unitId === 'fox');
        fox.skillState = 'charging';
        deliver([{ type: 'skillEnd', uid: fox.uid }]);
        render(0.3);
      });
      assert.equal(await page.evaluate(corner), false, '만료 후 테두리 제거');
      const disposed = await page.evaluate(() => {
        window.testScene.overlay.dispose();
        window.testScene.view.dispose();
        return window.testScene.view.memory;
      });
      assert(result.stateUnchanged && firing.stateUnchanged);
      assert(firing.drawCalls <= 120 && firing.particles <= 200);
      assert.deepEqual(disposed, { geometries: 0, textures: 0 });
      assert.deepEqual(errors, []);
      report.push({
        viewport,
        mode,
        ...result,
        firing,
        longFrame,
        paused: true,
        expired: true,
        disposed,
        errors,
      });
      console.log(JSON.stringify(report.at(-1)));
      await page.close();
    }
  }
  for (const viewport of [
    { width: 1920, height: 1080 },
    { width: 844, height: 390 },
    { width: 320, height: 568 },
  ]) {
    const mobile = viewport.width < 1000;
    const context = await browser.newContext({ viewport, hasTouch: mobile, isMobile: mobile });
    const page = await context.newPage();
    const errors = [];
    page.on('pageerror', (error) => errors.push(error.message));
    const time = new Date('2026-10-15T12:00:00Z');
    await page.clock.install({ time });
    await page.clock.pauseAt(new Date(time.getTime() + 1000));
    await page.addInitScript(() => {
      window.requestAnimationFrame = (callback) => setTimeout(() => callback(performance.now()), 100);
      window.cancelAnimationFrame = (id) => clearTimeout(id);
    });
    await page.route('**/railgun-audit', (route) =>
      route.fulfill({ contentType: 'text/html; charset=utf-8', body: markup }),
    );
    await page.goto('http://127.0.0.1:43195/railgun-audit');
    await page.evaluate(createUnitAuditGame, { dir: 'right' });
    await page.getByRole('button', { name: '설정', exact: true }).click();
    await page.getByLabel('화면 품질').selectOption('low');
    await page.getByLabel('화면 품질').selectOption('high');
    await page.getByLabel('움직임과 화면 흔들림').selectOption('full');
    await page.getByRole('button', { name: '완료', exact: true }).click();
    await enterBattle(page);
    await pause(page);
    const card = page.locator('.deploy-card[data-unit-id="fox"]');
    await card.scrollIntoViewIfNeeded();
    const box = await card.boundingBox();
    const point = await page.evaluate(unitAuditPoint);
    const from = { x: box.x + box.width / 2, y: box.y + box.height / 2 };
    if (mobile) {
      const cdp = await context.newCDPSession(page);
      await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ ...from, id: 1 }] });
      await frame(page);
      await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ ...point, id: 1 }] });
      await frame(page);
      await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
      await cdp.detach();
    } else {
      await page.mouse.move(from.x, from.y);
      await page.mouse.down();
      await frame(page);
      await page.mouse.move(point.x, point.y, { steps: 5 });
      await frame(page);
      await page.mouse.up();
    }
    await frame(page);
    const click = async (locator) => {
      if (mobile) await locator.tap();
      else await locator.click();
      await frame(page);
    };
    await click(page.locator('[data-dir="right"]'));
    const skill = await page.evaluate(() => window.unitAudit.content.skills.get('polarAim'));
    await resume(page);
    await frame(page, (skill.spCost - skill.spStart + 1) * 1000);
    await pause(page);
    if (mobile) await page.touchscreen.tap(point.x, point.y);
    else await page.mouse.click(point.x, point.y);
    await frame(page);
    assert(await page.locator('.skill-button').isEnabled());
    await click(page.locator('.skill-button'));
    assert(await page.evaluate(corner), '실제 자연 충전·스킬 클릭으로 테두리 발동');
    await click(page.locator('.unit-popup-close'));
    await resume(page);
    await frame(page, 500);
    await pause(page);
    await page.screenshot({
      path: `docs/verification/${prefix}-${viewport.width}x${viewport.height}-natural-skill.png`,
    });
    await resume(page);
    await frame(page, (skill.durationSec + 0.5) * 1000);
    await pause(page);
    assert.equal(await page.evaluate(corner), false, '실제 스킬 만료 후 제거');
    const actual = await page.evaluate(() => ({
      quality: JSON.parse(localStorage.getItem('mallang-guard:v1')).settings.quality,
      starts: window.unitAudit.events.filter((e) => e.type === 'skillStart').length,
      ends: window.unitAudit.events.filter((e) => e.type === 'skillEnd').length,
      rejected: window.unitAudit.events.filter((e) => e.type === 'commandRejected'),
    }));
    assert.equal(actual.starts, 1);
    assert.equal(actual.quality, 'high');
    assert.equal(actual.ends, 1);
    assert.deepEqual(actual.rejected, []);
    await resume(page);
    await frame(page, (skill.spCost + 1) * 1000);
    await pause(page);
    if (mobile) await page.touchscreen.tap(point.x, point.y);
    else await page.mouse.click(point.x, point.y);
    await frame(page);
    await click(page.locator('.skill-button'));
    assert(await page.evaluate(corner), '두 번째 자연 충전·발동');
    await click(page.locator('.unit-retreat'));
    assert.equal(await page.evaluate(corner), false, '정지 중 후퇴 직후 테두리 제거');
    assert.equal(await page.evaluate(() => window.unitAudit.battle.state.units.length), 0);
    assert.deepEqual(
      await page.evaluate(() => window.unitAudit.events.filter((e) => e.type === 'commandRejected')),
      [],
    );
    await page.evaluate(() => window.unitAudit.game.dispose());
    assert.equal(await page.evaluate(corner), false);
    assert.deepEqual(errors, []);
    report.push({
      viewport,
      mode: 'natural-skill-ui',
      ...actual,
      secondActivation: true,
      pausedRetreat: true,
      errors,
    });
    console.log(JSON.stringify(report.at(-1)));
    await context.close();
  }
  await writeFile(`docs/verification/${prefix}-frame.json`, `${JSON.stringify(report, null, 2)}\n`);
} finally {
  await browser.close();
}
