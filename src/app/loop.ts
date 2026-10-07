import type { Battle } from '../sim/battle';
import { TICK_RATE } from '../sim/constants';
import type { SimEvent } from '../sim/types';

export const MAX_STEPS_PER_FRAME = 8;
export const BULLET_TIME_SCALE = 0.25;

export interface LoopControls {
  paused: boolean;
  speed: 1 | 2;
  bulletTime: boolean;
}

export function startLoop(
  battle: Battle,
  controls: LoopControls,
  onEvents: (events: SimEvent[]) => void,
  render: (alpha: number, dt: number, wallDt: number) => void,
) {
  const tickSec = 1 / TICK_RATE;
  let acc = 0;
  let last = performance.now();
  let frameId = 0;
  function frame(now: number) {
    const dt = Math.min(Math.max(0, (now - last) / 1000), 0.25);
    last = now;
    const scale =
      controls.paused || battle.state.phase !== 'running'
        ? 0
        : controls.speed * (controls.bulletTime ? BULLET_TIME_SCALE : 1);
    acc += dt * scale;
    let steps = 0;
    while (acc >= tickSec && steps < MAX_STEPS_PER_FRAME) {
      onEvents(battle.step());
      acc -= tickSec;
      steps++;
    }
    if (steps === MAX_STEPS_PER_FRAME) acc = 0;
    if (controls.paused) onEvents(battle.flush());
    render(controls.paused || battle.state.phase !== 'running' ? 1 : acc / tickSec, dt * scale, dt);
    frameId = requestAnimationFrame(frame);
  }
  function onVisibility() {
    if (document.hidden) controls.paused = true;
    last = performance.now();
  }
  document.addEventListener('visibilitychange', onVisibility);
  frameId = requestAnimationFrame(frame);
  return {
    dispose() {
      cancelAnimationFrame(frameId);
      document.removeEventListener('visibilitychange', onVisibility);
    },
  };
}
