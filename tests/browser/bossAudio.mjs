import assert from 'node:assert/strict';
import { writeFile } from 'node:fs/promises';
import { chromium } from 'playwright';
import { installAudioProbe } from './audioProbe.mjs';

const prefix = process.env.MALLANG_SCREENSHOT_PREFIX ?? 't4.23';
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
  await page.route('**/boss-audio-check', (route) =>
    route.fulfill({ contentType: 'text/html; charset=utf-8', body: '<button>소리 확인</button>' }),
  );
  await page.goto('http://127.0.0.1:43195/boss-audio-check');
  const rendered = await page.evaluate(async () => {
    const { createBossBuffers } = await import('/src/audio/bossSounds.ts');
    const { createCombatBuffers } = await import('/src/audio/combatSounds.ts');
    const { createSfxLimiter } = await import('/src/audio/sfx.ts');
    const rate = 48000;
    const offline = new OfflineAudioContext(1, rate * 14, rate);
    const limiter = createSfxLimiter(offline);
    const buffers = createBossBuffers(offline);
    const metrics = [];
    const peak = (values) => {
      let value = 0;
      for (const sample of values) value = Math.max(value, Math.abs(sample));
      return value;
    };
    for (const [index, [sound, buffer]] of [...buffers].entries()) {
      const samples = buffer.getChannelData(0);
      let energy = 0,
        jump = 0;
      for (let i = 0; i < samples.length; i++) {
        energy += samples[i] ** 2;
        if (i) jump = Math.max(jump, Math.abs(samples[i] - samples[i - 1]));
      }
      metrics.push({
        sound,
        seconds: buffer.duration,
        peak: peak(samples),
        rms: Math.sqrt(energy / samples.length),
        jump,
        first: samples[0],
        last: samples.at(-1),
        finite: samples.every(Number.isFinite),
      });
      const source = offline.createBufferSource();
      source.buffer = buffer;
      const gain = offline.createGain();
      gain.gain.value = 0.8;
      source.connect(gain).connect(limiter);
      source.start(index + 0.1);
    }
    const correlations = [];
    const casts = [...buffers].filter(([sound]) => sound.endsWith('-cast'));
    for (let i = 0; i < casts.length; i++)
      for (let j = i + 1; j < casts.length; j++) {
        const a = casts[i][1].getChannelData(0),
          b = casts[j][1].getChannelData(0);
        let dot = 0,
          aa = 0,
          bb = 0;
        for (let k = 0; k < Math.min(a.length, b.length); k++) {
          dot += a[k] * b[k];
          aa += a[k] ** 2;
          bb += b[k] ** 2;
        }
        correlations.push({ a: casts[i][0], b: casts[j][0], value: Math.abs(dot / Math.sqrt(aa * bb)) });
      }
    const mixedContext = new OfflineAudioContext(1, rate, rate);
    const mix = mixedContext.createBuffer(1, rate, rate);
    const samples = mix.getChannelData(0);
    for (const buffer of [
      ...createCombatBuffers(mixedContext).values(),
      ...createBossBuffers(mixedContext).values(),
    ]) {
      const data = buffer.getChannelData(0);
      for (let i = 0; i < data.length; i++) samples[i] += data[i] * 0.8;
    }
    const mixedSource = mixedContext.createBufferSource();
    mixedSource.buffer = mix;
    mixedSource.connect(createSfxLimiter(mixedContext));
    mixedSource.start();
    const rawMixedPeak = peak(samples);
    const mixed = await mixedContext.startRendering();
    const wave = await offline.startRendering();
    return {
      rate,
      metrics,
      correlations,
      rawMixedPeak,
      mixedPeak: peak(mixed.getChannelData(0)),
      samples: Array.from(wave.getChannelData(0)),
    };
  });
  assert.equal(rendered.metrics.length, 14);
  for (const m of rendered.metrics) {
    assert(m.finite && m.peak > 0.01 && m.peak < 0.65, `${m.sound}: 유효 신호와 헤드룸`);
    assert.equal(Math.abs(m.first), 0);
    assert(Math.abs(m.last) < 0.0001, `${m.sound}: 끝 클릭 없음`);
    assert(m.jump < 0.2, `${m.sound}: 급격한 클릭 없음`);
  }
  assert(
    rendered.correlations.every((pair) => pair.value < 0.9),
    '7종 발동음 파형이 서로 구분됨',
  );
  assert(rendered.mixedPeak < 0.95, '무기·보스 23종 동시 재생에 클리핑 없음');
  const wav = Buffer.alloc(44 + rendered.samples.length * 2);
  wav.write('RIFF', 0);
  wav.writeUInt32LE(wav.length - 8, 4);
  wav.write('WAVEfmt ', 8);
  wav.writeUInt32LE(16, 16);
  wav.writeUInt16LE(1, 20);
  wav.writeUInt16LE(1, 22);
  wav.writeUInt32LE(rendered.rate, 24);
  wav.writeUInt32LE(rendered.rate * 2, 28);
  wav.writeUInt16LE(2, 32);
  wav.writeUInt16LE(16, 34);
  wav.write('data', 36);
  wav.writeUInt32LE(wav.length - 44, 40);
  rendered.samples.forEach((value, i) => {
    wav.writeInt16LE(Math.round(Math.max(-1, Math.min(1, value)) * 32767), 44 + i * 2);
  });
  await writeFile(`docs/verification/${prefix}-boss-sounds.wav`, wav);
  await page.evaluate(async () => {
    const { createSfx } = await import('/src/audio/sfx.ts');
    window.bossSfx = createSfx(1);
    window.bossSfx.onEvents([{ type: 'bossSkill', uid: 1, enemyId: 'kingJelly', phase: 'cast' }], new Map());
  });
  assert.equal(
    await page.evaluate(() => window.audioProbe.contexts.length),
    0,
    '실제 입력 전에는 컨텍스트 없음',
  );
  await page.getByRole('button', { name: '소리 확인' }).click();
  await page.waitForFunction(() => window.audioProbe.contexts[0]?.state === 'running');
  const voices = await page.evaluate(() => {
    window.audioProbe.starts.length = 0;
    window.bossSfx.onEvents(
      [
        { type: 'bossSkill', uid: 100, enemyId: 'kingJelly', phase: 'windup' },
        { type: 'bossSkill', uid: 100, enemyId: 'kingJelly', phase: 'cast' },
        ...[1, 2, 3].map((uid) => ({ type: 'unitDisrupt', src: 100, uid, untilTick: 90 })),
      ],
      new Map(),
    );
    return window.audioProbe.starts;
  });
  assert.equal(voices.length, 2, '보스 다중 방해에 예고·발동 두 소리만 재생');
  assert(
    voices.every((voice) => Math.abs(voice.duration - 0.14) > 0.001),
    '기존 젖은 분사음 중복 없음',
  );
  const muted = await page.evaluate(() => {
    window.bossSfx.setVolume(0);
    const before = window.audioProbe.sources;
    window.bossSfx.onEvents(
      [{ type: 'bossSkill', uid: 10, enemyId: 'gardenKing', phase: 'cast' }],
      new Map(),
    );
    return { before, after: window.audioProbe.sources };
  });
  assert.equal(muted.before, muted.after);
  await page.evaluate(() => window.bossSfx.reset());
  await page.waitForFunction(() => window.audioProbe.active.size === 0);
  await page.evaluate(() => window.bossSfx.dispose());
  await page.waitForFunction(() => window.audioProbe.contexts[0]?.state === 'closed');
  assert.deepEqual(errors, []);
  const { samples, ...report } = rendered;
  await writeFile(
    `docs/verification/${prefix}-boss-audio.json`,
    `${JSON.stringify({ ...report, voices, muted, errors }, null, 2)}\n`,
  );
  console.log(
    JSON.stringify({
      sounds: report.metrics.length,
      mixedPeak: report.mixedPeak,
      maxCorrelation: Math.max(...report.correlations.map((p) => p.value)),
      voices: voices.length,
      errors,
    }),
  );
} finally {
  await browser.close();
}
