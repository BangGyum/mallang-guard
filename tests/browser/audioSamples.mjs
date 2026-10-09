import assert from 'node:assert/strict';
import { writeFile } from 'node:fs/promises';
import { chromium } from 'playwright';

const prefix = process.env.MALLANG_SCREENSHOT_PREFIX ?? 't4.12';
const browser = await chromium.launch({ channel: 'msedge', headless: true });
try {
  const context = await browser.newContext();
  await context.grantPermissions(['local-network-access']);
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto('http://127.0.0.1:43195/');
  const rendered = await page.evaluate(async () => {
    const { COMBAT_SOUNDS, createCombatBuffers } = await import('/src/audio/combatSounds.ts');
    const { createSfxLimiter } = await import('/src/audio/sfx.ts');
    const sampleRate = 48000;
    const offline = new OfflineAudioContext(1, sampleRate * COMBAT_SOUNDS.length, sampleRate);
    const limiter = createSfxLimiter(offline);
    const buffers = createCombatBuffers(offline);
    const metrics = [];
    for (const [index, sound] of COMBAT_SOUNDS.entries()) {
      const buffer = buffers.get(sound);
      const samples = buffer.getChannelData(0);
      const energy = (start, end) => {
        let sum = 0;
        const from = Math.floor(start * sampleRate),
          to = Math.floor(end * sampleRate);
        for (let i = from; i < to; i++) sum += (samples[i] ?? 0) ** 2;
        return Math.sqrt(sum / (to - from));
      };
      let peak = 0,
        low = 0,
        lowEnergy = 0;
      const step = 1 - Math.exp((-2 * Math.PI * 350) / sampleRate);
      for (const value of samples) {
        peak = Math.max(peak, Math.abs(value));
        low += step * (value - low);
        lowEnergy += low * low;
      }
      metrics.push({
        sound,
        seconds: buffer.duration,
        finite: samples.every(Number.isFinite),
        peak,
        bodyRms: Math.sqrt(lowEnergy / samples.length),
        earlyRms: energy(0, 0.04),
        lateRms: energy(buffer.duration - 0.025, buffer.duration),
        first: samples[0],
        last: samples.at(-1),
      });
      const source = offline.createBufferSource();
      const gain = offline.createGain();
      source.buffer = buffer;
      gain.gain.value = 0.7 * 0.8;
      source.connect(gain).connect(limiter);
      source.start(index + 0.1);
    }
    const mix = new Float32Array(sampleRate * 0.3);
    for (const sound of [
      'shoot',
      'slash',
      'hammer',
      'sniper',
      'magic',
      'shoot',
      'shotgun',
      'launcher',
      'energy',
      'sniper',
    ]) {
      buffers
        .get(sound)
        .getChannelData(0)
        .forEach((value, i) => {
          mix[i] += value * 0.8;
        });
    }
    const rawMixedPeak = Math.max(...mix.map(Math.abs));
    const mixedContext = new OfflineAudioContext(1, sampleRate, sampleRate);
    const mixedBuffer = mixedContext.createBuffer(1, mix.length, sampleRate);
    mixedBuffer.copyToChannel(mix, 0);
    const mixedSource = mixedContext.createBufferSource();
    mixedSource.buffer = mixedBuffer;
    mixedSource.connect(createSfxLimiter(mixedContext));
    mixedSource.start();
    const mixedResult = await mixedContext.startRendering();
    const mixedPeak = Math.max(...mixedResult.getChannelData(0).map(Math.abs));
    const buffer = await offline.startRendering();
    return { sampleRate, metrics, rawMixedPeak, mixedPeak, samples: Array.from(buffer.getChannelData(0)) };
  });
  for (const metric of rendered.metrics) {
    assert(
      metric.finite && metric.peak > 0.025 && metric.peak < 0.9,
      `${metric.sound}: 유효한 신호와 헤드룸`,
    );
    assert.equal(Math.abs(metric.first), 0);
    assert(Math.abs(metric.last) < 0.0001, `${metric.sound}: 끝에서 클릭이 없음`);
    if (['shoot', 'sniper', 'shotgun'].includes(metric.sound)) {
      assert(metric.bodyRms > 0.02, `${metric.sound}: 짧은 잡음에 그치지 않는 저음 몸통`);
      assert(metric.earlyRms > metric.lateRms * 5, `${metric.sound}: 총성의 파열과 감쇠`);
    }
  }
  assert(rendered.mixedPeak < 0.95, '10종이 같은 순간에 쏴도 최대 볼륨에서 클리핑하지 않음');
  const wav = Buffer.alloc(44 + rendered.samples.length * 2);
  wav.write('RIFF', 0);
  wav.writeUInt32LE(wav.length - 8, 4);
  wav.write('WAVEfmt ', 8);
  wav.writeUInt32LE(16, 16);
  wav.writeUInt16LE(1, 20);
  wav.writeUInt16LE(1, 22);
  wav.writeUInt32LE(rendered.sampleRate, 24);
  wav.writeUInt32LE(rendered.sampleRate * 2, 28);
  wav.writeUInt16LE(2, 32);
  wav.writeUInt16LE(16, 34);
  wav.write('data', 36);
  wav.writeUInt32LE(wav.length - 44, 40);
  rendered.samples.forEach((value, i) => {
    wav.writeInt16LE(Math.round(Math.max(-1, Math.min(1, value)) * 32767), 44 + i * 2);
  });
  assert.deepEqual(errors, []);
  await writeFile(`docs/verification/${prefix}-weapon-sounds.wav`, wav);
  const report = {
    order: rendered.metrics.map((metric) => metric.sound),
    sampleRate: rendered.sampleRate,
    mixedPeak: rendered.mixedPeak,
    rawMixedPeak: rendered.rawMixedPeak,
    metrics: rendered.metrics,
    errors,
  };
  await writeFile(`docs/verification/${prefix}-audio-samples.json`, `${JSON.stringify(report, null, 2)}\n`);
  console.log(JSON.stringify(report));
} finally {
  await browser.close();
}
