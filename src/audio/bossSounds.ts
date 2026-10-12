const BOSS_CUES = ['heavy', 'barrier', 'split', 'bloom', 'storm', 'ink', 'command'] as const;
type BossCue = (typeof BOSS_CUES)[number];
export type BossSound = `boss-${BossCue}-${'windup' | 'cast'}`;
const CUES: Readonly<Record<string, BossCue>> = {
  bigJelly: 'heavy',
  gateJelly: 'barrier',
  splitCaptain: 'split',
  greenhouseKeeper: 'bloom',
  stormCrow: 'storm',
  kingJelly: 'ink',
  gardenKing: 'command',
};

export function bossSkillSound(enemyId: string, phase: 'windup' | 'cast' | 'cancel'): BossSound | undefined {
  const cue = CUES[enemyId];
  return cue && phase !== 'cancel' ? `boss-${cue}-${phase}` : undefined;
}

export function createBossBuffers(context: BaseAudioContext): ReadonlyMap<BossSound, AudioBuffer> {
  const buffers = new Map<BossSound, AudioBuffer>();
  for (const [index, cue] of BOSS_CUES.entries()) {
    for (const mode of ['windup', 'cast'] as const) {
      const preparing = mode === 'windup';
      const sec = preparing ? 0.3 + index * 0.005 : 0.5 + index * 0.015;
      const buffer = context.createBuffer(1, Math.ceil(context.sampleRate * sec), context.sampleRate);
      const samples = buffer.getChannelData(0);
      let seed = 0x1b873593 + index * 31 + (preparing ? 1 : 0);
      let low = 0;
      let band = 0;
      let phase = 0;
      let hornPhase = 0;
      const lowStep = 1 - Math.exp((-2 * Math.PI * 350) / context.sampleRate);
      const bandStep = 1 - Math.exp((-2 * Math.PI * 1600) / context.sampleRate);
      for (let i = 0; i < samples.length; i++) {
        seed ^= seed << 13;
        seed ^= seed >>> 17;
        seed ^= seed << 5;
        const white = (seed >>> 0) / 0x80000000 - 1;
        low += lowStep * (white - low);
        band += bandStep * (white - band);
        const t = i / context.sampleRate;
        phase += (2 * Math.PI * (75 + 100 * Math.exp(-t / 0.035))) / context.sampleRate;
        hornPhase += (2 * Math.PI * (t < 0.22 ? 165 : 220)) / context.sampleRate;
        let sample = 0;
        switch (cue) {
          case 'heavy':
            sample = (0.32 * Math.sin(phase) + 0.34 * low) * Math.exp(-t / 0.12);
            break;
          case 'barrier':
            sample =
              (0.16 * Math.sin(2 * Math.PI * 310 * t) +
                0.09 * Math.sin(2 * Math.PI * 730 * t) +
                0.18 * band) *
              Math.exp(-t / 0.14);
            break;
          case 'split': {
            const p = t % 0.14;
            sample =
              (0.25 * Math.sin(2 * Math.PI * (170 - 400 * p) * p) + 0.2 * low) *
              Math.sin(Math.PI * Math.min(1, p / 0.12)) ** 2 *
              Math.exp(-p / 0.055);
            break;
          }
          case 'bloom':
            sample =
              (0.13 * Math.sin(2 * Math.PI * 330 * t) +
                0.1 * Math.sin(2 * Math.PI * 440 * t) +
                0.05 * Math.sin(2 * Math.PI * 660 * t)) *
              Math.exp(-t / 0.22);
            break;
          case 'storm':
            sample = (0.4 * (band - low) + 0.23 * low) * Math.sin((Math.PI * t) / sec) ** 2;
            break;
          case 'ink':
            sample =
              (0.2 * Math.sin(phase + 1.8 * Math.sin(2 * Math.PI * 9 * t)) + 0.2 * low) * Math.exp(-t / 0.16);
            break;
          case 'command':
            sample =
              (0.19 * Math.sin(hornPhase) + 0.08 * Math.sin(2 * Math.PI * 330 * t)) *
              Math.sin((Math.PI * t) / sec);
            break;
        }
        const attack = Math.min(1, t / 0.012);
        const release = Math.min(1, (sec - t) / 0.06);
        samples[i] = sample * attack * release * (preparing ? 0.28 : 1);
      }
      buffers.set(`boss-${cue}-${mode}`, buffer);
    }
  }
  return buffers;
}
