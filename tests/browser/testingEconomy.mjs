import assert from 'node:assert/strict';
import { writeFile } from 'node:fs/promises';
import { chromium } from 'playwright';
import { deploy, enterBattle, frame, pause, resume } from './helpers.mjs';

const prefix = process.env.MALLANG_SCREENSHOT_PREFIX ?? 't4.30';
const browser = await chromium.launch({ channel: 'msedge', headless: true });
const report = [];
try {
  for (const [width, height] of [
    [1280, 720],
    [844, 390],
    [320, 568],
  ]) {
    const touch = width < 1000;
    const context = await browser.newContext({
      viewport: { width, height },
      hasTouch: touch,
      isMobile: touch,
    });
    const page = await context.newPage();
    const errors = [];
    page.on('pageerror', (e) => errors.push(e.message));
    page.on('console', (message) => {
      if (['error', 'warning'].includes(message.type())) errors.push(message.text());
    });
    const time = new Date('2026-10-15T12:00:00Z');
    await page.clock.install({ time });
    await page.clock.pauseAt(new Date(time.getTime() + 1000));
    await page.addInitScript(() => {
      window.requestAnimationFrame = (cb) => setTimeout(() => cb(performance.now()), 100);
      window.cancelAnimationFrame = (id) => clearTimeout(id);
    });
    await page.goto('http://127.0.0.1:43195/');
    await page.locator('.title-screen').waitFor();
    const read = () => page.evaluate(() => JSON.parse(localStorage.getItem('mallang-guard:v1')));
    const initial = await read();
    assert.equal(initial.collection.ownedUnits.length, 14);
    assert.equal(initial.collection.money, 300);
    assert.match(await page.locator('.title-version').textContent(), /모든 친구 사용 가능/);
    await page.getByRole('button', { name: '설정', exact: true }).click();
    await page.getByLabel('화면 품질').selectOption('low');
    await page.getByRole('button', { name: '완료' }).click();
    await page.getByRole('button', { name: '상점 · 모집', exact: true }).click();
    assert.equal(await page.locator('.shop-unit[data-owned="true"]').count(), 14);
    assert.equal(await page.locator('.shop-buy:disabled').count(), 14);
    assert((await page.locator('.shop-copy').first().textContent()).includes('모든 친구'));
    await page.screenshot({ path: `docs/verification/${prefix}-${width}x${height}-all-owned.png` });
    await page.locator('.shop-back').click();
    await enterBattle(page, { waitForStart: false });
    await pause(page);
    const costs = await page.evaluate(async () => {
      const { content } = await import('/src/data/index.ts');
      return Object.fromEntries([...content.units].map(([id, unit]) => [id, unit.cost]));
    });
    assert.equal(await page.locator('.deploy-card').count(), 14);
    assert.equal(await page.locator('.dp-panel strong').textContent(), '10');
    assert.equal(await page.locator('.dp-panel strong').getAttribute('title'), '최대 50개');
    const click = async (locator) => {
      await locator.scrollIntoViewIfNeeded();
      if (touch) await locator.tap();
      else await locator.click();
      await frame(page);
    };
    for (const [id, cost] of Object.entries(costs)) {
      await click(page.locator(`.deploy-card[data-unit-id="${id}"]`));
      assert.equal(await page.locator('.roster-panel').getAttribute('data-unit-id'), id);
      assert((await page.locator('.roster-stats').textContent()).includes(`배치 도토리 ${cost} ·`));
      if (id === 'squirrel')
        assert((await page.locator('.roster-skill-description').textContent()).includes('+1'));
      if (id === 'snowLeopard') {
        await page.screenshot({ path: `docs/verification/${prefix}-${width}x${height}-nova-card.png` });
        const bounds = await page.locator('.roster-panel').boundingBox();
        assert(bounds.x >= 0 && bounds.x + bounds.width <= width + 1, '캐릭터 정보 가로 잘림 없음');
      }
      await click(page.locator('.roster-close'));
    }
    const cdp = touch ? await context.newCDPSession(page) : null;
    await page.locator('.deploy-card[data-unit-id="squirrel"]').scrollIntoViewIfNeeded();
    await deploy(page, cdp, 'squirrel', { x: 2, y: 0 }, 'down');
    assert.equal(await page.locator('.dp-panel strong').textContent(), '4', '10 - 새 배치 비용 6');
    await resume(page, 20000);
    const earned = Number(await page.locator('.dp-panel strong').textContent());
    assert(earned >= 7 && earned <= 50, '실제 적 처치로 감소한 보상 획득');
    await pause(page);
    await page.screenshot({ path: `docs/verification/${prefix}-${width}x${height}-battle.png` });
    await page.locator('[data-action="exit"]').click();
    await page.reload();
    await page.locator('.title-screen').waitFor();
    assert.deepEqual((await read()).collection, initial.collection, '중도 나가기·재시작 후 보유/머니 유지');
    assert.deepEqual(errors, []);
    report.push({ width, height, owned: 14, selected: Object.keys(costs).length, costs, earned, errors });
    await context.close();
  }
  await writeFile(
    `docs/verification/${prefix}-testing-economy-ui.json`,
    `${JSON.stringify(report, null, 2)}\n`,
  );
  console.log(JSON.stringify(report));
} catch (error) {
  for (const context of browser.contexts())
    for (const page of context.pages()) {
      await page.screenshot({ path: `docs/verification/${prefix}-testing-economy-failure.png` });
      console.log(await page.locator('body').innerText());
    }
  throw error;
} finally {
  await browser.close();
}
