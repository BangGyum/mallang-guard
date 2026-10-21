export type RecruitSound = 'recruitSR' | 'recruitSSR' | 'recruitUR';

export function createRecruitBuffers(context: BaseAudioContext): ReadonlyMap<RecruitSound, AudioBuffer> {
  const buffers = new Map<RecruitSound, AudioBuffer>();
  for (const [index, sound] of (['recruitSR', 'recruitSSR', 'recruitUR'] as const).entries()) {
    const duration = 0.34 + index * 0.15;
    const buffer = context.createBuffer(1, Math.ceil(context.sampleRate * duration), context.sampleRate);
    const samples = buffer.getChannelData(0);
    for (let i = 0; i < samples.length; i++) {
      const t = i / context.sampleRate;
      let value = 0;
      for (let note = 0; note <= index + 1; note++) {
        const age = t - note * 0.065;
        if (age < 0) continue;
        const frequency = [220, 330, 440, 550][note] ?? 220;
        value +=
          0.075 * Math.sin(2 * Math.PI * frequency * age) * Math.min(1, age / 0.012) * Math.exp(-age / 0.12);
      }
      samples[i] = value * Math.min(1, (duration - t) / 0.045);
    }
    buffers.set(sound, buffer);
  }
  return buffers;
}
