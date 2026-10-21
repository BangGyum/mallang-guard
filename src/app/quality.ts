export function createQualityMonitor() {
  let seconds = 0;
  let frames = 0;
  let done = false;
  return {
    stop() {
      done = true;
    },
    sample(dt: number): boolean {
      if (done || dt <= 0) return false;
      seconds += dt;
      frames++;
      if (seconds < 3) return false;
      done = true;
      return frames / seconds < 40;
    },
  };
}
