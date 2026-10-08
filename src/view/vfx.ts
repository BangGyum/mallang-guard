import { type PerspectiveCamera, type Texture, Vector3 } from 'three';
import { rangeTiles } from '../core/grid';
import type { ContentDb } from '../data/types';
import type { Board } from '../sim/board';
import type { BattleState, SimEvent } from '../sim/types';
import { tileHeight } from './coords';
import { PROJECTILE_SEC } from './eventTiming';
import { createParticlePool } from './particlePool';

const SHOTS: Record<string, string> = {
  penguin: 'snowball',
  sheep: 'star',
  snail: 'stickyDrop',
  bunny: 'carrot',
  squirrel: 'acorn',
};

export function createVfx(
  content: ContentDb,
  board: Board,
  textures: ReadonlyMap<string, Texture>,
  position: (uid: number) => Vector3 | undefined,
) {
  const pool = createParticlePool(textures);
  const point = new Vector3();
  const pending: { seconds: number; at: Vector3; id: string; count: number }[] = [];
  let reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  let low = false;
  let time = 0;
  function burst(id: string, at: Vector3, count: number) {
    const total = reduced || low ? Math.ceil(count / 2) : count;
    for (let i = 0; i < total; i++) {
      const angle = (i / total) * Math.PI * 2;
      point.copy(at).add(new Vector3(Math.cos(angle) * 0.45, 0.2 + (i % 3) * 0.12, Math.sin(angle) * 0.35));
      pool.emit(id, at, point, 0.45, 0.15, 0.25);
    }
  }
  return {
    group: pool.group,
    get count() {
      return pool.count;
    },
    setOptions(reducedMotion: boolean, qualityLow: boolean) {
      reduced = reducedMotion;
      low = qualityLow;
    },
    onEvents(
      events: readonly SimEvent[],
      state: Readonly<BattleState>,
      delays: ReadonlyMap<SimEvent, number>,
    ) {
      for (const event of events) {
        if (event.type === 'unitDisrupt') {
          const from = position(event.src);
          const to = position(event.uid);
          if (from && to) pool.emit('stickyDrop', from, to, PROJECTILE_SEC, 0.25, 0.3);
        }
        if (event.type === 'attack') {
          const from = position(event.src.uid);
          const to = position(event.dst.uid);
          if (from && to) {
            const unit = state.units.find((unit) => unit.uid === event.src.uid);
            if (event.ranged)
              pool.emit(SHOTS[unit?.unitId ?? ''] ?? 'spark', from, to, PROJECTILE_SEC, 0.22, 0.35);
            else burst('spark', to, 3);
          }
        }
        if (event.type === 'unitDeploy' || event.type === 'skillStart') {
          const unit = state.units.find((unit) => unit.uid === event.uid);
          if (!unit) continue;
          point.set(
            unit.tile.x + 0.5 - board.width / 2,
            tileHeight(board.kindAt(unit.tile.x, unit.tile.y) ?? 'high') + 0.04,
            unit.tile.y + 0.5 - board.height / 2,
          );
          pool.emit('ring', point, point, 0.45, 0.35, 0, true);
          const at = position(unit.uid);
          if (at && event.type === 'skillStart') burst(unit.unitId === 'bunny' ? 'heartPlus' : 'star', at, 6);
        }
        if (event.type === 'skillPulse') {
          const unit = state.units.find((unit) => unit.uid === event.uid);
          const def = unit && content.units.get(unit.unitId);
          const range = def && content.ranges.get(def.range);
          if (!unit || !range) continue;
          for (const [i, tile] of rangeTiles(
            unit.tile,
            range.tiles,
            unit.dir,
            board.width,
            board.height,
          ).entries()) {
            if ((reduced || low) && i % 2) continue;
            const end = new Vector3(
              tile.x + 0.5 - board.width / 2,
              tileHeight(board.kindAt(tile.x, tile.y) ?? 'ground') + 0.1,
              tile.y + 0.5 - board.height / 2,
            );
            pool.emit('star', end.clone().add(new Vector3(0, 0.8, 0)), end, 0.4, 0.22);
          }
        }
        if (event.type === 'enemyDie') {
          const at = position(event.uid);
          if (at) pending.push({ seconds: delays.get(event) ?? 0, at, id: 'droplet', count: 8 });
        }
      }
    },
    update(state: Readonly<BattleState>, camera: PerspectiveCamera, dt: number) {
      time += dt;
      for (let i = pending.length - 1; i >= 0; i--) {
        const effect = pending[i];
        if (!effect) continue;
        effect.seconds -= dt;
        if (effect.seconds <= 0) {
          burst(effect.id, effect.at, effect.count);
          pending.splice(i, 1);
        }
      }
      pool.begin(dt, camera);
      for (const enemy of state.enemies) {
        if (enemy.slowAmount > 0) {
          point.set(enemy.x - board.width / 2, 0.025, enemy.y - board.height / 2);
          pool.draw('goo', point, 0.6, 0.45, camera, true);
        }
        if (enemy.stunUntilTick > state.tick) {
          for (let i = 0; i < (reduced || low ? 1 : 3); i++) {
            const angle = (reduced ? 0 : time * 3) + (i * Math.PI * 2) / 3;
            point.set(
              enemy.x - board.width / 2 + Math.cos(angle) * 0.24,
              (content.enemies.get(enemy.enemyId)?.flying ? 1.2 : 0) + 0.7,
              enemy.y - board.height / 2 + Math.sin(angle) * 0.12,
            );
            pool.draw('stunStar', point, 0.15, 1, camera);
          }
        }
      }
      pool.end();
    },
    dispose() {
      pending.length = 0;
      pool.dispose();
    },
  };
}
