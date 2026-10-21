import assert from 'node:assert/strict';
import { writeFile } from 'node:fs/promises';
import { deploy, frame, pause, resume, tilePoint } from './helpers.mjs';

export async function verifyEarnedRarePurchases(page, mobile, prefix, label, { injectedMoney = false } = {}) {
  const click = async (locator) => {
    if (mobile) await locator.tap();
    else await locator.click();
    await frame(page);
  };
  const saved = () => page.evaluate(() => JSON.parse(localStorage.getItem('mallang-guard:v1')));
  const before = await saved();
  const ids = ['fox', 'redPanda', 'deer'];
  const { prices, deployCost } = await page.evaluate(async (ids) => {
    const { unitPriceFor } = await import('/src/data/recruitment.ts');
    const { content } = await import('/src/data/index.ts');
    return {
      prices: Object.fromEntries(ids.map((id) => [id, unitPriceFor(id)])),
      deployCost: content.units.get('deer').cost,
    };
  }, ids);
  const missing = ids.filter((id) => !before.collection.ownedUnits.includes(id));
  const purchaseCost = missing.reduce((sum, id) => sum + prices[id], 0);
  assert(before.collection.money >= purchaseCost, '실제 미보유 친구 영입 비용 확보');
  await click(page.getByRole('button', { name: '상점 · 모집', exact: true }));
  for (const id of ids) {
    const card = page.locator(`.shop-unit[data-unit-id="${id}"]`);
    if (!missing.includes(id)) {
      assert.equal(await card.getAttribute('data-owned'), 'true');
      assert(await card.locator('.shop-buy').isDisabled());
      continue;
    }
    await click(card.locator('.shop-buy'));
    assert.equal(await page.locator('.recruit-result').getAttribute('data-unit-id'), id);
    await click(page.locator('.recruit-confirm'));
  }
  const after = await saved();
  assert.equal(after.collection.money, before.collection.money - purchaseCost);
  assert.deepEqual(after.collection.ownedUnits, [...before.collection.ownedUnits, ...missing]);
  assert.equal(after.collection.rngState, before.collection.rngState);
  assert.equal(after.collection.pullsSinceNew, before.collection.pullsSinceNew);
  assert.deepEqual(after.stages, before.stages);
  await page.screenshot({ path: `docs/verification/${prefix}-${label}-earned-rares.png` });
  await click(page.getByRole('button', { name: '전투 결과로', exact: true }));
  await click(page.getByRole('button', { name: '스테이지 선택', exact: true }));
  await click(page.locator('.stage-card[data-stage-id="stage-7"]'));
  await pause(page);
  for (const id of ['fox', 'redPanda', 'deer'])
    assert.equal(await page.locator(`.deploy-card[data-unit-id="${id}"]`).count(), 1);
  const cdp = mobile ? await page.context().newCDPSession(page) : null;
  await deploy(page, cdp, 'squirrel', { x: 6, y: 3 }, 'left');
  await deploy(page, cdp, 'penguin', { x: 6, y: 8 }, 'left');
  await resume(page);
  await click(page.locator('[data-action="start"]'));
  await frame(page, 15100);
  await pause(page);
  const squirrelPoint = await tilePoint(page, { x: 6, y: 3 });
  if (mobile) await page.touchscreen.tap(squirrelPoint.x, squirrelPoint.y);
  else await page.mouse.click(squirrelPoint.x, squirrelPoint.y);
  await frame(page);
  assert(!(await page.locator('.skill-button').isDisabled()));
  await click(page.locator('.skill-button'));
  await click(page.locator('.unit-popup-close'));
  await resume(page);
  for (let second = 0; second < 90; second++) {
    if (await page.evaluate((cost) => window.campaign.battle.state.dp >= cost, deployCost)) break;
    await frame(page, 1000);
  }
  await pause(page);
  const tile = await page.evaluate(() => {
    const board = window.campaign.battle.stage.board;
    const tiles = [];
    for (let y = 0; y < board.height; y++)
      for (let x = 0; x < board.width; x++) if (board.kindAt(x, y) === 'high') tiles.push({ x, y });
    return tiles.sort(
      (a, b) =>
        Math.hypot(a.x - board.width / 2, a.y - board.height / 2) -
        Math.hypot(b.x - board.width / 2, b.y - board.height / 2),
    )[0];
  });
  const dpBefore = await page.evaluate(() => window.campaign.battle.state.dp);
  assert(dpBefore >= deployCost, '처치 수입으로 실제 배치 비용 확보');
  await page.locator('.deploy-card[data-unit-id="deer"]').scrollIntoViewIfNeeded();
  await deploy(page, cdp, 'deer', tile, 'right');
  assert.equal(await page.evaluate(() => window.campaign.battle.state.dp), dpBefore - deployCost);
  await page.screenshot({ path: `docs/verification/${prefix}-${label}-earned-rare-deploy.png` });
  const result = {
    viewport: label,
    before: before.collection,
    after: after.collection,
    originalStagesPreserved: true,
    deployedOnOriginalStage7: true,
    tile,
    dpBefore,
    deployCost,
    purchaseCost,
    purchased: missing,
    injectedMoney,
  };
  await writeFile(
    `docs/verification/${prefix}-${label}-earned-rares.json`,
    `${JSON.stringify(result, null, 2)}\n`,
  );
  console.log(
    JSON.stringify({
      viewport: label,
      moneyBefore: before.collection.money,
      rarePurchases: missing.length,
      balance: after.collection.money,
      originalStage7Deploy: true,
    }),
  );
}
