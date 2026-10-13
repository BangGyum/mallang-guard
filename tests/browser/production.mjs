import assert from 'node:assert/strict';
import { chromium } from 'playwright';

const browser = await chromium.launch({ channel: 'msedge', headless: true });
const prefix = process.env.MALLANG_SCREENSHOT_PREFIX ?? 'v0.1';
try {
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
  const time = new Date('2026-10-13T02:00:00Z');
  await page.clock.install({ time });
  await page.clock.pauseAt(new Date(time.getTime() + 1000));
  await page.addInitScript(() => {
    window.requestAnimationFrame = (cb) => setTimeout(() => cb(performance.now()), 100);
    window.cancelAnimationFrame = (id) => clearTimeout(id);
  });
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  page.on('response', (response) => {
    if (response.status() >= 400) errors.push(`${response.status()} ${response.url()}`);
  });
  page.on('console', (message) => {
    if (['error', 'warning'].includes(message.type())) errors.push(message.text());
  });
  await page.goto(process.env.MALLANG_PREVIEW_URL ?? 'http://127.0.0.1:43205/mallang-guard/');
  await page.getByRole('button', { name: '설정', exact: true }).click();
  await page.getByLabel('화면 품질').selectOption('low');
  await page.getByRole('button', { name: '완료' }).click();
  await page.getByRole('button', { name: '스테이지 선택', exact: true }).click();
  assert.equal(await page.locator('.stage-card').count(), 7);
  assert.equal(await page.locator('.stage-card:disabled').count(), 6);
  assert((await page.locator('.stage-enemy svg').count()) > 7);
  assert.equal(await page.locator('.stage-card[data-stage-id="stage-7"] .stage-enemy').count(), 17);
  await page.locator('.stage-card[data-stage-id="stage-1"]').click();
  await page.locator('.deploy-card').first().waitFor();
  await page.clock.runFor(120);
  assert.equal(await page.locator('.card-portrait svg').count(), 8);
  assert.equal(await page.locator('.battle-wave').textContent(), 'WAVE 0/12');
  assert.equal(await page.locator('.dp-source').textContent(), '처치 보상');
  assert.equal(await page.locator('.dp-panel progress').count(), 0);
  assert.equal(
    await page.locator('#board').evaluate((node) => node.getContext('webgl2').isContextLost()),
    false,
  );
  await page.locator('[data-action="pause"]').click();
  await page.locator('.pause-menu').getByRole('button', { name: '멈춘 채 배치' }).click();
  await page.clock.runFor(120);
  await page.screenshot({ path: `docs/verification/${prefix}-production.png` });
  await page.locator('[data-action="exit"]').click();
  await page.locator('.title-screen').waitFor();
  assert.equal(await page.locator('#hud').evaluate((node) => node.children.length), 0);
  await page.getByRole('button', { name: '시작', exact: true }).click();
  await page.clock.runFor(60000);
  assert.equal(await page.locator('.battle-result').getAttribute('data-result'), 'lost');
  await page.getByRole('button', { name: '상점 · 모집', exact: true }).click();
  assert.equal(await page.locator('.shop-back').textContent(), '전투 결과로');
  await page.locator('.recruit-single').click();
  await page.locator('.recruit-confirm').click();
  const money = await page.evaluate(
    () => JSON.parse(localStorage.getItem('mallang-guard:v1')).collection.money,
  );
  assert([200, 230].includes(money));
  await page.locator('.shop-back').click();
  assert.equal(await page.locator('.battle-result').getAttribute('data-result'), 'lost');
  assert.equal(await page.getByRole('button', { name: '다음 스테이지', exact: true }).count(), 0);
  assert.match(await page.locator('.result-money').textContent(), new RegExp(`잔액 ${money}머니`));
  await page.screenshot({ path: `docs/verification/${prefix}-production-result.png` });
  await page.getByRole('button', { name: '타이틀로', exact: true }).click();
  assert.equal(await page.locator('#hud').evaluate((node) => node.children.length), 0);
  assert.deepEqual(errors, []);
  console.log(
    JSON.stringify({
      productionBase: '/mallang-guard/',
      portraits: 8,
      webgl: true,
      waves: 12,
      killOnlyIncome: true,
      exit: true,
      shopReturnToResult: true,
      currentBalanceAfterRecruit: true,
      errors,
    }),
  );
} finally {
  await browser.close();
}
