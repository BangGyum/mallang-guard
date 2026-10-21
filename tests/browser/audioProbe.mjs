export function installAudioProbe() {
  const NativeContext = window.AudioContext;
  window.audioProbe = { contexts: [], sources: 0, gains: [], starts: [], active: new Set() };
  window.AudioContext = class extends NativeContext {
    constructor(...args) {
      super(...args);
      window.audioProbe.contexts.push(this);
    }
    createOscillator() {
      window.audioProbe.sources++;
      return super.createOscillator();
    }
    createBufferSource() {
      window.audioProbe.sources++;
      const source = super.createBufferSource();
      const start = source.start.bind(source);
      source.start = (...args) => {
        window.audioProbe.starts.push({
          duration: source.buffer?.duration,
          rate: source.playbackRate.value,
        });
        window.audioProbe.active.add(source);
        source.addEventListener('ended', () => window.audioProbe.active.delete(source), { once: true });
        return start(...args);
      };
      return source;
    }
    createGain() {
      const gain = super.createGain();
      window.audioProbe.gains.push(gain);
      return gain;
    }
  };
}
