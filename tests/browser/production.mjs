import assert from 'node:assert/strict';
import { chromium } from 'playwright';

const browser = await chromium.launch({ channel: 'msedge', headless: true });
const prefix = process.env.MALLANG_SCREENSHOT_PREFIX ?? 'v0.1';
try {
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
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
  assert.equal(await page.locator('.stage-card').count(), 6);
  assert.equal(await page.locator('.stage-card:disabled').count(), 5);
  assert((await page.locator('.stage-enemy svg').count()) > 7);
  await page.locator('.stage-card[data-stage-id="stage-1"]').click();
  await page.locator('.deploy-card').first().waitFor();
  assert.equal(await page.locator('.card-portrait svg').count(), 8);
  assert.equal(
    await page.locator('#board').evaluate((node) => node.getContext('webgl2').isContextLost()),
    false,
  );
  await page.locator('[data-action="pause"]').click();
  await page.locator('.pause-menu').getByRole('button', { name: '멈춘 채 배치' }).click();
  await page.screenshot({ path: `docs/verification/${prefix}-production.png` });
  assert.deepEqual(errors, []);
  console.log(JSON.stringify({ productionBase: '/mallang-guard/', portraits: 8, webgl: true, errors }));
} finally {
  await browser.close();
}
