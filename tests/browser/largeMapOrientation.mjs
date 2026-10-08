import assert from 'node:assert/strict';
import { writeFile } from 'node:fs/promises';
import { chromium } from 'playwright';
import { deploy, frame, pause, tilePoint } from './helpers.mjs';

const browser = await chromium.launch({ channel: 'msedge', headless: true });
const prefix = process.env.MALLANG_SCREENSHOT_PREFIX ?? 't4.4';
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
  page.on('console', (message) => {
    if (['error', 'warning'].includes(message.type())) errors.push(message.text());
  });
  const time = new Date('2026-10-09T11:00:00Z');
  await page.clock.install({ time });
  await page.clock.pauseAt(time);
  await page.addInitScript(() => {
    window.requestAnimationFrame = (callback) => setTimeout(() => callback(performance.now()), 100);
    window.cancelAnimationFrame = (id) => clearTimeout(id);
    const stages = {};
    for (let i = 1; i <= 6; i++) stages[`stage-${i}`] = { cleared: true, bestLife: 1 };
    localStorage.setItem('mallang-guard:v1', JSON.stringify({ version: 1, stages }));
  });
  await page.goto('http://127.0.0.1:43195/');
  await page.locator('.title-screen').waitFor();
  await page.evaluate(async () => {
    const { Battle } = await import('/src/sim/battle.ts');
    const original = Battle.prototype.flush;
    Battle.prototype.flush = function (...args) {
      window.largeMapBattle = this;
      return original.apply(this, args);
    };
  });
  await page.getByRole('button', { name: '스테이지 선택', exact: true }).tap();
  const card = page.locator('.stage-card[data-stage-id="stage-7"]');
  assert.equal(await card.isDisabled(), false);
  assert.equal(await card.locator('.stage-map > span').count(), 264);
  await card.scrollIntoViewIfNeeded();
  await frame(page);
  await card.tap();
  await frame(page);
  assert.equal(await page.locator('#app').getAttribute('data-stage-id'), 'stage-7', JSON.stringify(errors));
  assert.deepEqual(errors, []);
  await pause(page);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.locator('.rotate-guide').waitFor({ state: 'visible' });
  await frame(page, 2000);
  assert.equal(await page.evaluate(() => window.largeMapBattle.state.tick), 0);
  await page.screenshot({ path: `docs/verification/${prefix}-mobile-large-map-portrait.png` });
  await page.setViewportSize({ width: 844, height: 390 });
  await page.locator('.rotate-guide').waitFor({ state: 'hidden' });
  await frame(page);
  assert.equal(await page.locator('[data-action="pause"]').textContent(), '계속하기');
  const cdp = await context.newCDPSession(page);
  await deploy(page, cdp, 'squirrel', { x: 21, y: 8 }, 'left');
  await deploy(page, cdp, 'penguin', { x: 3, y: 1 }, 'down');
  await page.setViewportSize({ width: 740, height: 360 });
  await frame(page);
  await page.screenshot({
    path: `docs/verification/${prefix}-compact-large-map-selection.png`,
    animations: 'disabled',
  });
  await frame(page);
  const point = await tilePoint(page, { x: 21, y: 8 });
  await page.touchscreen.tap(point.x, point.y);
  await frame(page);
  assert.equal(await page.locator('.unit-popup-name').textContent(), '토리');
  await page.screenshot({
    path: `docs/verification/${prefix}-compact-large-map-selection.png`,
    animations: 'disabled',
  });
  const units = await page.evaluate(() =>
    window.largeMapBattle.state.units.map(({ unitId, tile, dir }) => ({ unitId, tile, dir })),
  );
  assert.deepEqual(units, [
    { unitId: 'squirrel', tile: { x: 21, y: 8 }, dir: 'left' },
    { unitId: 'penguin', tile: { x: 3, y: 1 }, dir: 'down' },
  ]);
  assert.deepEqual(errors, []);
  const result = {
    legacyUnlock: true,
    previewTiles: 264,
    portrait: true,
    compactSelection: true,
    units,
    errors,
  };
  await writeFile(`docs/verification/${prefix}-orientation.json`, `${JSON.stringify(result, null, 2)}\n`);
  console.log(JSON.stringify(result));
  await context.close();
} finally {
  await browser.close();
}
