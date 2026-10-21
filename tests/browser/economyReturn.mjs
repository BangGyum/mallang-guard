import assert from 'node:assert/strict';
import { chromium } from 'playwright';
import { installCampaignAudit } from './campaignAudit.mjs';
import { verifyEarnedRarePurchases } from './rareCampaignPurchases.mjs';

const prefix = process.env.MALLANG_SCREENSHOT_PREFIX ?? 't4.30-review';
const browser = await chromium.launch({ channel: 'msedge', headless: true });
try {
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
  const errors = [];
  let moduleUrl;
  page.on('request', (request) => {
    if (new URL(request.url()).pathname === '/src/sim/battle.ts') moduleUrl = request.url();
  });
  page.on('pageerror', (error) => errors.push(error.message));
  const time = new Date('2026-10-16T00:00:00Z');
  await page.clock.install({ time });
  await page.clock.pauseAt(new Date(time.getTime() + 1000));
  await page.addInitScript(() => {
    window.requestAnimationFrame = (cb) => setTimeout(() => cb(performance.now()), 100);
    window.cancelAnimationFrame = (id) => clearTimeout(id);
    // 전투를 반복하지 않고 기존 클리어 계정의 결과→상점→배치를 검사합니다.
    localStorage.setItem(
      'mallang-guard:v1',
      JSON.stringify({
        version: 1,
        settings: { quality: 'low', sfxVolume: 0, reducedMotion: true },
        stages: Object.fromEntries(
          Array.from({ length: 7 }, (_, i) => [`stage-${i + 1}`, { cleared: true, bestLife: 3 }]),
        ),
        collection: {
          money: 9000,
          pullsSinceNew: 7,
          rngState: 99,
          ownedUnits: ['squirrel', 'cat', 'bear', 'penguin', 'sheep', 'bunny', 'mole', 'snail'],
        },
      }),
    );
  });
  await page.goto('http://127.0.0.1:43195/');
  await page.locator('.title-screen').waitFor();
  const collection = await page.evaluate(
    () => JSON.parse(localStorage.getItem('mallang-guard:v1')).collection,
  );
  assert.equal(collection.ownedUnits.length, 14);
  assert.equal(collection.money, 9000);
  assert.equal(collection.pullsSinceNew, 7);
  assert.equal(collection.rngState, 99);
  assert(moduleUrl);
  await installCampaignAudit(page, moduleUrl);
  await page.getByRole('button', { name: '시작', exact: true }).click();
  await page.clock.runFor(60000);
  assert.equal(await page.locator('.battle-result').getAttribute('data-result'), 'lost');
  await verifyEarnedRarePurchases(page, false, prefix, 'existing-profile', { injectedMoney: true });
  assert.deepEqual(errors, []);
  assert.deepEqual(await page.evaluate(() => window.campaign.rejected), []);
  console.log(JSON.stringify({ fixtureMoney: 9000, existingProfile: true, allOwned: 14, errors }));
} finally {
  await browser.close();
}
