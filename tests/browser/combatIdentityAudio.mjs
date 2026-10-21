import assert from 'node:assert/strict';
import { writeFile } from 'node:fs/promises';
import { chromium } from 'playwright';
import { installAudioProbe } from './audioProbe.mjs';

const prefix = process.env.MALLANG_SCREENSHOT_PREFIX ?? 't4.38';
const browser = await chromium.launch({ channel: 'msedge', headless: true });
try {
  const page = await browser.newPage();
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.addInitScript(installAudioProbe);
  await page.route('**/combat-identity', (route) =>
    route.fulfill({ contentType: 'text/html', body: '<button>Audio</button>' }),
  );
  await page.goto('http://127.0.0.1:43195/combat-identity');
  const result = await page.evaluate(async () => {
    const { content } = await import('/src/data/index.ts');
    const { createCombatBuffers, unitAttackSound } = await import('/src/audio/combatSounds.ts');
    const { createImpactBuffers, weaponImpactSound } = await import('/src/audio/impactSounds.ts');
    const { createSfx, createSfxLimiter } = await import('/src/audio/sfx.ts');
    window.identitySfx = createSfx(0.7);
    const rate = 48000,
      offline = new OfflineAudioContext(1, rate * 14, rate);
    const limiter = createSfxLimiter(offline);
    const combat = createCombatBuffers(offline),
      impacts = createImpactBuffers(offline);
    const rows = [],
      arrays = [];
    const metrics = (buffer) => {
      const a = buffer.getChannelData(0);
      return {
        sec: buffer.duration,
        peak: a.reduce((p, x) => Math.max(p, Math.abs(x)), 0),
        rms: Math.sqrt(a.reduce((sum, x) => sum + x * x, 0) / a.length),
        finite: a.every(Number.isFinite),
        first: a[0],
        last: a.at(-1),
      };
    };
    for (const [index, unit] of [...content.units.values()].entries()) {
      const sound = unitAttackSound(unit.art),
        impact = weaponImpactSound(sound);
      const attackBuffer = combat.get(sound),
        hitBuffer = impacts.get(impact);
      arrays.push(attackBuffer.getChannelData(0));
      rows.push({
        id: unit.id,
        name: unit.name,
        sound,
        impact,
        attack: metrics(attackBuffer),
        hit: metrics(hitBuffer),
      });
      for (const [buffer, delay] of [
        [attackBuffer, 0],
        [hitBuffer, 0.25],
      ]) {
        const source = offline.createBufferSource(),
          gain = offline.createGain();
        source.buffer = buffer;
        gain.gain.value = 0.56;
        source.connect(gain).connect(limiter);
        source.start(index + 0.05 + delay);
      }
    }
    let correlation = 0;
    for (let i = 0; i < arrays.length; i++)
      for (let j = i + 1; j < arrays.length; j++) {
        let dot = 0,
          aa = 0,
          bb = 0;
        for (let k = 0; k < Math.min(arrays[i].length, arrays[j].length); k++) {
          const a = arrays[i][k],
            b = arrays[j][k];
          dot += a * b;
          aa += a * a;
          bb += b * b;
        }
        correlation = Math.max(correlation, Math.abs(dot / Math.sqrt(aa * bb)));
      }
    const rendered = await offline.startRendering();
    return { rate, rows, correlation, samples: Array.from(rendered.getChannelData(0)) };
  });
  assert.equal(result.rows.length, 14);
  assert.equal(new Set(result.rows.map((row) => row.sound)).size, 14);
  assert(result.correlation < 0.9);
  for (const row of result.rows)
    for (const metric of [row.attack, row.hit]) {
      assert(metric.finite && metric.peak > 0.003 && metric.peak < 0.6, JSON.stringify(row));
      assert.equal(Math.abs(metric.first), 0);
      assert(Math.abs(metric.last) < 0.0001);
    }
  await page.getByRole('button').click();
  await page.waitForFunction(() => window.audioProbe.contexts[0]?.state === 'running');
  const routing = await page.evaluate(async () => {
    const { content } = await import('/src/data/index.ts');
    const { unitAttackSound } = await import('/src/audio/combatSounds.ts');
    const { impactDelays } = await import('/src/view/eventTiming.ts');
    const sfx = window.identitySfx,
      probe = window.audioProbe,
      results = [];
    for (const unit of content.units.values()) {
      sfx.reset();
      probe.starts.length = 0;
      const src = { kind: 'unit', uid: 1 },
        dst = { kind: 'enemy', uid: 2 };
      const attack = { type: 'attack', src, dst, ranged: true, damageType: unit.damageType };
      const damage = { type: 'damage', src, dst, amount: 100, damageType: unit.damageType };
      const events = [attack, damage, attack, damage, damage];
      sfx.onEvents(events, impactDelays(events), () => unitAttackSound(unit.art));
      const start = [...probe.starts];
      sfx.update(0.24);
      const before = probe.starts.length;
      sfx.update(0.011);
      results.push({ id: unit.id, start, before, arrived: [...probe.starts] });
    }
    sfx.reset();
    probe.starts.length = 0;
    const units = [...content.units.values()];
    sfx.onEvents(
      units.map((unit, uid) => ({
        type: 'damage',
        src: { kind: 'unit', uid },
        dst: { kind: 'enemy', uid: 100 },
        amount: 1,
        damageType: unit.damageType,
      })),
      new Map(),
      (uid) => unitAttackSound(units[uid].art),
    );
    return { results, simultaneousHits: probe.starts.length };
  });
  for (const row of routing.results) {
    const expected = result.rows.find((unit) => unit.id === row.id);
    assert.equal(row.start.length, 1);
    assert.equal(row.before, 1);
    assert.equal(row.arrived.length, 2, `${row.id} 한 번의 사격·한 번의 지연 명중`);
    assert(Math.abs(row.arrived[1].duration - expected.hit.sec) < 0.0001);
  }
  assert.equal(routing.simultaneousHits, 3);
  await page.evaluate(() => window.identitySfx.dispose());
  await page.waitForFunction(() => window.audioProbe.contexts.every((context) => context.state === 'closed'));
  assert.deepEqual(errors, []);
  const wav = Buffer.alloc(44 + result.samples.length * 2);
  wav.write('RIFF', 0);
  wav.writeUInt32LE(wav.length - 8, 4);
  wav.write('WAVEfmt ', 8);
  wav.writeUInt32LE(16, 16);
  wav.writeUInt16LE(1, 20);
  wav.writeUInt16LE(1, 22);
  wav.writeUInt32LE(result.rate, 24);
  wav.writeUInt32LE(result.rate * 2, 28);
  wav.writeUInt16LE(2, 32);
  wav.writeUInt16LE(16, 34);
  wav.write('data', 36);
  wav.writeUInt32LE(wav.length - 44, 40);
  result.samples.forEach((s, i) => {
    wav.writeInt16LE(Math.round(Math.max(-1, Math.min(1, s)) * 32767), 44 + i * 2);
  });
  await writeFile(`docs/verification/${prefix}-weapon-sounds.wav`, wav);
  const { samples, ...metrics } = result;
  const report = { ...metrics, routing, errors };
  await writeFile(`docs/verification/${prefix}-combat-audio.json`, JSON.stringify(report, null, 2));
  console.log(
    JSON.stringify({
      units: 14,
      correlation: result.correlation,
      simultaneousHits: routing.simultaneousHits,
      errors,
    }),
  );
} finally {
  await browser.close();
}
