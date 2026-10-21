import { type PerspectiveCamera, type Texture, Vector3 } from 'three';
import type { ContentDb } from '../data/types';
import type { Board } from '../sim/board';
import { rangeTilesFor } from '../sim/queries';
import type { BattleState, SimEvent } from '../sim/types';
import { bossSkillTheme } from './bossSkillTheme';
import { tileHeight } from './coords';
import { PROJECTILE_SEC, PULSE_IMPACT_SEC } from './eventTiming';
import { createGravityVfx } from './gravityVfx';
import { createParticlePool } from './particlePool';
import { drawSkillMarks, emitSkillMuzzle, emitSkillStart, skillMark } from './skillVfx';
import { WEAPON_VFX } from './weaponVfx';

export function createVfx(
  content: ContentDb,
  board: Board,
  textures: ReadonlyMap<string, Texture>,
  position: (uid: number) => Vector3 | undefined,
  attackOrigin: (uid: number) => Vector3 | undefined,
) {
  const pool = createParticlePool(textures);
  const gravity = createGravityVfx(pool, board);
  const point = new Vector3();
  const pending: {
    seconds: number;
    at: Vector3;
    id: string;
    count: number;
    impact?: string;
    power?: number;
    linkFrom?: Vector3;
    mark?: string;
  }[] = [];
  let reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  let low = false;
  let time = 0;
  function burst(id: string, at: Vector3, count: number, delay = 0) {
    const total = reduced || low ? Math.ceil(count / 2) : count;
    for (let i = 0; i < total; i++) {
      const angle = (i / total) * Math.PI * 2;
      point.copy(at).add(new Vector3(Math.cos(angle) * 0.28, 0.12 + (i % 3) * 0.06, Math.sin(angle) * 0.22));
      pool.emit(id, at, point, 0.3, id === 'droplet' ? 0.14 : 0.11, 0.12, false, false, 0.65, false, delay);
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
      gravity.onEvents(events);
      const flashed = new Set<number>();
      for (const event of events) {
        if (event.type === 'bossSkill' && event.phase === 'cast') {
          const at = position(event.uid);
          const def = content.enemies.get(event.enemyId);
          if (at && def) {
            const theme = bossSkillTheme(def);
            pool.emit(theme.effect, at, at, 0.35, reduced || low ? 0.6 : 1.15, 0, false, false, 0.5);
            burst(theme.effect === 'signal' ? 'signal' : 'spark', at, 4);
          }
        }
        if (event.type === 'enemyHeal') {
          const at = position(event.uid);
          if (at) burst('signal', at, 2);
        }
        if (event.type === 'unitDisrupt') {
          const from = position(event.src);
          const to = position(event.uid);
          if (from && to) pool.emit('stickyDrop', from, to, PROJECTILE_SEC, 0.25, 0.3);
        }
        if (event.type === 'attack') {
          const from =
            event.chainFrom === undefined ? attackOrigin(event.src.uid) : position(event.chainFrom);
          const to = position(event.dst.uid);
          if (from && to) {
            const unit = state.units.find((unit) => unit.uid === event.src.uid);
            if (event.chainFrom !== undefined) {
              pending.push({
                seconds: PROJECTILE_SEC,
                at: to,
                id: 'flameBolt',
                count: 2,
                linkFrom: from,
                impact: 'flameBloom',
                power: unit?.skillState === 'active' ? 1 : 0.65,
              });
              continue;
            }
            const shot = unit && WEAPON_VFX[unit.unitId];
            if (event.ranged && shot) {
              const grenade = unit.unitId === 'redPanda';
              const active = unit.skillState === 'active';
              const boost = active ? (shot.skillScale ?? 1.15) : 1;
              const art = active ? (shot.skillArt ?? shot.art) : shot.art;
              const arc = shot.arc * (grenade && unit.skillState === 'active' ? 1.25 : 1);
              pool.emit(art, from, to, PROJECTILE_SEC, shot.size * boost, arc, false, true);
              if (!flashed.has(unit.uid)) {
                emitSkillMuzzle(
                  pool,
                  unit.unitId,
                  from,
                  shot.muzzle,
                  unit.skillState === 'active',
                  reduced || low,
                );
                flashed.add(unit.uid);
              }
              if (unit.unitId === 'cat') pool.emit(art, from, from, 0.18, 0.8);
              pending.push({
                seconds: PROJECTILE_SEC,
                at: to,
                id: (active && shot.skillArt) || shot.debris || 'spark',
                count: shot.power ? 5 : 3,
                impact: active
                  ? (shot.skillImpact ?? (unit.unitId === 'cat' ? art : shot.impact))
                  : shot.impact,
                power: (shot.power ?? 1) * boost,
                mark:
                  unit.skillState === 'active'
                    ? skillMark(content.units.get(unit.unitId)?.skill ?? '')
                    : undefined,
              });
            } else burst('spark', to, 3);
          }
        }
        if (event.type === 'skillStart')
          emitSkillStart(pool, content, board, state, event, position, reduced || low);
        if (event.type === 'unitDeploy') {
          const unit = state.units.find((unit) => unit.uid === event.uid);
          if (!unit) continue;
          point.set(
            unit.tile.x + 0.5 - board.width / 2,
            tileHeight(board.kindAt(unit.tile.x, unit.tile.y) ?? 'high') + 0.04,
            unit.tile.y + 0.5 - board.height / 2,
          );
          pool.emit('ring', point, point, 0.35, 0.3, 0, true, false, 0.35);
        }
        if (event.type === 'skillPulse') {
          const unit = state.units.find((unit) => unit.uid === event.uid);
          const def = unit && content.units.get(unit.unitId);
          if (!unit || !def) continue;
          for (const [i, tile] of rangeTilesFor(
            content,
            { board },
            unit.unitId,
            unit.tile,
            unit.dir,
            unit.buffs,
          ).entries()) {
            if ((reduced || low) && i % 2) continue;
            const end = new Vector3(
              tile.x + 0.5 - board.width / 2,
              tileHeight(board.kindAt(tile.x, tile.y) ?? 'ground') + 0.1,
              tile.y + 0.5 - board.height / 2,
            );
            pool.emit(
              'cometRound',
              end.clone().add(new Vector3(0, 1.05, 0)),
              end,
              PULSE_IMPACT_SEC,
              0.48,
              0,
              false,
              true,
            );
            if (!reduced && !low)
              pool.emit(
                skillMark(def.skill),
                end,
                end,
                0.22,
                0.35,
                0,
                true,
                false,
                0.3,
                false,
                PULSE_IMPACT_SEC,
              );
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
          // 이번 프레임에서 탄이 도착하기 전 시간은 새 이펙트의 수명에 포함하지 않습니다.
          const delay = dt + effect.seconds;
          burst(effect.id, effect.at, effect.count, delay);
          if (effect.linkFrom)
            pool.emit(
              'flameLink',
              effect.linkFrom,
              effect.at,
              0.14,
              (reduced || low ? 0.28 : 0.48) * (effect.power ?? 1),
              0,
              false,
              true,
              reduced || low ? 0.45 : 0.75,
              true,
              delay,
            );
          const grenade = effect.impact === 'shellBurst';
          if (effect.impact && (grenade || (!reduced && !low)))
            pool.emit(
              effect.impact,
              effect.at,
              effect.at,
              grenade ? 0.32 : effect.impact === 'flameBloom' ? 0.24 : 0.18,
              0.55 * (effect.power ?? 1) * (grenade && (reduced || low) ? 0.65 : 1),
              0,
              false,
              false,
              0.85,
              false,
              delay,
            );
          if (effect.mark && !reduced && !low)
            pool.emit(
              effect.mark,
              effect.at,
              effect.at,
              0.2,
              0.28 * (effect.power ?? 1),
              0,
              true,
              false,
              0.25,
              false,
              delay,
            );
          pending.splice(i, 1);
        }
      }
      pool.begin(dt, camera);
      drawSkillMarks(pool, content, board, state, camera, time, reduced || low);
      gravity.draw(content, state, camera, dt, reduced || low);
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
      gravity.dispose();
      pool.dispose();
    },
  };
}
