import { type PerspectiveCamera, Vector3 } from 'three';
import type { ContentDb } from '../data/types';
import type { Board } from '../sim/board';
import { TICK_RATE } from '../sim/constants';
import type { BattleState, SimEvent } from '../sim/types';
import type { createParticlePool } from './particlePool';

export function createGravityVfx(pool: ReturnType<typeof createParticlePool>, board: Board) {
  const point = new Vector3();
  let time = 0;
  const bursts: { x: number; y: number; radius: number; age: number; fresh: boolean }[] = [];
  return {
    onEvents(events: readonly SimEvent[]) {
      for (const event of events)
        if (event.type === 'gravityField' && event.phase === 'burst')
          bursts.push({ x: event.x, y: event.y, radius: event.radius, age: 0, fresh: true });
    },
    draw(
      content: ContentDb,
      state: Readonly<BattleState>,
      camera: PerspectiveCamera,
      dt: number,
      quiet: boolean,
    ) {
      time += dt;
      for (const unit of state.units) {
        const effect = unit.buffs.find((effect) => effect.type === 'gravityField');
        const center = unit.gravityCenter;
        if (unit.skillState !== 'active' || !effect || !center) continue;
        const duration = content.skills.get(content.units.get(unit.unitId)?.skill ?? '')?.durationSec ?? 1;
        const remaining = Math.max(0, Math.min(1, (unit.skillEndTick - state.tick) / (TICK_RATE * duration)));
        point.set(center.x - board.width / 2, 0.075, center.y - board.height / 2);
        // 바깥 원은 실제 효과 범위를 유지하고 안쪽만 수축합니다.
        pool.draw('gravityRing', point, (effect.radius * 2 * 64) / 58, quiet ? 0.33 : 0.52, camera, true);
        if (!quiet) {
          pool.draw('gravityCore', point, 1.05 + remaining * 0.55, 0.8 - remaining * 0.35, camera, true);
          const orbit = effect.radius * (0.4 + remaining * 0.25);
          for (const side of [-1, 1]) {
            const angle = time * 1.8;
            point.set(
              center.x - board.width / 2 + side * Math.cos(angle) * orbit,
              0.09,
              center.y - board.height / 2 + side * Math.sin(angle) * orbit,
            );
            pool.draw('gravityCore', point, 0.22, 0.65, camera, true);
          }
        }
      }
      for (let index = bursts.length - 1; index >= 0; index--) {
        const burst = bursts[index];
        if (!burst) continue;
        if (!burst.fresh) burst.age += dt;
        burst.fresh = false;
        if (burst.age >= 0.4) {
          bursts.splice(index, 1);
          continue;
        }
        const progress = burst.age / 0.4;
        point.set(burst.x - board.width / 2, 0.08, burst.y - board.height / 2);
        pool.draw(
          'gravityBurst',
          point,
          burst.radius * 2 * (0.85 + progress * 0.25),
          (quiet ? 0.32 : 0.66) * (1 - progress),
          camera,
          true,
        );
        if (!quiet && progress < 0.45)
          pool.draw('gravityCore', point, 1.1 * (1 - progress), 0.75 * (1 - progress / 0.45), camera, true);
      }
    },
    dispose() {
      bursts.length = 0;
    },
  };
}
