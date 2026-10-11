import assert from 'node:assert/strict';
import { writeFile } from 'node:fs/promises';
import { chromium } from 'playwright';
import { enterBattle, frame } from './helpers.mjs';

const prefix = process.env.MALLANG_SCREENSHOT_PREFIX ?? 't4.18';
const report = [];
const browser = await chromium.launch({ channel: 'msedge', headless: true });
try {
  for (const [width, height, touch, reduced] of [
    [1920, 1080, false, false],
    [844, 390, true, false],
    [740, 360, true, true],
    [390, 844, true, false],
  ]) {
    const context = await browser.newContext({
      viewport: { width, height },
      hasTouch: touch,
      isMobile: touch,
    });
    await context.grantPermissions(['local-network-access']);
    const page = await context.newPage();
    const errors = [];
    page.on('pageerror', (error) => errors.push(error.message));
    page.on('console', (message) => {
      if (['warning', 'error'].includes(message.type())) errors.push(message.text());
    });
    const time = new Date('2026-10-11T03:00:00Z');
    await page.clock.install({ time });
    await page.clock.pauseAt(new Date(time.getTime() + 1000));
    await page.addInitScript((reducedMotion) => {
      localStorage.setItem(
        'mallang-guard:v1',
        JSON.stringify({
          version: 1,
          stages: {},
          settings: { speed: 1, quality: 'low', sfxVolume: 0.7, reducedMotion },
        }),
      );
      window.requestAnimationFrame = (callback) => setTimeout(() => callback(performance.now()), 100);
      window.cancelAnimationFrame = (id) => clearTimeout(id);
    }, reduced);
    await page.goto('http://127.0.0.1:43195/');
    await enterBattle(page, { waitForStart: false });
    const notice = page.locator('.wave-notice');
    assert.equal(await notice.isVisible(), false, '준비 중에는 웨이브 알림 없음');
    await frame(page, 1000);
    await page.locator('[data-action="start"]').click();
    await frame(page, 3300);
    assert.equal(await notice.isVisible(), false, '전투 시작 후에도 실제 스폰 전에는 알림 없음');
    await frame(page, 3000);
    assert(await notice.isVisible(), '실제 첫 웨이브 시작 알림');
    assert.equal(await notice.textContent(), '웨이브 시작WAVE 1 / 12');
    assert.equal(await notice.getAttribute('role'), 'status');
    assert.equal(await page.locator('.battle-hint').isVisible(), false, '초반 안내 문구와 겹치지 않음');
    const layout = await notice.evaluate((node) => {
      const rect = node.getBoundingClientRect();
      const top = document.querySelector('.battle-top').getBoundingClientRect();
      const style = getComputedStyle(node);
      return {
        center: rect.x + rect.width / 2,
        top: rect.y,
        headerBottom: top.bottom,
        inViewport: rect.left >= 0 && rect.right <= innerWidth,
        pointerEvents: style.pointerEvents,
        animation: style.animationName,
      };
    });
    assert(Math.abs(layout.center - width / 2) <= 1, '화면 가로 중앙');
    assert(layout.top >= layout.headerBottom && layout.inViewport, '상단 버튼 아래, 화면 안쪽');
    assert.equal(layout.pointerEvents, 'none', '보드 터치·마우스를 가리지 않음');
    assert.equal(layout.animation, reduced ? 'none' : 'wave-arrival');
    await page.waitForTimeout(300);
    await page.screenshot({ path: `docs/verification/${prefix}-${width}x${height}-wave-start.png` });
    await frame(page, 2000);
    assert.equal(await notice.isVisible(), false, '같은 웨이브의 갱신은 알림을 연장하지 않음');
    for (let i = 0; i < 30 && !(await notice.isVisible()); i++) await frame(page, 500);
    assert(await notice.isVisible(), '다음 웨이브도 표시');
    assert.equal(await notice.textContent(), '웨이브 시작WAVE 2 / 12');
    if (touch) await page.locator('[data-action="exit"]').tap();
    else await page.locator('[data-action="exit"]').click();
    assert.equal(await notice.count(), 0, '알림 중 나가면 HUD 제거');
    await frame(page, 2200);
    await enterBattle(page, { waitForStart: false });
    assert.equal(await notice.isVisible(), false, '새 전투는 이전 알림을 이어받지 않음');
    await frame(page, 13300);
    assert.equal(await notice.textContent(), '웨이브 시작WAVE 1 / 12');
    assert(await notice.isVisible(), '재시작 후 첫 웨이브 표시');
    await frame(page, 30000);
    assert(await page.locator('.battle-result').isVisible(), '무배치 전투 종료');
    assert.equal(await notice.isVisible(), false, '결과 화면에는 알림 없음');
    assert.deepEqual(errors, []);
    report.push({ width, height, touch, reduced, layout, waves: [1, 2, 1], cleanup: true, errors });
    console.log(JSON.stringify(report.at(-1)));
    await context.close();
  }
  await writeFile(`docs/verification/${prefix}-wave-notice.json`, `${JSON.stringify(report, null, 2)}\n`);
} finally {
  await browser.close();
}
