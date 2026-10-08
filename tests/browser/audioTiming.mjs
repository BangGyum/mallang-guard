import assert from 'node:assert/strict';
import { chromium } from 'playwright';
import { installAudioProbe } from './audioProbe.mjs';

const browser = await chromium.launch({ channel: 'msedge', headless: true });
try {
  const context = await browser.newContext();
  await context.grantPermissions(['local-network-access']);
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.addInitScript(installAudioProbe);
  await page.route('**/audio-timing', (route) =>
    route.fulfill({ contentType: 'text/html; charset=utf-8', body: '<button>소리 켜기</button>' }),
  );
  await page.goto('http://127.0.0.1:43195/audio-timing');
  await page.evaluate(async () => {
    const { createSfx } = await import('/src/audio/sfx.ts');
    const { impactDelays } = await import('/src/view/eventTiming.ts');
    window.sfx = createSfx(0.7);
    window.fire = () => {
      const src = { kind: 'unit', uid: 1 };
      const dst = { kind: 'enemy', uid: 2 };
      const events = [
        { type: 'attack', src, dst, damageType: 'physical', ranged: true },
        { type: 'damage', src, dst, amount: 100, damageType: 'physical' },
        { type: 'enemyDie', uid: 2 },
      ];
      window.sfx.onEvents(events, impactDelays(events));
    };
  });
  await page.getByRole('button').click();
  await page.waitForFunction(() => window.audioProbe.contexts[0]?.state === 'running');
  await page.evaluate(() => window.fire());
  const count = () => page.evaluate(() => window.audioProbe.sources);
  assert.equal(await count(), 1, '발사 직후에는 발사음만 재생하고 피격·사망음은 게임 시간을 기다림');
  await page.waitForTimeout(300);
  await page.evaluate(() => window.sfx.update(0));
  assert.equal(await count(), 1, '일시정지 동안 실제 시간이 흘러도 피격하지 않음');
  await page.evaluate(() => {
    window.sfx.update(0.1);
    window.sfx.stop();
    window.sfx.update(0);
    window.sfx.update(0.1 * 0.5);
  });
  assert.equal(await count(), 1, '메뉴를 닫고 느린 시간으로 재개해도 도착 전에는 재생하지 않음');
  await page.evaluate(() => window.sfx.update(0.05 * 2));
  assert.equal(await count(), 3, '배속 변경 뒤 투사체 도착 프레임에 피격·사망음을 함께 재생');
  await page.evaluate(() => {
    window.sfx.reset();
    window.fire();
    window.sfx.reset();
    window.sfx.update(1);
  });
  assert.equal(await count(), 4, '재시작하면 이전 전투의 예약 효과음이 남지 않음');
  await page.evaluate(() => {
    window.sfx.onEvents([{ type: 'battleEnd', result: 'won' }], new Map());
    window.sfx.update(0.25);
  });
  assert.equal(await count(), 4, '종료 연출 중 승리음 대기');
  await page.evaluate(() => window.sfx.update(0.25));
  assert.equal(await count(), 8, '선택 중 종료되어도 승리음은 같은 연출 시간으로 진행');
  await page.evaluate(() => window.sfx.dispose());
  await page.waitForFunction(() => window.audioProbe.contexts[0].state === 'closed');
  assert.deepEqual(errors, []);
  console.log(JSON.stringify({ paused: true, speedChanges: true, restart: true, ending: true, errors }));
} finally {
  await browser.close();
}
