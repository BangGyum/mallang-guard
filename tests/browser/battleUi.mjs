import assert from 'node:assert/strict';
import { writeFile } from 'node:fs/promises';
import { chromium } from 'playwright';
import { enterBattle, frame, pause, resume } from './helpers.mjs';
import { createUnitAuditGame, unitAuditPoint } from './unitAuditScene.mjs';

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
    page.on('pageerror', (error) => errors.push(error.message));
    page.on('console', (message) => {
      if (['error', 'warning'].includes(message.type())) errors.push(message.text());
    });
    const time = new Date('2026-10-08T14:00:00Z');
    await page.clock.install({ time });
    await page.clock.pauseAt(time);
    await page.addInitScript(() => {
      window.requestAnimationFrame = (callback) => setTimeout(() => callback(performance.now()), 100);
      window.cancelAnimationFrame = (id) => clearTimeout(id);
    });
    await page.route('**/battle-ui-audit', (route) =>
      route.fulfill({
        contentType: 'text/html',
        body: '<meta name="viewport" content="width=device-width, initial-scale=1"><link rel="stylesheet" href="/src/ui/styles.css"><div id="app"></div>',
      }),
    );
    await page.goto('http://127.0.0.1:43195/battle-ui-audit');
    await page.evaluate(createUnitAuditGame, { dir: 'right', spawnAtSec: 12 });
    await enterBattle(page);
    await pause(page);
    const click = async (locator) => {
      if (mobile) await locator.tap();
      else await locator.click();
      await frame(page);
    };
    const tap = async (point) => {
      if (mobile) await page.touchscreen.tap(point.x, point.y);
      else await page.mouse.click(point.x, point.y);
      await frame(page);
    };
    const from = await page.locator('.deploy-card[data-unit-id="mole"]').boundingBox();
    const to = await page.evaluate(unitAuditPoint);
    assert(from);
    const origin = { x: from.x + from.width / 2, y: from.y + from.height / 2 };
    if (mobile) {
      const cdp = await context.newCDPSession(page);
      await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ ...origin, id: 1 }] });
      await frame(page);
      await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ ...to, id: 1 }] });
      await frame(page);
      await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
      await cdp.detach();
    } else {
      await page.mouse.move(origin.x, origin.y);
      await page.mouse.down();
      await frame(page);
      await page.mouse.move(to.x, to.y, { steps: 5 });
      await frame(page);
      await page.mouse.up();
    }
    await frame(page);
    await click(page.locator('[data-dir="right"]'));
    const select = async () => {
      await tap(await page.evaluate(unitAuditPoint));
      await page.locator('.unit-popup-card').evaluate(async (card) => {
        await Promise.all(card.getAnimations().map((animation) => animation.finished));
      });
      await frame(page);
    };
    const inspectLayout = async () => {
      const layout = await page.evaluate(() => {
        const rect = (selector) => document.querySelector(selector).getBoundingClientRect().toJSON();
        return {
          panel: rect('.unit-panel'),
          top: rect('.battle-top'),
          bar: rect('.deploy-bar'),
          skill: rect('.skill-heading'),
          meter: rect('.skill-meter'),
          detailsHeight: document.querySelector('.unit-info-details').clientHeight,
          buttons: [...document.querySelectorAll('.unit-popup-actions button')].map((button) =>
            button.getBoundingClientRect().toJSON(),
          ),
        };
      });
      assert(layout.panel.top >= layout.top.bottom + 7, '상단 현황과 겹치지 않음');
      assert(Math.abs(layout.panel.bottom + 8 - layout.bar.top) < 1, '배치 바 위에 정보 고정');
      assert(Math.abs(layout.panel.right + 8 - page.viewportSize().width) < 1, '오른쪽 정보 고정');
      assert(layout.detailsHeight >= 16, `상세 정보에 접근할 수 있는 스크롤 영역: ${JSON.stringify(layout)}`);
      for (const item of [layout.skill, layout.meter, ...layout.buttons]) {
        assert(item.top >= layout.panel.top && item.bottom <= layout.panel.bottom, '스킬·상태·조작 표시');
        assert(item.left >= layout.panel.left && item.right <= layout.panel.right, '가로 잘림 없음');
      }
      for (const button of layout.buttons) assert(button.height >= 44 && button.width >= 44);
      return layout;
    };
    await select();
    assert.equal(await page.locator('.skill-status').textContent(), '충전 중');
    assert.equal(await page.locator('.skill-value').textContent(), 'SP 5/10');
    assert.match(await page.locator('.skill-meta').textContent(), /시간 충전.*수동 발동.*범위 내 적 필요/);
    assert(await page.locator('.skill-button').isDisabled());
    await page.screenshot({ path: `docs/verification/t3.11-${label}-charging.png`, animations: 'disabled' });
    await click(page.locator('.unit-popup-close'));
    await resume(page);
    await frame(page, 6000);
    await pause(page);
    await select();
    assert.equal(await page.locator('.unit-panel').getAttribute('data-skill-state'), 'ready');
    assert.equal(await page.locator('.skill-status').textContent(), '대상 대기');
    assert.equal(await page.locator('.skill-value').textContent(), 'SP 10/10');
    assert(await page.locator('.skill-button').isDisabled());
    const button = await page.locator('.skill-button').boundingBox();
    await tap({ x: button.x + button.width / 2, y: button.y + button.height / 2 });
    assert.equal(
      await page.evaluate(() => window.unitAudit.events.filter((e) => e.type === 'skillStart').length),
      0,
    );
    const full = await inspectLayout();
    await page.screenshot({
      path: `docs/verification/t3.11-${label}-target-wait.png`,
      animations: 'disabled',
    });
    if (mobile) {
      await page.setViewportSize({ width: 740, height: 360 });
      await frame(page);
      await page.screenshot({
        path: 'docs/verification/t3.11-compact-target-wait.png',
        animations: 'disabled',
      });
      const compact = await inspectLayout();
      report.push({ viewport: '740x360', layout: compact });
      await frame(page);
      await page.screenshot({
        path: 'docs/verification/t3.11-compact-target-wait.png',
        animations: 'disabled',
      });
      await page.setViewportSize({ width: 844, height: 390 });
      await frame(page);
    }
    await click(page.locator('.unit-popup-close'));
    await resume(page);
    await frame(page, 7000);
    await pause(page);
    await select();
    assert.equal(await page.locator('.skill-status').textContent(), '준비 완료');
    assert.equal(await page.locator('.skill-button').isDisabled(), false);
    await page.screenshot({
      path: `docs/verification/t3.11-${label}-target-ready.png`,
      animations: 'disabled',
    });
    await click(page.getByRole('button', { name: '스킬 발동', exact: true }));
    const events = await page.evaluate(() => ({
      starts: window.unitAudit.events.filter((e) => e.type === 'skillStart').length,
      rejected: window.unitAudit.events.filter((e) => e.type === 'commandRejected'),
    }));
    assert.equal(events.starts, 1);
    assert.deepEqual(events.rejected, []);
    assert.equal(await page.locator('.skill-status').textContent(), '충전 중');
    assert.deepEqual(errors, []);
    report.push({
      viewport: label,
      targetWaiting: true,
      disabledTap: true,
      ready: true,
      cast: true,
      layout: full,
      errors,
    });
    console.log(JSON.stringify({ viewport: label, targetWaiting: true, ready: true, cast: true, errors }));
    await context.close();
  }
  await writeFile('docs/verification/t3.11-battle-ui.json', `${JSON.stringify(report, null, 2)}\n`);
} finally {
  await browser.close();
}
