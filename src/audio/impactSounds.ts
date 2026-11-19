import type { AttackSound } from './combatSounds';

// 발사음보다 작은 도착음. 무기 계열별 질감만 남기고 중첩 제한은 공통으로 적용합니다.
const IMPACTS = {
  kinetic: { sec: 0.07, hz: 410, decay: 0.013, tone: 0.032, noise: 0.18, cutoff: 2000 },
  blade: { sec: 0.09, hz: 1080, decay: 0.018, tone: 0.054, noise: 0.09, cutoff: 1300 },
  blunt: { sec: 0.16, hz: 86, decay: 0.044, tone: 0.1, noise: 0.18, cutoff: 650 },
  ice: { sec: 0.13, hz: 1640, decay: 0.033, tone: 0.05, noise: 0.13, cutoff: 2200 },
  arc: { sec: 0.11, hz: 630, decay: 0.026, tone: 0.06, noise: 0.08, cutoff: 1800 },
  goo: { sec: 0.15, hz: 220, decay: 0.041, tone: 0.08, noise: 0.12, cutoff: 700 },
  fire: { sec: 0.21, hz: 83, decay: 0.055, tone: 0.02, noise: 0.26, cutoff: 1750 },
  rail: { sec: 0.14, hz: 1030, decay: 0.032, tone: 0.065, noise: 0.12, cutoff: 1900 },
  blast: { sec: 0.26, hz: 77, decay: 0.068, tone: 0.12, noise: 0.26, cutoff: 750 },
  gravity: { sec: 0.3, hz: 126, decay: 0.082, tone: 0.1, noise: 0.08, cutoff: 450 },
} as const;
type ImpactKind = keyof typeof IMPACTS;
export type ImpactSound = `impact-${ImpactKind}`;
const WEAPON_IMPACTS: Readonly<Record<AttackSound, ImpactKind>> = {
  shoot: 'kinetic',
  sniper: 'kinetic',
  pistol: 'kinetic',
  compactPistol: 'kinetic',
  slash: 'blade',
  hammer: 'blunt',
  frostShot: 'ice',
  magic: 'arc',
  energyShot: 'arc',
  launcher: 'goo',
  goo: 'goo',
  fire: 'fire',
  emberJet: 'fire',
  railgun: 'rail',
  mortar: 'blast',
  lightning: 'arc',
  gravity: 'gravity',
};

export function weaponImpactSound(sound: AttackSound | undefined): ImpactSound | 'hit' {
  return sound ? `impact-${WEAPON_IMPACTS[sound]}` : 'hit';
}

export function createImpactBuffers(context: BaseAudioContext): ReadonlyMap<ImpactSound, AudioBuffer> {
  const buffers = new Map<ImpactSound, AudioBuffer>();
  for (const [index, [kind, spec]] of Object.entries(IMPACTS).entries()) {
    const buffer = context.createBuffer(1, Math.ceil(spec.sec * context.sampleRate), context.sampleRate);
    const samples = buffer.getChannelData(0);
    const step = 1 - Math.exp((-2 * Math.PI * spec.cutoff) / context.sampleRate);
    let seed = 0x23ab9 + index,
      low = 0,
      phase = 0;
    for (let i = 0; i < samples.length; i++) {
      seed ^= seed << 13;
      seed ^= seed >>> 17;
      seed ^= seed << 5;
      low += step * ((seed >>> 0) / 0x80000000 - 1 - low);
      const t = i / context.sampleRate;
      phase += (2 * Math.PI * spec.hz * (0.7 + 0.6 * Math.exp(-t / 0.025))) / context.sampleRate;
      const envelope =
        Math.min(1, t / 0.003) * Math.min(1, (spec.sec - t) / 0.025) * Math.exp(-t / spec.decay);
      samples[i] = (Math.sin(phase) * spec.tone + low * spec.noise) * envelope;
    }
    buffers.set(`impact-${kind as ImpactKind}`, buffer);
  }
  return buffers;
}
