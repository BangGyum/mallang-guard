export const COMBAT_SOUNDS = [
  'shoot',
  'sniper',
  'pistol',
  'slash',
  'hammer',
  'magic',
  'fire',
  'launcher',
  'goo',
  'railgun',
  'mortar',
  'lightning',
] as const;
export type AttackSound = (typeof COMBAT_SOUNDS)[number];

const UNIT_SOUNDS: Readonly<Record<string, AttackSound>> = {
  squirrel: 'pistol',
  cat: 'slash',
  bear: 'hammer',
  penguin: 'sniper',
  sheep: 'magic',
  bunny: 'shoot',
  mole: 'pistol',
  snail: 'launcher',
  owl: 'fire',
  wolf: 'sniper',
  fox: 'railgun',
  redPanda: 'mortar',
  deer: 'lightning',
};

export function unitAttackSound(art: string): AttackSound | undefined {
  return UNIT_SOUNDS[art];
}

const GUNS = {
  shoot: { sec: 0.16, crack: 0.006, body: 0.032, tail: 0.055, pitch: 155, bolt: 0.055 },
  sniper: { sec: 0.26, crack: 0.009, body: 0.05, tail: 0.09, pitch: 105, bolt: 0.12 },
  pistol: { sec: 0.12, crack: 0.004, body: 0.023, tail: 0.035, pitch: 185, bolt: 0.04 },
} as const;

const DURATIONS: Readonly<Record<AttackSound, number>> = {
  shoot: GUNS.shoot.sec,
  sniper: GUNS.sniper.sec,
  pistol: GUNS.pistol.sec,
  slash: 0.12,
  hammer: 0.24,
  magic: 0.2,
  fire: 0.28,
  launcher: 0.22,
  goo: 0.14,
  railgun: 0.32,
  mortar: 0.3,
  lightning: 0.16,
};

export function createCombatBuffers(context: BaseAudioContext): ReadonlyMap<AttackSound, AudioBuffer> {
  const buffers = new Map<AttackSound, AudioBuffer>();
  for (const [index, sound] of COMBAT_SOUNDS.entries()) {
    const sec = DURATIONS[sound];
    const buffer = context.createBuffer(1, Math.ceil(context.sampleRate * sec), context.sampleRate);
    const samples = buffer.getChannelData(0);
    const gun = sound === 'shoot' || sound === 'sniper' || sound === 'pistol' ? GUNS[sound] : undefined;
    let seed = 0x6d2b79f5 + index;
    let low = 0;
    let mid = 0;
    let phase = 0;
    const lowStep = 1 - Math.exp((-2 * Math.PI * 420) / context.sampleRate);
    const midStep = 1 - Math.exp((-2 * Math.PI * 2600) / context.sampleRate);
    const slashStep = 1 - Math.exp((-2 * Math.PI * 1050) / context.sampleRate);
    let blade = 0;
    // 한 번 합성한 버퍼를 재사용해 사격마다 필터·오실레이터를 만들지 않습니다.
    for (let i = 0; i < samples.length; i++) {
      seed ^= seed << 13;
      seed ^= seed >>> 17;
      seed ^= seed << 5;
      const white = (seed >>> 0) / 0x80000000 - 1;
      low += lowStep * (white - low);
      mid += midStep * (white - mid);
      const t = i / context.sampleRate;
      let sample = 0;
      if (gun) {
        phase += (2 * Math.PI * (55 + gun.pitch * Math.exp(-t / 0.025))) / context.sampleRate;
        const boltTime = t - gun.bolt;
        sample =
          0.25 * (white - mid) * Math.exp(-t / gun.crack) +
          0.6 * low * Math.exp(-t / gun.body) +
          0.23 * Math.sin(phase) * Math.exp(-t / gun.body) +
          0.09 * mid * Math.exp(-t / gun.tail);
        if (boltTime >= 0) sample += 0.045 * (white - low) * Math.exp(-boltTime / 0.008);
      } else if (sound === 'railgun') {
        phase += (2 * Math.PI * (65 + 240 * Math.exp(-t / 0.022))) / context.sampleRate;
        sample =
          (0.3 * Math.sin(phase) + 0.35 * low) * Math.exp(-t / 0.055) +
          0.1 * (white - mid) * Math.exp(-t / 0.005) +
          0.045 * mid * Math.exp(-t / 0.09);
      } else if (sound === 'mortar') {
        phase += (2 * Math.PI * (60 + 160 * Math.exp(-t / 0.018))) / context.sampleRate;
        sample =
          (0.38 * Math.sin(phase) + 0.45 * low) * Math.exp(-t / 0.06) +
          0.07 * (mid - low) * Math.exp(-t / 0.02);
      } else if (sound === 'lightning') {
        phase += (2 * Math.PI * (430 + 250 * Math.exp(-t / 0.035))) / context.sampleRate;
        sample =
          (0.12 * Math.sin(phase) + 0.2 * (mid - low) + 0.06 * low) *
          (1 - Math.exp(-t / 0.002)) *
          Math.exp(-t / 0.035);
      } else if (sound === 'slash') {
        blade += slashStep * (white - blade);
        sample = 0.16 * (blade - low) * Math.sin((Math.PI * t) / sec) ** 2;
      } else if (sound === 'hammer') {
        sample =
          (0.28 * Math.sin(2 * Math.PI * 82 * t) + 0.38 * low) * Math.exp(-t / 0.042) +
          0.04 * Math.sin(2 * Math.PI * 710 * t) * Math.exp(-t / 0.065);
      } else if (sound === 'fire') {
        const swell = (1 - Math.exp(-t / 0.007)) * Math.exp(-t / 0.068);
        sample =
          (0.5 * low + 0.3 * (mid - low)) * swell +
          0.1 * (white - mid) * Math.max(0, Math.sin(2 * Math.PI * 137 * t)) ** 12 * swell +
          0.08 * Math.sin(2 * Math.PI * 72 * t) * Math.exp(-t / 0.045);
      } else if (sound === 'magic') {
        phase += (2 * Math.PI * (280 + 820 * Math.exp(-t / 0.04))) / context.sampleRate;
        sample =
          (0.14 * Math.sin(phase + 1.5 * Math.sin(2 * Math.PI * 70 * t)) + 0.18 * mid) * Math.exp(-t / 0.043);
      } else {
        phase += (2 * Math.PI * (75 + 180 * Math.exp(-t / 0.025))) / context.sampleRate;
        sample = (0.2 * Math.sin(phase) + 0.4 * low) * Math.exp(-t / 0.035);
        if (sound === 'goo') sample *= 0.55;
      }
      const attack = Math.min(1, t / (sound === 'slash' ? 0.008 : 0.0004));
      const release = Math.min(1, (sec - t) / 0.025);
      samples[i] = sample * attack * release;
    }
    buffers.set(sound, buffer);
  }
  return buffers;
}
