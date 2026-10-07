import assert from 'node:assert/strict';
import { chromium } from 'playwright';
import { enterBattle, frame } from './helpers.mjs';

const browser = await chromium.launch({
  channel: 'msedge',
  headless: true,
  args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'],
});
try {
  const context = await browser.newContext({
    viewport: { width: 844, height: 390 },
    hasTouch: true,
    isMobile: true,
  });
  await context.grantPermissions(['local-network-access']);
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  const time = new Date('2026-10-07T03:00:00Z');
  await page.clock.install({ time });
  await page.clock.pauseAt(time);
  await page.addInitScript(() => {
    window.requestAnimationFrame = (callback) => setTimeout(() => callback(performance.now()), 100);
    window.cancelAnimationFrame = (id) => clearTimeout(id);
  });
  await page.goto('http://127.0.0.1:43195/');
  await enterBattle(page);
  await page.locator('[data-action="pause"]').tap();
  await frame(page);
  await page.setViewportSize({ width: 390, height: 844 });
  await frame(page);
  await page.locator('.pause-menu').getByRole('button', { name: '계속하기', exact: true }).tap();
  await frame(page, 2000);
  assert.equal(await page.locator('.rotate-guide').isVisible(), true);
  assert.equal(
    await page.locator('.dp-panel strong').textContent(),
    '10',
    '세로 화면에서는 메뉴를 닫아도 정지 유지',
  );
  await page.setViewportSize({ width: 844, height: 390 });
  await frame(page, 1100);
  assert.equal(await page.locator('[data-action="pause"]').textContent(), '일시정지');
  assert.equal(await page.locator('.dp-panel strong').textContent(), '11');
  await page.locator('[data-action="pause"]').tap();
  await frame(page);
  await page.setViewportSize({ width: 390, height: 844 });
  await frame(page);
  await page.getByRole('button', { name: '멈춘 채 배치' }).tap();
  await frame(page);
  await page.setViewportSize({ width: 844, height: 390 });
  await frame(page, 2000);
  assert.equal(await page.locator('[data-action="pause"]').textContent(), '계속하기');
  assert.equal(
    await page.locator('.dp-panel strong').textContent(),
    '11',
    '수동으로 멈춘 전투는 회전 후에도 정지 유지',
  );
  assert.deepEqual(errors, []);
  console.log(JSON.stringify({ orientation: true, pausedDeployment: true, errors }));
  await context.close();
} finally {
  await browser.close();
}
