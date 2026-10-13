import assert from 'node:assert/strict';
import { writeFile } from 'node:fs/promises';
import { chromium } from 'playwright';
import { frame } from './helpers.mjs';
import { resultBounds, screenFlowContext } from './screenFlowScene.mjs';
import { createShopAuditGame } from './shopScene.mjs';

const prefix = process.env.MALLANG_SCREENSHOT_PREFIX ?? 't4.25';
const browser = await chromium.launch({ channel: 'msedge', headless: true });
const report = [];
const assertResult = async (page) => {
  const bounds = await resultBounds(page);
  assert(bounds.fits && bounds.noDialogScroll && bounds.moneyVisible, JSON.stringify(bounds));
  assert(
    bounds.buttons.every((b) => b.visible && b.size),
    JSON.stringify(bounds),
  );
  return bounds;
};
try {
  for (const [width, height] of [
    [1920, 1080],
    [1280, 720],
    [844, 390],
    [740, 360],
    [600, 400],
    [540, 360],
    [390, 844],
    [320, 568],
  ]) {
    const { context, page, errors, click, read, deploy, finish } = await screenFlowContext(
      browser,
      width,
      height,
    );
    const shop = () => click(page.getByRole('button', { name: '상점 · 모집', exact: true }));
    await click(page.getByRole('button', { name: '스테이지 선택', exact: true }));
    assert(await page.locator('.stage-card[data-stage-id="stage-2"]').isDisabled());
    await click(page.getByRole('button', { name: '타이틀로', exact: true }));
    await shop();
    assert.equal(await page.locator('.shop-back').textContent(), '타이틀로');
    await click(page.locator('.shop-unit[data-unit-id="owl"] summary'));
    await click(page.locator('.recruit-single'));
    await click(page.locator('.recruit-confirm'));
    assert(
      await page.locator('.shop-unit[data-unit-id="owl"] details').evaluate((n) => n.open),
      '모집 후 읽던 상세 유지',
    );
    assert(await page.locator('.recruit-single').evaluate((n) => n === document.activeElement));
    const beforeWin = await read();
    await click(page.locator('.shop-back'));
    assert.equal(await page.locator('#app').getAttribute('data-screen'), 'title');
    await finish();
    assert.equal(await page.locator('.battle-result').getAttribute('data-result'), 'won');
    const initialResult = await assertResult(page);
    const won = await read();
    assert.equal(won.collection.money, beforeWin.collection.money + 720);
    await page.evaluate(() => {
      window.finishedBattle = window.shopAudit.battle;
      window.finishedState = JSON.stringify(window.finishedBattle.state);
    });
    await page.screenshot({
      path: `docs/verification/${prefix}-${width}x${height}-result.png`,
      animations: 'disabled',
    });
    await shop();
    assert.equal(await page.locator('.shop-back').textContent(), '전투 결과로');
    const missing = ['owl', 'wolf'].find((id) => !won.collection.ownedUnits.includes(id));
    assert(missing);
    await click(page.locator(`.shop-unit[data-unit-id="${missing}"] summary`));
    await click(page.locator(`.shop-unit[data-unit-id="${missing}"] .shop-buy`));
    await click(page.locator('.recruit-confirm'));
    const purchased = await read();
    assert.equal(purchased.collection.money, won.collection.money - 600);
    assert.equal(purchased.collection.rngState, won.collection.rngState);
    assert.equal(purchased.collection.pullsSinceNew, won.collection.pullsSinceNew);
    const focus = await page.evaluate(() => ({
      id: document.activeElement.closest('.shop-unit')?.dataset.unitId,
      top: document.activeElement.getBoundingClientRect().top,
      bottom: document.activeElement.getBoundingClientRect().bottom,
      height: innerHeight,
    }));
    assert.equal(focus.id, missing, '구매 후 해당 친구의 상세로 복귀');
    assert(focus.top >= 0 && focus.bottom <= focus.height, JSON.stringify(focus));
    assert(await page.locator(`.shop-unit[data-unit-id="${missing}"] details`).evaluate((n) => n.open));
    await page.screenshot({
      path: `docs/verification/${prefix}-${width}x${height}-shop-detail.png`,
      animations: 'disabled',
    });
    await page.setViewportSize(width >= 600 ? { width: 390, height: 844 } : { width: 844, height: 390 });
    await click(page.locator('.shop-back'));
    await assertResult(page);
    assert.equal(await page.locator('.battle-result').getAttribute('data-result'), 'won');
    assert.match(
      await page.locator('.result-money').textContent(),
      new RegExp(`잔액 ${purchased.collection.money.toLocaleString()}머니`),
    );
    assert.deepEqual(await read(), purchased, '상점 복귀는 보상을 다시 지급하지 않는다');
    assert(
      await page.evaluate(
        () =>
          window.finishedBattle === window.shopAudit.battle &&
          window.finishedState === JSON.stringify(window.shopAudit.battle.state),
      ),
    );
    assert(
      await page
        .locator('#board')
        .evaluate((n) => !n.hidden && n.width >= n.clientWidth && !n.getContext('webgl2').isContextLost()),
    );
    assert(await page.locator('#overlay').evaluate((n) => !n.hidden && n.width >= n.clientWidth));
    await page.setViewportSize({ width, height });
    await frame(page);
    for (let round = 0; round < 3; round++) {
      await shop();
      await click(page.locator('.shop-back'));
    }
    assert.equal(
      await page.evaluate(() => window.pendingGameFrames()),
      0,
      '종료 전투 루프는 상점 왕복 후에도 멈춤',
    );
    assert.deepEqual(await read(), purchased);
    await click(page.getByRole('button', { name: '다음 스테이지', exact: true }));
    assert.equal(await page.locator('#app').getAttribute('data-stage-id'), 'stage-2');
    assert.equal(await page.locator('.deploy-card').count(), purchased.collection.ownedUnits.length);
    await deploy(missing);
    await page.keyboard.press('Escape');
    await frame(page);
    await click(page.getByRole('button', { name: '다시 시작', exact: true }));
    assert.equal(await page.evaluate(() => window.shopAudit.battle.state.units.length), 0);
    assert.deepEqual(await read(), purchased, '다음 전투 재시작은 보상 없음');
    await click(page.locator('[data-action="exit"]'));
    assert.deepEqual(await read(), purchased, '중도 종료는 보상 없음');
    assert.equal(await page.locator('#hud').evaluate((n) => n.children.length), 0);
    assert.equal(await page.evaluate(() => window.pendingGameFrames()), 0);
    await page.reload();
    await page.evaluate(createShopAuditGame, { nextStage: true });
    assert.deepEqual(await read(), purchased);
    await page.evaluate(createShopAuditGame, { defeat: true, nextStage: true });
    await finish();
    assert.equal(await page.locator('.battle-result').getAttribute('data-result'), 'lost');
    await assertResult(page);
    const lost = await read();
    assert.equal(lost.collection.money, purchased.collection.money + 2);
    await shop();
    await click(page.locator('.shop-back'));
    assert.equal(await page.locator('.battle-result').getAttribute('data-result'), 'lost');
    assert.equal(await page.getByRole('button', { name: '다음 스테이지', exact: true }).count(), 0);
    assert.deepEqual(await read(), lost);
    assert.equal(lost.stages['stage-1'].bestLife, 3);
    assert.deepEqual(errors, []);
    report.push({
      viewport: `${width}x${height}`,
      initialResult,
      detailsPreserved: true,
      purchaseFocus: focus.id,
      returnToWonResult: true,
      returnToLostResult: true,
      resize: true,
      rewardOnce: true,
      nextStageWithPurchasedUnit: true,
      restartAndExitRewardZero: true,
      stoppedFrames: true,
      reload: true,
      errors,
    });
    console.log(JSON.stringify(report.at(-1)));
    await context.close();
  }
  const { context, page, errors, click, read, finish } = await screenFlowContext(browser, 1280, 720);
  await finish(true);
  assert.equal(await page.locator('.reward-unsaved').count(), 1);
  assert.equal((await read()).collection.money, 300);
  await page.evaluate(() => {
    Storage.prototype.setItem = window.savedSetItem;
  });
  await click(page.getByRole('button', { name: '상점 · 모집', exact: true }));
  await click(page.locator('.recruit-single'));
  await click(page.locator('.recruit-confirm'));
  const recovered = await read();
  assert.equal(recovered.stages['stage-1'].bestLife, 3);
  assert([920, 950].includes(recovered.collection.money));
  await click(page.locator('.shop-back'));
  assert.equal(
    await page.locator('.reward-unsaved').count(),
    0,
    '거래로 저장 성공한 보상은 실패 안내를 없앤다',
  );
  assert.deepEqual(await read(), recovered);
  assert.deepEqual(errors, []);
  await context.close();
  await writeFile(
    `docs/verification/${prefix}-screen-flow.json`,
    `${JSON.stringify({ screens: report, rewardSaveRecovery: true }, null, 2)}\n`,
  );
} catch (error) {
  for (const context of browser.contexts())
    for (const page of context.pages()) {
      await page
        .screenshot({ path: `docs/verification/${prefix}-screen-flow-failure.png`, animations: 'disabled' })
        .catch(() => {});
    }
  throw error;
} finally {
  await browser.close();
}
