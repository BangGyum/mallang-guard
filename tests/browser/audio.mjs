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
  page.on('console', (message) => {
    if (['error', 'warning'].includes(message.type())) errors.push(message.text());
  });
  await page.addInitScript(installAudioProbe);
  await page.route('**/audio-check', (route) =>
    route.fulfill({ contentType: 'text/html; charset=utf-8', body: '<button>소리 켜기</button>' }),
  );
  await page.goto('http://127.0.0.1:43195/audio-check');
  await page.evaluate(async () => {
    const { createSfx } = await import('/src/audio/sfx.ts');
    window.sfx = createSfx(0.7);
    window.sfx.play('deploy');
    document.dispatchEvent(new PointerEvent('pointerdown'));
  });
  assert.equal(
    await page.evaluate(() => window.audioProbe.contexts.length),
    0,
    '실제 입력 이전에는 오디오를 만들지 않음',
  );
  await page.getByRole('button', { name: '소리 켜기' }).click();
  await page.waitForFunction(() => window.audioProbe.contexts[0]?.state === 'running');
  const burst = await page.evaluate(() => {
    for (let i = 0; i < 100; i++) window.sfx.play('deploy');
    return window.audioProbe.sources;
  });
  assert.equal(burst, 3, '50ms 내 같은 소리 최대 3개');
  const muted = await page.evaluate(() => {
    window.sfx.setVolume(0);
    window.sfx.play('magic');
    return window.audioProbe.sources;
  });
  assert.equal(muted, burst);
  const all = await page.evaluate(() => {
    window.sfx.reset();
    window.sfx.setVolume(0.35);
    for (const sound of ['deploy', 'hit', 'shoot', 'magic', 'pop', 'skill', 'leak', 'win', 'lose'])
      window.sfx.play(sound);
    return window.audioProbe.sources;
  });
  assert.equal(all - muted, 18, '9종 효과음의 오실레이터·노이즈 생성');
  await page.evaluate(() => window.sfx.dispose());
  await page.waitForFunction(() => window.audioProbe.contexts[0].state === 'closed');
  await page.getByRole('button', { name: '소리 켜기' }).click();
  assert.equal(await page.evaluate(() => window.audioProbe.contexts.length), 1, '종료 후 입력 리스너 제거');
  assert.deepEqual(errors, []);
  console.log(JSON.stringify({ burst, sounds: 9, contextClosed: true, errors }));
} finally {
  await browser.close();
}
