export function installAudioProbe() {
  const NativeContext = window.AudioContext;
  window.audioProbe = { contexts: [], sources: 0, gains: [] };
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
      return super.createBufferSource();
    }
    createGain() {
      const gain = super.createGain();
      window.audioProbe.gains.push(gain);
      return gain;
    }
  };
}
