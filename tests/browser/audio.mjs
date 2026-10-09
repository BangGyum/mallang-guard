import assert from 'node:assert/strict';
import { writeFile } from 'node:fs/promises';
import { chromium } from 'playwright';
import { installAudioProbe } from './audioProbe.mjs';

const prefix = process.env.MALLANG_SCREENSHOT_PREFIX ?? 't4.12';
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
    for (const sound of [
      'deploy',
      'hit',
      'shoot',
      'sniper',
      'shotgun',
      'slash',
      'hammer',
      'magic',
      'energy',
      'launcher',
      'goo',
      'pop',
      'skill',
      'leak',
      'win',
      'lose',
    ])
      window.sfx.play(sound);
    return window.audioProbe.sources;
  });
  assert.equal(all - muted, 24, '16종 효과음의 버퍼·오실레이터 생성');
  const voices = await page.evaluate(() => window.audioProbe.starts);
  assert.equal(voices.length, 10, '전투 소리 9종과 작은 피격음');
  assert(voices.every((voice) => voice.rate >= 0.98 && voice.rate <= 1.02));
  const volleys = await page.evaluate(() => {
    window.sfx.reset();
    window.audioProbe.starts.length = 0;
    const src = { kind: 'unit', uid: 1 };
    const attacks = [2, 3, 4].map((uid) => ({
      type: 'attack',
      src,
      dst: { kind: 'enemy', uid },
      damageType: 'physical',
      ranged: true,
    }));
    window.sfx.onEvents(attacks, new Map(), () => 'sniper');
    const volley = [...window.audioProbe.starts];
    window.sfx.reset();
    window.audioProbe.starts.length = 0;
    window.sfx.onEvents([{ ...attacks[0], ranged: false }], new Map(), () => 'slash');
    const sword = [...window.audioProbe.starts];
    window.sfx.reset();
    window.audioProbe.starts.length = 0;
    window.sfx.onEvents(
      [1, 2, 3].map((uid) => ({
        type: 'unitDisrupt',
        src: 10,
        uid,
        untilTick: 30,
      })),
      new Map(),
    );
    return { volley, sword, spit: window.audioProbe.starts };
  });
  assert.equal(volleys.volley.length, 1, '삼중 사격은 같은 유닛의 총성을 중복 증폭하지 않음');
  assert(Math.abs(volleys.volley[0].duration - 0.26) < 0.0001);
  assert.equal(volleys.sword.length, 1, '근거리 이벤트도 무장에 맞게 재생');
  assert(Math.abs(volleys.sword[0].duration - 0.18) < 0.0001);
  assert.equal(volleys.spit.length, 1, '적의 여러 대상 방해는 한 번의 침 뱉는 소리');
  assert(Math.abs(volleys.spit[0].duration - 0.14) < 0.0001);
  await page.evaluate(() => window.sfx.dispose());
  await page.waitForFunction(() => window.audioProbe.contexts[0].state === 'closed');
  await page.getByRole('button', { name: '소리 켜기' }).click();
  assert.equal(await page.evaluate(() => window.audioProbe.contexts.length), 1, '종료 후 입력 리스너 제거');
  assert.deepEqual(errors, []);
  const report = { burst, sounds: 16, volleys, muted: true, contextClosed: true, errors };
  await writeFile(`docs/verification/${prefix}-audio.json`, `${JSON.stringify(report, null, 2)}\n`);
  console.log(JSON.stringify(report));
} finally {
  await browser.close();
}
