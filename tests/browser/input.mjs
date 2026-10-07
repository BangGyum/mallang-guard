import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';
import { chromium } from 'playwright';
import { deploy, drag, frame, pause, resume, tilePoint } from './helpers.mjs';

const url = process.env.MALLANG_TEST_URL ?? 'http://127.0.0.1:43195/';
await mkdir('docs/verification', { recursive: true });
const browser = await chromium.launch({
  channel: 'msedge',
  headless: true,
  args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'],
});
try {
  for (const mobile of process.argv.includes('--mobile') ? [true] : [false, true]) {
    const viewport = mobile ? { width: 844, height: 390 } : { width: 1920, height: 1080 };
    const context = await browser.newContext({ viewport, hasTouch: mobile, isMobile: mobile });
    await context.grantPermissions(['local-network-access']);
    const page = await context.newPage();
    const cdp = mobile ? await context.newCDPSession(page) : null;
    const errors = [];
    page.on('pageerror', (error) => errors.push(error.message));
    page.on('console', (message) => {
      if (['error', 'warning'].includes(message.type())) errors.push(message.text());
    });
    await page.clock.install({ time: new Date('2026-10-07T03:00:00Z') });
    // 낮은 프레임 빈도에서도 30Hz 전투와 입력이 유지되는지 확인한다.
    await page.addInitScript(() => {
      window.requestAnimationFrame = (callback) => setTimeout(() => callback(performance.now()), 100);
      window.cancelAnimationFrame = (id) => clearTimeout(id);
    });
    console.log(`${mobile ? 'touch' : 'mouse'}: 페이지 로드`);
    await page.goto(url);
    await page.locator('.deploy-bar').waitFor();
    console.log('시계 일시정지');
    await page.clock.pauseAt(new Date('2026-10-07T03:02:00Z'));
    await frame(page);
    await pause(page);
    console.log('잘못된 타일 배치 확인');
    await drag(page, cdp, 'squirrel', { x: 2, y: 1 });
    assert.equal(await page.locator('.aim-directions').isVisible(), false);
    assert.equal(await page.locator('.toast').textContent(), '여기엔 놓을 수 없어요');
    await deploy(page, cdp, 'squirrel', { x: 2, y: 0 }, 'down');
    const center = await tilePoint(page, { x: 2, y: 0 });
    if (mobile) await page.touchscreen.tap(center.x, center.y);
    else await page.mouse.click(center.x, center.y);
    await frame(page);
    assert.equal(await page.locator('.unit-panel').isVisible(), true);
    assert.equal(
      await page
        .locator('.unit-panel')
        .innerText()
        .then((text) => /HP|체력|저지|방어력/.test(text)),
      false,
    );
    assert.equal(await page.locator('.skill-button').isDisabled(), true);
    const retreat = page.getByRole('button', { name: '후퇴', exact: false });
    if (mobile) await retreat.tap();
    else await retreat.click();
    await frame(page);
    assert.equal(await page.locator('[data-unit-id="squirrel"]').getAttribute('data-state'), 'cooldown');
    assert.equal(await page.locator('.dp-panel strong').textContent(), '5');
    if (mobile) {
      await page.setViewportSize({ width: 390, height: 844 });
      await frame(page);
      await page.locator('.rotate-guide').waitFor({ state: 'visible' });
      assert.equal(await page.locator('.rotate-guide').isVisible(), true);
      await page.setViewportSize(viewport);
      await frame(page);
      await page.locator('.rotate-guide').waitFor({ state: 'hidden' });
      assert.equal(await page.locator('.rotate-guide').isVisible(), false);
    }
    await page.reload();
    await page.locator('.deploy-bar').waitFor();
    await frame(page);
    await pause(page);
    await deploy(page, cdp, 'squirrel', { x: 2, y: 0 }, 'down');
    const plans = [
      { ms: 12000, unitId: 'penguin', tile: { x: 5, y: 2 }, dir: 'left' },
      { ms: 15000, unitId: 'bunny', tile: { x: 3, y: 0 }, dir: 'down' },
      { ms: 17000, unitId: 'sheep', tile: { x: 2, y: 2 }, dir: 'up' },
      { ms: 14000, unitId: 'cat', tile: { x: 6, y: 4 }, dir: 'up' },
    ];
    for (const plan of plans) {
      await resume(page);
      await frame(page, plan.ms);
      await deploy(page, cdp, plan.unitId, plan.tile, plan.dir);
      if (plan.unitId === 'penguin' || plan.unitId === 'sheep') {
        const source = plan.unitId === 'penguin' ? { x: 2, y: 0 } : { x: 5, y: 2 };
        const at = await tilePoint(page, source);
        if (mobile) await page.touchscreen.tap(at.x, at.y);
        else await page.mouse.click(at.x, at.y);
        await frame(page);
        assert.equal(await page.locator('.unit-panel').getAttribute('data-skill-state'), 'ready');
        const dp = Number(await page.locator('.dp-panel strong').textContent());
        const activate = page.getByRole('button', { name: '스킬 발동', exact: true });
        if (mobile) await activate.tap();
        else await activate.click();
        await frame(page);
        if (plan.unitId === 'penguin') {
          assert.equal(Number(await page.locator('.dp-panel strong').textContent()), dp + 12);
          assert.equal(await page.locator('.unit-panel').getAttribute('data-skill-state'), 'charging');
        } else {
          assert.equal(await page.locator('.unit-panel').getAttribute('data-skill-state'), 'active');
          await page.screenshot({
            path: `docs/verification/defense-${mobile ? 'mobile' : 'desktop'}-skill.png`,
          });
        }
        await page.keyboard.press('Escape');
        await frame(page);
      }
      console.log(`${mobile ? 'touch' : 'mouse'}: ${plan.unitId} 배치 완료`);
    }
    await resume(page);
    await frame(page, 4000);
    await pause(page);
    await page.screenshot({ path: `docs/verification/defense-${mobile ? 'mobile' : 'desktop'}.png` });
    await resume(page);
    await frame(page, 60000);
    assert.equal(await page.locator('.battle-result strong').textContent(), '방어 성공!');
    assert.equal(await page.locator('.battle-result p').textContent(), '푸딩 3개 · 처치 21/21');
    await page.screenshot({ path: `docs/verification/defense-${mobile ? 'mobile' : 'desktop'}-clear.png` });
    assert.deepEqual(errors, []);
    console.log(
      JSON.stringify({
        input: mobile ? 'touch' : 'mouse',
        result: await page.locator('.battle-result p').textContent(),
        errors,
      }),
    );
    await context.close();
  }
} finally {
  await browser.close();
}
