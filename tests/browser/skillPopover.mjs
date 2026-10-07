import assert from 'node:assert/strict';
import { chromium } from 'playwright';
import { deploy, enterBattle, frame, pause, resume, tilePoint } from './helpers.mjs';

const prefix = process.env.MALLANG_SCREENSHOT_PREFIX
  ? `${process.env.MALLANG_SCREENSHOT_PREFIX}-skill`
  : 'skill-popover';

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
    await page.clock.install({ time: new Date('2026-10-07T03:00:00Z') });
    await page.addInitScript(() => {
      window.requestAnimationFrame = (callback) => setTimeout(() => callback(performance.now()), 100);
      window.cancelAnimationFrame = (id) => clearTimeout(id);
    });
    await page.goto(process.env.MALLANG_TEST_URL ?? 'http://127.0.0.1:43195/');
    await enterBattle(page);
    await page.clock.pauseAt(new Date('2026-10-07T03:02:00Z'));
    await frame(page);
    await pause(page);
    const cdp = mobile ? await context.newCDPSession(page) : null;
    const click = async (locator) => {
      if (mobile) await locator.tap();
      else await locator.click();
      await frame(page, 220);
    };
    const checkNotices = async () => {
      const overlaps = await page.evaluate(() => {
        const panel = document.querySelector('.unit-panel').getBoundingClientRect();
        return [...document.querySelectorAll('.skill-notice')].some((node) => {
          const notice = node.getBoundingClientRect();
          return (
            notice.left < panel.right &&
            notice.right > panel.left &&
            notice.top < panel.bottom &&
            notice.bottom > panel.top
          );
        });
      });
      assert.equal(overlaps, false, '발동 알림이 스킬 팝업을 가리지 않음');
    };
    const select = async (tile, id) => {
      const point = await tilePoint(page, tile);
      if (mobile) await page.touchscreen.tap(point.x, point.y);
      else await page.mouse.click(point.x, point.y);
      await frame(page, 220);
      assert.equal(await page.locator('.unit-panel').getAttribute('data-unit-id'), id);
      assert.equal(await page.locator('.unit-panel').isVisible(), true);
      await page.locator('.unit-popup-card').evaluate(async (node) => {
        await Promise.all(node.getAnimations().map((animation) => animation.finished));
      });
      assert.equal(await page.locator('.unit-popup-anchor').isVisible(), true);
      const bounds = await page.evaluate(() => {
        const rect = (node) => {
          const r = node.getBoundingClientRect();
          return {
            left: r.left,
            right: r.right,
            top: r.top,
            bottom: r.bottom,
            width: r.width,
            height: r.height,
          };
        };
        return {
          panel: rect(document.querySelector('.unit-panel')),
          top: rect(document.querySelector('.battle-top')),
          bottom: rect(document.querySelector('.deploy-bar')),
          anchor: rect(document.querySelector('.unit-popup-anchor')),
          buttons: [...document.querySelectorAll('.unit-popup-actions button')]
            .filter((b) => !b.hidden)
            .map(rect),
        };
      });
      assert(bounds.panel.top >= bounds.top.bottom + 6, '상단 HUD와 겹치지 않음');
      assert(bounds.panel.bottom <= bounds.bottom.top - 6, '배치 바와 겹치지 않음');
      assert(bounds.panel.left >= 7 && bounds.panel.right <= page.viewportSize().width - 7, '화면 안에 팝업');
      assert(
        Math.abs((bounds.anchor.left + bounds.anchor.right) / 2 - point.x) < 2,
        '선택한 유닛 위치에 표시',
      );
      assert(point.x < bounds.panel.left || point.x > bounds.panel.right, '유닛을 가리지 않음');
      for (const button of bounds.buttons) {
        assert(button.height >= 44 && button.width >= 44, `터치 영역: ${JSON.stringify(button)}`);
        assert(
          button.bottom <= bounds.panel.bottom && button.top >= bounds.panel.top,
          `버튼이 잘리지 않음: ${JSON.stringify(bounds)}`,
        );
      }
    };
    await deploy(page, cdp, 'squirrel', { x: 2, y: 0 }, 'down');
    await select({ x: 2, y: 0 }, 'squirrel');
    assert.equal(await page.locator('.unit-popup-name').textContent(), '토리의 스킬');
    assert.equal(await page.locator('.skill-button').isDisabled(), true);
    await click(page.getByRole('button', { name: '스킬 팝업 닫기' }));
    assert.equal(await page.locator('.unit-panel').isVisible(), false);
    await resume(page);
    await frame(page, 12000);
    await pause(page);
    await select({ x: 2, y: 0 }, 'squirrel');
    assert.equal(await page.locator('.unit-panel').getAttribute('data-skill-state'), 'ready');
    const before = Number(await page.locator('.dp-panel strong').textContent());
    await page.screenshot({
      path: `docs/verification/${prefix}-${mobile ? 'mobile' : 'desktop'}-ready.png`,
    });
    await click(page.getByRole('button', { name: '스킬 발동', exact: true }));
    assert.equal(Number(await page.locator('.dp-panel strong').textContent()), before + 12);
    assert.match(
      await page.locator('.skill-notice[data-unit-id="squirrel"]').innerText(),
      /토리.*스킬 발동\n✦ 도토리 줍줍/,
    );
    await checkNotices();
    await page.screenshot({
      path: `docs/verification/${prefix}-${mobile ? 'mobile' : 'desktop'}-cast.png`,
    });
    await frame(page, 2000);
    assert.equal(await page.locator('.skill-notice').count(), 0);
    await page.keyboard.press('Escape');
    await frame(page);
    await deploy(page, cdp, 'penguin', { x: 5, y: 2 }, 'left');
    await select({ x: 5, y: 2 }, 'penguin');
    assert.equal(await page.locator('.unit-popup-name').textContent(), '펭펭의 스킬');
    await page.keyboard.press('Escape');
    await frame(page);
    await resume(page);
    await frame(page, 15000);
    await deploy(page, cdp, 'bunny', { x: 3, y: 0 }, 'down');
    await select({ x: 3, y: 0 }, 'bunny');
    assert.equal(await page.locator('.skill-button').isVisible(), false);
    assert.match(await page.locator('.unit-description').textContent(), /자동 발동/);
    await page.keyboard.press('Escape');
    await frame(page);
    await resume(page);
    let sawAuto = false;
    for (let i = 0; i < 40; i++) {
      await frame(page, 500);
      if (await page.locator('.skill-notice[data-unit-id="bunny"]').count()) {
        sawAuto = true;
        break;
      }
    }
    assert(sawAuto, '선택하지 않은 유닛의 자동 스킬 알림');
    assert.match(
      await page.locator('.skill-notice[data-unit-id="bunny"]').innerText(),
      /토실.*자동 발동\n✦ 당근 수프/,
    );
    await page.screenshot({
      path: `docs/verification/${prefix}-${mobile ? 'mobile' : 'desktop'}-auto.png`,
    });
    await pause(page);
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await select({ x: 5, y: 2 }, 'penguin');
    assert.equal(await page.locator('.unit-popup-card').evaluate((node) => node.getAnimations().length), 0);
    await click(page.getByRole('button', { name: '스킬 발동', exact: true }));
    assert.equal(
      await page
        .locator('.skill-notice[data-unit-id="penguin"]')
        .evaluate((node) => getComputedStyle(node).animationName),
      'none',
    );
    assert.equal(await page.locator('.unit-panel').getAttribute('data-skill-state'), 'active');
    await checkNotices();
    const bunnyPoint = await tilePoint(page, { x: 3, y: 0 });
    const bunnyNotice = await page.locator('.skill-notice[data-unit-id="bunny"]').boundingBox();
    assert(bunnyNotice);
    assert(
      Math.abs(bunnyNotice.x + bunnyNotice.width / 2 - bunnyPoint.x) < (mobile ? 120 : 250),
      '다른 유닛 팝업을 열어도 자동 발동 알림은 자신의 유닛 근처에 유지',
    );
    await page.screenshot({
      path: `docs/verification/${prefix}-${mobile ? 'mobile' : 'desktop'}-active.png`,
    });
    await click(page.getByRole('button', { name: '후퇴', exact: false }));
    assert.equal(await page.locator('.unit-panel').isVisible(), false);
    assert.equal(await page.locator('.unit-popup-anchor').isVisible(), false);
    assert.equal(await page.locator('.skill-notice[data-unit-id="penguin"]').count(), 0);
    await select({ x: 2, y: 0 }, 'squirrel');
    await page.setViewportSize(mobile ? { width: 740, height: 360 } : { width: 1024, height: 768 });
    await frame(page, 200);
    await select({ x: 2, y: 0 }, 'squirrel');
    assert.deepEqual(errors, []);
    console.log(
      JSON.stringify({
        input: mobile ? 'touch' : 'mouse',
        popup: true,
        manual: true,
        auto: true,
        resize: true,
        reducedMotion: true,
        errors,
      }),
    );
    await context.close();
  }
} finally {
  await browser.close();
}
