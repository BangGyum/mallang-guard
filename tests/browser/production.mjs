import assert from 'node:assert/strict';
import { writeFile } from 'node:fs/promises';
import { chromium } from 'playwright';

const browser = await chromium.launch({ channel: 'msedge', headless: true });
const prefix = process.env.MALLANG_SCREENSHOT_PREFIX ?? 'v0.1';
const rareFirst = process.argv.includes('--rare-first');
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
  await page.locator('.title-screen').waitFor();
  assert((await page.locator('.title-wallet').textContent()).includes('보유 14/14'));
  assert.match(await page.locator('.title-version').textContent(), /모든 친구 사용 가능/);
  // 첫 모집의 일반/희귀 결과를 모두 재현하며 나머지 신규 저장 값은 그대로 사용합니다.
  await page.evaluate(
    (rngState) => {
      const profile = JSON.parse(localStorage.getItem('mallang-guard:v1'));
      profile.collection.rngState = rngState;
      // 기존 기본 8종 계정도 재화/난수 손실 없이 전원 지급되는지 확인합니다.
      profile.collection.ownedUnits = profile.collection.ownedUnits.slice(0, 8);
      localStorage.setItem('mallang-guard:v1', JSON.stringify(profile));
    },
    rareFirst ? 36 : 1,
  );
  await page.reload();
  await page.getByRole('button', { name: '설정', exact: true }).click();
  await page.getByLabel('화면 품질').selectOption('low');
  await page.getByRole('button', { name: '완료' }).click();
  await page.getByRole('button', { name: '스테이지 선택', exact: true }).click();
  assert.equal(await page.locator('.stage-card').count(), 7);
  assert.equal(await page.locator('.stage-theme').count(), 7);
  assert.equal(
    await page
      .locator('.stage-map')
      .evaluateAll((maps) => new Set(maps.map((map) => map.dataset.stageTheme)).size),
    7,
  );
  assert.equal(await page.locator('.stage-card:disabled').count(), 6);
  assert((await page.locator('.stage-enemy svg').count()) > 7);
  assert.equal(await page.locator('.stage-card[data-stage-id="stage-7"] .stage-enemy').count(), 17);
  await page.locator('.stage-card[data-stage-id="stage-1"]').click();
  await page.locator('.deploy-card').first().waitFor();
  assert.equal(await page.locator('#board').getAttribute('data-stage-theme'), 'yard');
  await page.clock.runFor(120);
  assert.equal(await page.locator('.card-portrait svg').count(), 14);
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
  assert.equal(await page.locator('.shop-unit').count(), 14);
  assert.equal(await page.locator('.shop-unit[data-rarity="SSR"]').count(), 3);
  assert.equal(await page.locator('.shop-unit[data-rarity="UR"]').count(), 1);
  for (const id of ['fox', 'redPanda', 'deer']) {
    const card = page.locator(`.shop-unit[data-unit-id="${id}"]`);
    assert.equal(await card.getAttribute('data-owned'), 'true');
    assert.equal(await card.locator('.shop-buy').textContent(), '보유 중');
    assert(await card.locator('.shop-buy').isDisabled());
  }
  assert.equal(await page.locator('.shop-rate-list li').filter({ hasText: '1.67%' }).count(), 3);
  await page.locator('.recruit-single').click();
  assert.equal(await page.locator('.recruit-result').getAttribute('data-rarity'), rareFirst ? 'SSR' : 'R');
  await page.locator('.recruit-confirm').click();
  const money = await page.evaluate(
    () => JSON.parse(localStorage.getItem('mallang-guard:v1')).collection.money,
  );
  assert.equal(money, 230, '전원 보유의 첫 모집은 항상 중복 환급');
  await page.locator('.shop-back').click();
  assert.equal(await page.locator('.battle-result').getAttribute('data-result'), 'lost');
  assert.equal(await page.getByRole('button', { name: '다음 스테이지', exact: true }).count(), 0);
  assert.match(await page.locator('.result-money').textContent(), new RegExp(`잔액 ${money}머니`));
  await page.screenshot({ path: `docs/verification/${prefix}-production-result.png` });
  await page.getByRole('button', { name: '타이틀로', exact: true }).click();
  assert.equal(await page.locator('#hud').evaluate((node) => node.children.length), 0);
  const collection = await page.evaluate(
    () => JSON.parse(localStorage.getItem('mallang-guard:v1')).collection,
  );
  assert.equal(collection.ownedUnits.length, 14);
  await page.reload();
  const restored = await page.evaluate(() => JSON.parse(localStorage.getItem('mallang-guard:v1')).collection);
  assert.deepEqual(restored, collection, '중복 모집 후 저장 복원');
  await page.reload();
  await page.getByRole('button', { name: '시작', exact: true }).click();
  await page.clock.runFor(120);
  for (const id of ['fox', 'redPanda', 'deer', 'snowLeopard'])
    assert.equal(await page.locator(`.deploy-card[data-unit-id="${id}"] .card-portrait svg`).count(), 1);
  await page.screenshot({ path: `docs/verification/${prefix}-production-rares.png` });
  assert.deepEqual(errors, []);
  const result = {
    productionBase: '/mallang-guard/',
    portraits: 14,
    webgl: true,
    waves: 12,
    killOnlyIncome: true,
    exit: true,
    shopReturnToResult: true,
    currentBalanceAfterRecruit: true,
    rareShopUnits: 3,
    allOwnedByDefault: true,
    existingProfileGrant: true,
    collectionReload: true,
    duplicateRefund: 30,
    rareRates: '5% aggregate, 1.67% rounded per unit',
    productionFirstDrawSeed: rareFirst ? 36 : 1,
    errors,
  };
  await writeFile(`docs/verification/${prefix}-production.json`, `${JSON.stringify(result, null, 2)}\n`);
  console.log(JSON.stringify(result));
} finally {
  await browser.close();
}
