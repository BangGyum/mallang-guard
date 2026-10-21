import assert from 'node:assert/strict';
import { writeFile } from 'node:fs/promises';
import { chromium } from 'playwright';
import { deploy, enterBattle, frame, pause, resume, tilePoint } from './helpers.mjs';

const prefix = process.env.MALLANG_SCREENSHOT_PREFIX ?? 't4.8';
const browser = await chromium.launch({ channel: 'msedge', headless: true });
const report = [];
try {
  for (const settings of [
    { width: 540, height: 720, touch: false },
    { width: 540, height: 720, touch: true },
    { width: 390, height: 844, touch: true },
    { width: 640, height: 360, touch: true },
  ]) {
    const { touch, ...viewport } = settings;
    const label = `${touch ? 'touch' : 'mouse'}-${viewport.width}x${viewport.height}`;
    const context = await browser.newContext({ viewport, hasTouch: touch, isMobile: touch });
    await context.grantPermissions(['local-network-access']);
    const page = await context.newPage();
    const errors = [];
    page.on('pageerror', (error) => errors.push(error.message));
    page.on('console', (message) => {
      if (['error', 'warning'].includes(message.type())) errors.push(message.text());
    });
    const time = new Date('2026-10-09T12:00:00Z');
    await page.clock.install({ time });
    await page.clock.pauseAt(new Date(time.getTime() + 1000));
    await page.addInitScript(() => {
      window.requestAnimationFrame = (callback) => setTimeout(() => callback(performance.now()), 100);
      window.cancelAnimationFrame = (id) => clearTimeout(id);
    });
    await page.goto('http://127.0.0.1:43195/');
    await page.locator('.title-screen').waitFor();
    await page.evaluate(async () => {
      const { Battle } = await import('/src/sim/battle.ts');
      window.narrowAudit = { battle: null, rejected: [], skills: 0 };
      for (const name of ['step', 'flush']) {
        const original = Battle.prototype[name];
        Battle.prototype[name] = function (...args) {
          const events = original.apply(this, args);
          window.narrowAudit.battle = this;
          window.narrowAudit.rejected.push(...events.filter((event) => event.type === 'commandRejected'));
          window.narrowAudit.skills += events.filter((event) => event.type === 'skillStart').length;
          return events;
        };
      }
    });
    const click = async (locator) => {
      if (touch) await locator.tap();
      else await locator.click();
      await frame(page);
    };
    const tick = () => page.evaluate(() => window.narrowAudit.battle.state.tick);
    await enterBattle(page, { waitForStart: false });
    assert.equal(await page.locator('.rotate-guide').count(), 0);
    const buttonsFit = await page.locator('.battle-top').evaluate((top) =>
      [...top.querySelectorAll('button')].every((button) => {
        const rect = button.getBoundingClientRect();
        return (
          rect.width >= 44 &&
          rect.height >= 44 &&
          rect.left >= 0 &&
          rect.right <= innerWidth &&
          rect.top >= 0 &&
          rect.bottom <= innerHeight
        );
      }),
    );
    assert(buttonsFit, '좁은 화면에서도 시작·배속·일시정지 버튼 노출');
    const countdown = await page.locator('.battle-countdown').textContent();
    const cdp = touch ? await context.newCDPSession(page) : null;
    if (cdp) {
      const strip = page.locator('.deploy-cards');
      const box = await strip.boundingBox();
      assert(box);
      const swipe = async (back) => {
        const from = box.x + (back ? 15 : box.width - 15);
        const to = box.x + (back ? box.width - 15 : 15);
        const y = box.y + box.height / 2;
        await cdp.send('Input.dispatchTouchEvent', {
          type: 'touchStart',
          touchPoints: [{ x: from, y, id: 1 }],
        });
        for (let step = 1; step <= 8; step++) {
          await cdp.send('Input.dispatchTouchEvent', {
            type: 'touchMove',
            touchPoints: [{ x: from + ((to - from) * step) / 8, y, id: 1 }],
          });
          await frame(page, 20);
        }
        await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
        await frame(page);
      };
      const scrolling = await strip.evaluate((node) => node.scrollWidth > node.clientWidth);
      if (scrolling) {
        await swipe(false);
        assert((await strip.evaluate((node) => node.scrollLeft)) > 0, '카드를 가로로 쓸어 넘길 수 있음');
        for (
          let attempt = 0;
          attempt < 10 && (await strip.evaluate((node) => node.scrollLeft)) > 0;
          attempt++
        )
          await swipe(true);
        assert.equal(await strip.evaluate((node) => node.scrollLeft), 0, '첫 카드로 다시 이동');
        assert.equal(await page.locator('.drag-ghost').isVisible(), false, '가로 스크롤 후 드래그 취소');
      }
    }
    await deploy(page, cdp, 'squirrel', { x: 2, y: 0 }, 'down');
    await resume(page);
    await frame(page, 2000);
    assert.equal(await tick(), 0, '기본 준비 중에는 전투 정지');
    assert.notEqual(
      await page.locator('.battle-countdown').textContent(),
      countdown,
      '좁아도 준비 시간 진행',
    );
    await click(page.locator('[data-action="start"]'));
    await frame(page, 3400);
    assert((await tick()) > 0, '좁아도 3초 뒤 전투 시작');
    await frame(page, 13000);
    await click(page.locator('[data-action="pause"]'));
    const pausedTick = await tick();
    await page.setViewportSize({ width: 844, height: 390 });
    await frame(page, 1000);
    assert.equal(await tick(), pausedTick, '메뉴 정지는 리사이즈 후에도 유지');
    await page.setViewportSize(viewport);
    await frame(page);
    await click(page.locator('.pause-menu').getByRole('button', { name: '계속하기', exact: true }));
    await frame(page, 1000);
    assert((await tick()) > pausedTick, '좁은 화면에서 메뉴를 닫아도 계속 진행');
    await pause(page);
    const manualTick = await tick();
    await page.setViewportSize({ width: 844, height: 390 });
    await frame(page, 1000);
    await page.setViewportSize(viewport);
    await frame(page, 1000);
    assert.equal(await tick(), manualTick, '멈춘 채 배치는 리사이즈 후에도 유지');
    const point = await tilePoint(page, { x: 2, y: 0 });
    if (touch) await page.touchscreen.tap(point.x, point.y);
    else await page.mouse.click(point.x, point.y);
    await frame(page);
    assert.equal(await page.locator('.unit-popup-name').textContent(), '토리');
    assert.equal(await page.locator('.skill-button').isDisabled(), false);
    await click(page.locator('.skill-button'));
    assert.equal(await page.evaluate(() => window.narrowAudit.skills), 1);
    assert.match(await page.locator('.skill-notice').textContent(), /토리.*전리품 수거/s);
    const panelFit = await page.locator('.unit-panel').evaluate((panel) => {
      const rect = panel.getBoundingClientRect();
      return rect.left >= 0 && rect.right <= innerWidth && rect.top >= 0 && rect.bottom <= innerHeight;
    });
    assert(panelFit, '좁은 화면의 캐릭터 정보와 스킬 창 노출');
    await page.screenshot({ path: `docs/verification/${prefix}-${label}-skill.png`, animations: 'disabled' });
    await click(page.locator('.unit-popup-close'));
    await resume(page);
    const beforeResize = await tick();
    await page.setViewportSize({ width: 844, height: 390 });
    await frame(page, 1000);
    await page.setViewportSize(viewport);
    await frame(page, 1000);
    assert((await tick()) > beforeResize, '진행 중 리사이즈는 자동 정지하지 않음');
    assert.equal(await page.locator('.rotate-guide').count(), 0);
    const rejected = await page.evaluate(() => window.narrowAudit.rejected);
    assert.deepEqual(rejected, []);
    assert.deepEqual(errors, []);
    const result = {
      ...settings,
      buttonsFit,
      preparation: true,
      quickStart: true,
      deployment: true,
      cardScroll: touch,
      skill: true,
      panelFit,
      manualPausePreserved: true,
      resizeContinues: true,
      rejected,
      errors,
    };
    report.push(result);
    console.log(JSON.stringify(result));
    await context.close();
  }
  await writeFile(`docs/verification/${prefix}-narrow-screen.json`, `${JSON.stringify(report, null, 2)}\n`);
} finally {
  await browser.close();
}
