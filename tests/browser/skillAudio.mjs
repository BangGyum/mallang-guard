import assert from 'node:assert/strict';
import { writeFile } from 'node:fs/promises';
import { chromium } from 'playwright';
import { installAudioProbe } from './audioProbe.mjs';

const prefix = process.env.MALLANG_SCREENSHOT_PREFIX ?? 't4.27';
const browser = await chromium.launch({ channel: 'msedge', headless: true });
try {
  const page = await browser.newPage();
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.addInitScript(installAudioProbe);
  await page.route('**/skill-audio-check', (route) =>
    route.fulfill({
      contentType: 'text/html; charset=utf-8',
      body: '<button>스킬 소리 확인</button>',
    }),
  );
  await page.goto('http://127.0.0.1:43195/skill-audio-check');
  const rendered = await page.evaluate(async () => {
    const { createSkillBuffers } = await import('/src/audio/skillSounds.ts');
    const { createImpactBuffers } = await import('/src/audio/impactSounds.ts');
    const { createCombatBuffers } = await import('/src/audio/combatSounds.ts');
    const { createBossBuffers } = await import('/src/audio/bossSounds.ts');
    const { createRecruitBuffers } = await import('/src/audio/recruitSounds.ts');
    const { createSfxLimiter } = await import('/src/audio/sfx.ts');
    const rate = 48000;
    const offline = new OfflineAudioContext(1, rate * 17, rate);
    const limiter = createSfxLimiter(offline);
    const buffers = createSkillBuffers(offline);
    const metrics = [];
    const peak = (samples) => samples.reduce((max, sample) => Math.max(max, Math.abs(sample)), 0);
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
      const source = offline.createBufferSource(),
        gain = offline.createGain();
      source.buffer = buffer;
      gain.gain.value = 0.7 * 0.8;
      source.connect(gain).connect(limiter);
      source.start(index + 0.1);
    }
    const correlations = [];
    const values = [...buffers.values()];
    for (let i = 0; i < values.length; i++)
      for (let j = i + 1; j < values.length; j++) {
        const a = values[i].getChannelData(0),
          b = values[j].getChannelData(0);
        let dot = 0,
          aa = 0,
          bb = 0;
        for (let k = 0; k < Math.min(a.length, b.length); k++) {
          dot += a[k] * b[k];
          aa += a[k] ** 2;
          bb += b[k] ** 2;
        }
        correlations.push({
          a: metrics[i].sound,
          b: metrics[j].sound,
          value: Math.abs(dot / Math.sqrt(aa * bb)),
        });
      }
    const mixedContext = new OfflineAudioContext(1, rate, rate);
    const mixedLimiter = createSfxLimiter(mixedContext);
    const all = [
      ...createSkillBuffers(mixedContext).values(),
      ...createCombatBuffers(mixedContext).values(),
      ...createImpactBuffers(mixedContext).values(),
      ...createBossBuffers(mixedContext).values(),
      ...createRecruitBuffers(mixedContext).values(),
    ];
    for (const buffer of all) {
      const source = mixedContext.createBufferSource(),
        gain = mixedContext.createGain();
      source.buffer = buffer;
      gain.gain.value = 0.8;
      source.connect(gain).connect(mixedLimiter);
      source.start();
    }
    const mixed = await mixedContext.startRendering(),
      wave = await offline.startRendering();
    return {
      rate,
      metrics,
      maxCorrelation: Math.max(...correlations.map((pair) => pair.value)),
      closestPair: correlations.sort((a, b) => b.value - a.value)[0],
      mixedCount: all.length,
      mixedPeak: peak(mixed.getChannelData(0)),
      samples: Array.from(wave.getChannelData(0)),
    };
  });
  assert.equal(rendered.metrics.length, 16);
  for (const sound of rendered.metrics) {
    assert(sound.finite && sound.peak > 0.005 && sound.peak < 0.6, JSON.stringify(sound));
    assert.equal(Math.abs(sound.first), 0);
    assert(Math.abs(sound.last) < 0.0001 && sound.jump < 0.15, `${sound.sound} 클릭·급격한 변화`);
  }
  assert(
    rendered.maxCorrelation < 0.9,
    `스킬 음원은 서로 다른 파형: ${JSON.stringify(rendered.closestPair)}`,
  );
  assert.equal(rendered.mixedCount, 60);
  assert(rendered.mixedPeak < 0.95, '무기·보스·스킬·모집 동시 혼합에서 클리핑 없음');
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
  rendered.samples.forEach((sample, i) => {
    wav.writeInt16LE(Math.round(Math.max(-1, Math.min(1, sample)) * 32767), 44 + i * 2);
  });
  await writeFile(`docs/verification/${prefix}-skill-sounds.wav`, wav);
  await page.evaluate(async () => {
    const { createSfx } = await import('/src/audio/sfx.ts');
    window.skillSfx = createSfx(0.7);
  });
  await page.getByRole('button').click();
  await page.waitForFunction(() => window.audioProbe.contexts[0]?.state === 'running');
  const routing = await page.evaluate(async () => {
    const { content } = await import('/src/data/index.ts');
    const report = [];
    for (const skill of content.skills.values()) {
      window.skillSfx.reset();
      window.audioProbe.starts.length = 0;
      const start = { type: 'skillStart', uid: 1, skillId: skill.id };
      const events = [start, start];
      if (skill.id === 'stardustShower') events.push({ type: 'skillPulse', uid: 1 });
      window.skillSfx.onEvents(events, new Map());
      report.push({ skill: skill.id, voices: [...window.audioProbe.starts] });
    }
    return report;
  });
  for (const row of routing) {
    assert.equal(row.voices.length, 1, `${row.skill} 중복 발동·첫 펄스 겹침 방지`);
    const metric = rendered.metrics.find((m) => m.sound === `skill-${row.skill}`);
    assert(Math.abs(row.voices[0].duration - metric.seconds) < 0.0001);
  }
  const pulse = await page.evaluate(() => {
    window.skillSfx.reset();
    window.audioProbe.starts.length = 0;
    window.skillSfx.onEvents([{ type: 'skillPulse', uid: 1 }], new Map());
    return [...window.audioProbe.starts];
  });
  assert.equal(pulse.length, 1);
  assert(Math.abs(pulse[0].duration - 0.2) < 0.0001);
  const gravity = await page.evaluate(() => {
    window.skillSfx.reset();
    window.audioProbe.starts.length = 0;
    window.skillSfx.onEvents(
      [{ type: 'gravityField', uid: 1, phase: 'burst', x: 1, y: 1, radius: 1.8 }],
      new Map(),
    );
    return [...window.audioProbe.starts];
  });
  assert.equal(gravity.length, 1);
  assert(Math.abs(gravity[0].duration - 0.5) < 0.0001);
  const recruitment = await page.evaluate(() =>
    ['recruitSR', 'recruitSSR', 'recruitUR'].map((sound) => {
      window.skillSfx.reset();
      window.audioProbe.starts.length = 0;
      window.skillSfx.play(sound);
      return { sound, voices: [...window.audioProbe.starts] };
    }),
  );
  for (const [index, result] of recruitment.entries()) {
    assert.equal(result.voices.length, 1);
    assert(Math.abs(result.voices[0].duration - (0.34 + index * 0.15)) < 0.0001);
  }
  await page.evaluate(() => {
    window.skillSfx.reset();
    window.skillSfx.setVolume(0);
    window.audioProbe.starts.length = 0;
    window.skillSfx.onEvents([{ type: 'skillStart', uid: 1, skillId: 'wideBarrage' }], new Map());
  });
  assert.equal(await page.evaluate(() => window.audioProbe.starts.length), 0);
  await page.waitForFunction(() => window.audioProbe.active.size === 0);
  await page.evaluate(() => window.skillSfx.dispose());
  await page.waitForFunction(() => window.audioProbe.contexts[0].state === 'closed');
  assert.deepEqual(errors, []);
  const { samples, ...metrics } = rendered;
  const report = {
    ...metrics,
    routing,
    gravity,
    recruitment,
    mute: true,
    reset: true,
    dispose: true,
    errors,
  };
  await writeFile(`docs/verification/${prefix}-skill-audio.json`, `${JSON.stringify(report, null, 2)}\n`);
  console.log(
    JSON.stringify({
      skills: routing.length,
      buffers: metrics.metrics.length,
      mixedCount: metrics.mixedCount,
      mixedPeak: metrics.mixedPeak,
      maxCorrelation: metrics.maxCorrelation,
      errors,
    }),
  );
} finally {
  await browser.close();
}
