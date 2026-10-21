const DURATIONS = {
  acornPickup: 0.32,
  nyangCombo: 0.28,
  potLidGuard: 0.42,
  snowballBarrage: 0.38,
  stardustShower: 0.48,
  carrotSoup: 0.34,
  tunnelAmbush: 0.24,
  stickyRoad: 0.4,
  wideBarrage: 0.52,
  tripleAim: 0.36,
  polarAim: 0.5,
  siegeBarrage: 0.46,
  stormChain: 0.44,
  arcPulse: 0.2,
  eventHorizon: 0.62,
  gravityBurst: 0.5,
} as const;
type SkillCue = keyof typeof DURATIONS;
export type SkillSound = `skill-${SkillCue}`;

export function skillStartSound(skillId: string): SkillSound | undefined {
  return Object.hasOwn(DURATIONS, skillId) ? `skill-${skillId as SkillCue}` : undefined;
}

function envelope(t: number, start: number, duration: number): number {
  const age = t - start;
  if (age < 0 || age >= duration) return 0;
  return Math.min(1, age / 0.006) * Math.exp(-age / (duration * 0.35)) * Math.min(1, (duration - age) / 0.03);
}

function tone(t: number, hz: number, start: number, duration: number): number {
  return Math.sin(2 * Math.PI * hz * (t - start)) * envelope(t, start, duration);
}

export function createSkillBuffers(context: BaseAudioContext): ReadonlyMap<SkillSound, AudioBuffer> {
  const buffers = new Map<SkillSound, AudioBuffer>();
  for (const [index, [cue, sec]] of Object.entries(DURATIONS).entries()) {
    const buffer = context.createBuffer(1, Math.ceil(context.sampleRate * sec), context.sampleRate);
    const samples = buffer.getChannelData(0);
    let seed = 0x4a1d839b + index * 97;
    let low = 0;
    let band = 0;
    let phase = 0;
    const lowStep = 1 - Math.exp((-2 * Math.PI * 310) / context.sampleRate);
    const bandStep = 1 - Math.exp((-2 * Math.PI * 1400) / context.sampleRate);
    for (let i = 0; i < samples.length; i++) {
      seed ^= seed << 13;
      seed ^= seed >>> 17;
      seed ^= seed << 5;
      const white = (seed >>> 0) / 0x80000000 - 1;
      low += lowStep * (white - low);
      band += bandStep * (white - band);
      const t = i / context.sampleRate;
      phase += (2 * Math.PI * (70 + 160 * Math.exp(-t / 0.055))) / context.sampleRate;
      const body = Math.sin(phase);
      const air = band - low;
      let sample = 0;
      switch (cue) {
        case 'acornPickup':
          sample =
            0.09 * tone(t, 520, 0, 0.16) + 0.07 * tone(t, 680, 0.09, 0.2) + 0.16 * air * envelope(t, 0, 0.08);
          break;
        case 'nyangCombo':
          sample = 0.25 * air * (envelope(t, 0, 0.14) + 0.7 * envelope(t, 0.1, 0.17));
          break;
        case 'potLidGuard':
          sample = (0.24 * body + 0.24 * low) * envelope(t, 0, sec) + 0.035 * tone(t, 420, 0.02, 0.3);
          break;
        case 'snowballBarrage':
          sample =
            0.22 * air * envelope(t, 0.04, 0.28) +
            0.08 * tone(t, 710, 0, 0.18) +
            0.12 * low * envelope(t, 0.15, 0.15);
          break;
        case 'stardustShower':
          sample =
            (0.13 * Math.sin(phase * 3.1) + 0.21 * air) * envelope(t, 0, sec) +
            0.06 * tone(t, 420, 0.12, 0.3);
          break;
        case 'carrotSoup':
          sample =
            0.08 * tone(t, 440, 0, 0.14) +
            0.07 * tone(t, 590, 0.12, 0.2) +
            0.08 * band * envelope(t, 0.1, 0.12);
          break;
        case 'tunnelAmbush':
          sample =
            (0.12 * Math.sin(phase * 1.7) + 0.34 * low + 0.4 * air) * envelope(t, 0, 0.15) +
            0.16 * air * envelope(t, 0.09, 0.1);
          break;
        case 'stickyRoad':
          sample =
            (0.15 * Math.sin(phase + 1.6 * Math.sin(2 * Math.PI * 13 * t)) + 0.28 * low) *
            envelope(t, 0, sec);
          break;
        case 'wideBarrage':
          sample =
            (0.5 * low + 0.34 * air) * Math.sin((Math.PI * t) / sec) ** 2 + 0.12 * body * envelope(t, 0, 0.3);
          break;
        case 'tripleAim':
          for (const offset of [0, 0.08, 0.16])
            sample += 0.2 * air * envelope(t, offset, 0.09) + 0.035 * tone(t, 350, offset, 0.12);
          break;
        case 'polarAim':
          sample =
            0.09 * Math.sin(2 * Math.PI * (180 * t + 230 * t * t)) * Math.sin((Math.PI * t) / sec) ** 2 +
            (0.21 * body + 0.25 * low) * envelope(t, 0.23, 0.25);
          break;
        case 'siegeBarrage':
          sample = 0.18 * air * envelope(t, 0, 0.1) + (0.29 * body + 0.36 * low) * envelope(t, 0.1, 0.35);
          break;
        case 'stormChain':
          sample =
            (0.28 * low + 0.42 * air) * (envelope(t, 0, 0.27) + 0.65 * envelope(t, 0.16, 0.25)) +
            0.045 * body * envelope(t, 0.02, 0.3);
          break;
        case 'arcPulse':
          sample = (0.12 * Math.sin(phase * 4) + 0.22 * air + 0.12 * low) * envelope(t, 0, sec);
          break;
        case 'eventHorizon':
          sample =
            (0.13 * Math.sin(2 * Math.PI * (240 * t - 100 * t * t)) + 0.24 * low) *
              Math.sin((Math.PI * t) / sec) ** 2 +
            0.05 * tone(t, 360, 0.25, 0.3);
          break;
        case 'gravityBurst':
          sample =
            (0.22 * Math.sin(phase * 0.67 + 0.3 * Math.sin(2 * Math.PI * 16 * t)) + 0.33 * low + 0.1 * air) *
              envelope(t, 0, sec) +
            0.06 * tone(t, 260, 0.08, 0.3);
          break;
      }
      // 모든 음원에 완만한 시작과 끝을 적용해 클릭·고음 피로를 줄입니다.
      samples[i] = sample * Math.min(1, t / 0.008) * Math.min(1, (sec - t) / 0.045);
    }
    buffers.set(`skill-${cue as SkillCue}`, buffer);
  }
  return buffers;
}
