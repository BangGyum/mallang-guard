import type { SimEvent } from '../sim/types';

export type Sound = 'deploy' | 'hit' | 'shoot' | 'magic' | 'pop' | 'skill' | 'leak' | 'win' | 'lose';

export function createSfx(initialVolume: number) {
  let context: AudioContext | undefined;
  let master: GainNode | undefined;
  let noise: AudioBuffer | undefined;
  let volume = initialVolume;
  const sources = new Set<AudioScheduledSourceNode>();
  const recent = new Map<Sound, number[]>();
  const pending: { sound: Sound; delay: number }[] = [];
  function unlock(event: Event) {
    if (!event.isTrusted) return;
    if (!context) {
      context = new AudioContext();
      master = context.createGain();
      master.gain.value = volume;
      master.connect(context.destination);
      noise = context.createBuffer(1, Math.ceil(context.sampleRate * 0.06), context.sampleRate);
      const samples = noise.getChannelData(0);
      for (let i = 0; i < samples.length; i++) samples[i] = Math.random() * 2 - 1;
    }
    if (context.state === 'suspended') void context.resume().catch(() => {});
  }
  document.addEventListener('pointerdown', unlock);
  document.addEventListener('keydown', unlock);
  function connect(source: AudioScheduledSourceNode, gain: GainNode, start: number, duration: number) {
    if (!context || !master) return;
    gain.gain.setValueAtTime(0.0001, start);
    gain.gain.exponentialRampToValueAtTime(0.14, start + 0.006);
    gain.gain.exponentialRampToValueAtTime(0.0001, start + duration);
    gain.connect(master);
    sources.add(source);
    source.onended = () => {
      source.disconnect();
      gain.disconnect();
      sources.delete(source);
    };
    source.start(start);
    source.stop(start + duration + 0.01);
  }
  function tone(start: number, from: number, to: number, duration: number, type: OscillatorType = 'sine') {
    if (!context) return;
    const source = context.createOscillator();
    const gain = context.createGain();
    source.type = type;
    source.frequency.setValueAtTime(from, start);
    source.frequency.exponentialRampToValueAtTime(to, start + duration);
    source.connect(gain);
    connect(source, gain, start, duration);
  }
  function play(sound: Sound) {
    if (context?.state !== 'running' || volume === 0) return;
    const start = context.currentTime;
    const times = (recent.get(sound) ?? []).filter((time) => Math.abs(start - time) < 0.05);
    if (times.length >= 3) return;
    times.push(start);
    recent.set(sound, times);
    if (sound === 'deploy') tone(start, 400, 900, 0.12);
    if (sound === 'shoot') tone(start, 700, 180, 0.09, 'triangle');
    if (sound === 'pop') tone(start, 540, 110, 0.12);
    if (sound === 'hit' && noise) {
      const source = context.createBufferSource();
      const filter = context.createBiquadFilter();
      const gain = context.createGain();
      source.buffer = noise;
      filter.type = 'lowpass';
      filter.frequency.value = 900;
      source.connect(filter);
      filter.connect(gain);
      connect(source, gain, start, 0.06);
      const ended = source.onended;
      source.onended = (event) => {
        filter.disconnect();
        ended?.call(source, event);
      };
    }
    if (sound === 'magic') {
      tone(start, 660, 880, 0.16);
      tone(start, 990, 1320, 0.16);
    }
    if (sound === 'skill')
      [440, 660, 880].forEach((hz, i) => {
        tone(start + i * 0.07, hz, hz, 0.12, 'square');
      });
    if (sound === 'leak')
      [0, 0.14].forEach((offset) => {
        tone(start + offset, 220, 150, 0.1);
      });
    if (sound === 'win' || sound === 'lose') {
      const notes = sound === 'win' ? [523, 659, 784, 1047] : [392, 330, 262];
      notes.forEach((hz, i) => {
        tone(start + i * 0.13, hz, hz, 0.2);
      });
    }
  }
  function schedule(sound: Sound, delay = 0) {
    if (delay > 0) pending.push({ sound, delay });
    else play(sound);
  }
  function stop() {
    for (const source of sources) source.stop();
    recent.clear();
  }
  function reset() {
    stop();
    pending.length = 0;
  }
  return {
    play,
    stop,
    reset,
    update(dt: number) {
      for (let i = 0; i < pending.length; ) {
        const entry = pending[i];
        if (!entry) break;
        entry.delay -= dt;
        if (entry.delay <= 0) {
          play(entry.sound);
          pending.splice(i, 1);
        } else i++;
      }
    },
    setVolume(value: number) {
      volume = value;
      if (context && master) master.gain.setTargetAtTime(value, context.currentTime, 0.015);
    },
    onEvents(events: readonly SimEvent[], delays: ReadonlyMap<SimEvent, number>) {
      for (const event of events) {
        const delay = delays.get(event) ?? 0;
        if (event.type === 'unitDeploy') play('deploy');
        if (event.type === 'attack' && event.ranged) play('shoot');
        if (event.type === 'damage') schedule(event.damageType === 'magic' ? 'magic' : 'hit', delay);
        if (event.type === 'enemyDie') schedule('pop', delay);
        if (event.type === 'skillPulse') play('magic');
        if (event.type === 'skillStart') play('skill');
        if (event.type === 'enemyLeak') play('leak');
        if (event.type === 'battleEnd') schedule(event.result === 'won' ? 'win' : 'lose', 0.5);
      }
    },
    dispose() {
      document.removeEventListener('pointerdown', unlock);
      document.removeEventListener('keydown', unlock);
      reset();
      master?.disconnect();
      if (context) void context.close();
    },
  };
}
