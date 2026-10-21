import { dist } from '../core/math';
import type { ContentDb, Effect } from '../data/types';
import { unitStats } from './stats';
import { damageEnemy, slowEnemy } from './systems/damage';
import { pickEnemy } from './targeting';
import type { BattleState, SimEvent, StageRuntime, UnitEntity } from './types';

type GravityEffect = Extract<Effect, { type: 'gravityField' }>;

function targets(
  content: ContentDb,
  state: Readonly<BattleState>,
  unit: Readonly<UnitEntity>,
  radius: number,
) {
  const center = unit.gravityCenter;
  const def = content.units.get(unit.unitId);
  return center
    ? state.enemies.filter(
        (enemy) =>
          enemy.hp > 0 &&
          (def?.canHitAir || !content.enemies.get(enemy.enemyId)?.flying) &&
          dist(enemy.x, enemy.y, center.x, center.y) <= radius,
      )
    : [];
}

export function startGravityField(
  content: ContentDb,
  stage: StageRuntime,
  state: BattleState,
  unit: UnitEntity,
  effect: GravityEffect,
  events: SimEvent[],
): void {
  const target = pickEnemy(content, stage, state, unit);
  if (!target) return;
  unit.gravityCenter = { x: target.x, y: target.y };
  events.push({
    type: 'gravityField',
    uid: unit.uid,
    phase: 'start',
    ...unit.gravityCenter,
    radius: effect.radius,
  });
  slowGravityField(content, state, unit, events);
}

export function slowGravityField(
  content: ContentDb,
  state: BattleState,
  unit: UnitEntity,
  events: SimEvent[],
): void {
  const effect = unit.buffs.find((effect) => effect.type === 'gravityField');
  if (!effect) return;
  for (const enemy of targets(content, state, unit, effect.radius)) {
    const amount = content.enemies.get(enemy.enemyId)?.boss ? effect.bossSlowAmount : effect.slowAmount;
    slowEnemy(enemy, amount, state.tick + 1, state.tick, events);
  }
}

export function burstGravityField(
  content: ContentDb,
  stage: StageRuntime,
  state: BattleState,
  unit: UnitEntity,
  events: SimEvent[],
): void {
  const effect = unit.buffs.find((effect) => effect.type === 'gravityField');
  const center = unit.gravityCenter;
  if (!effect || !center) return;
  events.push({ type: 'gravityField', uid: unit.uid, phase: 'burst', ...center, radius: effect.radius });
  const stats = unitStats(content, stage, state, unit);
  for (const enemy of targets(content, state, unit, effect.radius))
    damageEnemy(content, unit, enemy, stats.atk * effect.atkMul, 'magic', events);
}
